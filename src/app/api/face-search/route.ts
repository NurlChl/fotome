import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { FaceDescriptor, FaceSearch, FalsePositiveFlag } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { faceSearchSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getUserHardNegatives, isHardNegativeMatch } from '@/lib/biometrics';
import mongoose from 'mongoose';

/**
 * POST /api/face-search - Search for matching faces
 * Receives a 128-d face descriptor and finds matching photos
 */
export async function POST(req: NextRequest) {
  // Strict rate limiting for face search
  const rateLimited = checkRateLimit(req, 'face-search');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    const body = await req.json();

    // Validate input
    const result = faceSearchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { descriptor, descriptors, eventId, threshold } = result.data;
    const skipHardNegatives = body.skipHardNegatives === true; // For manual claim verification

    // Normalize query vectors
    const queryVectors: number[][] = [];
    if (descriptors && descriptors.length > 0) {
      queryVectors.push(...descriptors);
    } else if (descriptor) {
      queryVectors.push(descriptor);
    }

    if (queryVectors.length === 0) {
      return NextResponse.json(
        { error: 'Either descriptor or descriptors must be provided.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Fetch false positive flags for this user in this event
    let flaggedPhotoIds: string[] = [];
    let hardNegatives: number[][] = [];
    if (session?.user?.id && !skipHardNegatives) {
      const flags = await FalsePositiveFlag.find({
        userId: session.user.id,
        eventId,
      }).select('photoId').lean();
      flaggedPhotoIds = flags.map(f => f.photoId.toString());
      
      // Load hard negatives for continuous learning
      hardNegatives = await getUserHardNegatives(session.user.id);
    }

    // Collect all matches from all query vectors
    const allMatches: FaceSearchResult[] = [];

    for (const vector of queryVectors) {
      let matchingFaces = [];
      try {
        matchingFaces = await FaceDescriptor.aggregate([
          {
            $vectorSearch: {
              index: 'face_vector_index',
              path: 'descriptor',
              queryVector: vector,
              numCandidates: 600,
              limit: 300,
              filter: {
                eventId: new mongoose.Types.ObjectId(eventId),
              },
            },
          },
          {
            $lookup: {
              from: 'photos',
              localField: 'photoId',
              foreignField: '_id',
              as: 'photo',
            },
          },
          {
            $unwind: '$photo',
          },
          {
            $match: {
              'photo.status': 'active',
            },
          },
          {
            $project: {
              _id: 1,
              photoId: 1,
              boundingBox: 1,
              descriptor: 1,
              photo: {
                _id: 1,
                watermarkedUrl: 1,
                thumbnailUrl: 1,
                width: 1,
                height: 1,
                createdAt: 1,
                faceCount: 1,
                hasFaces: 1,
              },
            },
          },
        ]);

        // Filter and calculate exact Euclidean distance if Atlas Vector Search returned results
        if (matchingFaces.length > 0) {
          const maxDistance = threshold ?? 0.60;
          const typedFaces = matchingFaces as unknown as {
            _id: mongoose.Types.ObjectId;
            photoId: mongoose.Types.ObjectId;
            descriptor: number[];
            boundingBox: { x: number; y: number; width: number; height: number };
            photo: PopulatedPhoto;
          }[];

          const mappedResults: FaceSearchResult[] = typedFaces
            .map((face) => {
              const dist = euclideanDistance(vector, face.descriptor);
              const score = Math.max(0, 1 - dist);
              return {
                _id: face._id,
                photoId: face.photoId,
                score,
                distance: dist,
                boundingBox: face.boundingBox,
                photo: face.photo,
                descriptor: face.descriptor,
              };
            })
            .filter((r) => {
              // Filter by distance threshold
              if (r.distance > maxDistance) return false;
              
              // Filter by hard negatives if user is logged in
              if (hardNegatives.length > 0 && r.descriptor) {
                return !isHardNegativeMatch(r.descriptor, hardNegatives, r.distance);
              }
              
              return true;
            })
            .sort((a, b) => a.distance - b.distance);

          matchingFaces = deduplicateByPhotoId(mappedResults);
        }

        // Smart Fallback: If Vector Search returns 0 results, check if descriptors exist for this event.
        if (matchingFaces.length === 0) {
          const totalInEvent = await FaceDescriptor.countDocuments({
            eventId: new mongoose.Types.ObjectId(eventId),
          });
          if (totalInEvent > 0) {
            matchingFaces = await fallbackFaceSearch(vector, eventId, threshold, hardNegatives);
          }
        }
      } catch (vectorSearchError) {
        // Fallback: if vector search index doesn't exist, use manual distance manually
        console.warn(
          'Vector search failed, using fallback:',
          vectorSearchError
        );
        matchingFaces = await fallbackFaceSearch(vector, eventId, threshold, hardNegatives);
      }

      allMatches.push(...matchingFaces);
    }

    // Deduplicate and sort by closest distance overall
    let finalResults = deduplicateByPhotoId(
      allMatches.sort((a, b) => a.distance - b.distance)
    );

    // Filter out flagged photo IDs
    if (flaggedPhotoIds.length > 0 && finalResults.length > 0) {
      finalResults = finalResults.filter((r: FaceSearchResult) => {
        const photoIdStr = r.photo?._id?.toString() || r.photoId?.toString();
        return !flaggedPhotoIds.includes(photoIdStr);
      });
    }

    // Log the search for analytics (just logging total match count)
    await FaceSearch.create({
      userId: session?.user?.id || undefined,
      eventId,
      resultsCount: finalResults.length,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      results: finalResults,
      count: finalResults.length,
    });
  } catch (error) {
    console.error('Face search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Fallback Euclidean distance search when Atlas Vector Search is not available
 * This is slower but works with any MongoDB instance
 * Note: Hard negative filtering is applied in the main POST handler after results are returned
 */
async function fallbackFaceSearch(
  queryDescriptor: number[],
  eventId: string,
  threshold?: number,
  hardNegatives: number[][] = []
) {
  const faceDescriptors = await FaceDescriptor.find({
    eventId: new mongoose.Types.ObjectId(eventId),
  })
    .populate({
      path: 'photoId',
      match: { status: 'active' },
      select: 'watermarkedUrl thumbnailUrl width height faceCount hasFaces createdAt',
    })
    .lean();

  // Match threshold (Euclidean distance <= threshold, default to 0.60 for standard matching)
  const maxDistance = threshold ?? 0.60;

  const typedDescriptors = faceDescriptors as unknown as {
    _id: mongoose.Types.ObjectId;
    photoId: PopulatedPhoto;
    descriptor: number[];
    boundingBox: { x: number; y: number; width: number; height: number };
  }[];

  const results: FaceSearchResult[] = typedDescriptors
    .filter((fd) => fd.photoId) // Only include faces with active photos
    .map((fd) => {
      const dist = euclideanDistance(queryDescriptor, fd.descriptor);
      // Map distance to a match score percentage (1.0 = perfect match, 0.0 = completely different)
      const score = Math.max(0, 1 - dist);
      return {
        _id: fd._id,
        photoId: fd.photoId._id,
        score,
        distance: dist,
        boundingBox: fd.boundingBox,
        photo: fd.photoId,
        descriptor: fd.descriptor,
      };
    })
    .filter((r) => {
      // Filter by distance threshold
      if (r.distance > maxDistance) return false;
      
      // Filter by hard negatives if available
      if (hardNegatives.length > 0 && r.descriptor) {
        return !isHardNegativeMatch(r.descriptor, hardNegatives, r.distance);
      }
      
      return true;
    })
    .sort((a, b) => a.distance - b.distance); // Closest matches first

  return deduplicateByPhotoId(results).slice(0, 50);
}

interface PopulatedPhoto {
  _id: mongoose.Types.ObjectId;
  watermarkedUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

interface FaceSearchResult {
  _id: mongoose.Types.ObjectId;
  photoId: mongoose.Types.ObjectId;
  score: number;
  distance: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  photo: PopulatedPhoto;
  descriptor?: number[];
}

/**
 * Deduplicate search results keeping the one with the highest match score (closest distance)
 */
function deduplicateByPhotoId(records: FaceSearchResult[]): FaceSearchResult[] {
  const seen = new Set<string>();
  const unique: FaceSearchResult[] = [];
  for (const r of records) {
    const pId = r.photo?._id?.toString() || r.photoId?.toString();
    if (pId && !seen.has(pId)) {
      seen.add(pId);
      unique.push(r);
    }
  }
  return unique;
}

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}
