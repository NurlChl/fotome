import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { FaceDescriptor, FaceSearch } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { faceSearchSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
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

    const { descriptor, eventId, threshold } = result.data;

    await connectDB();

    // Use MongoDB Atlas Vector Search
    // This requires a vector search index named "face_vector_index"
    // on the FaceDescriptor collection
    let matchingFaces;

    try {
      matchingFaces = await FaceDescriptor.aggregate([
        {
          $vectorSearch: {
            index: 'face_vector_index',
            path: 'descriptor',
            queryVector: descriptor,
            numCandidates: 200,
            limit: 50,
            filter: {
              eventId: new mongoose.Types.ObjectId(eventId),
            },
          },
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' },
          },
        },
        {
          $match: {
            score: { $gte: threshold },
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
            score: 1,
            boundingBox: 1,
            photo: {
              _id: 1,
              watermarkedUrl: 1,
              thumbnailUrl: 1,
              width: 1,
              height: 1,
            },
          },
        },
        {
          $sort: { score: -1 },
        },
      ]);
    } catch (vectorSearchError) {
      // Fallback: if vector search index doesn't exist, use cosine similarity manually
      console.warn(
        'Vector search failed, using fallback cosine similarity:',
        vectorSearchError
      );
      matchingFaces = await fallbackFaceSearch(descriptor, eventId, threshold);
    }

    // Log the search for analytics
    await FaceSearch.create({
      userId: session?.user?.id || undefined,
      eventId,
      resultsCount: matchingFaces.length,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      results: matchingFaces,
      count: matchingFaces.length,
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
 * Fallback cosine similarity search when Atlas Vector Search is not available
 * This is slower but works with any MongoDB instance
 */
async function fallbackFaceSearch(
  queryDescriptor: number[],
  eventId: string,
  threshold: number
) {
  const faceDescriptors = await FaceDescriptor.find({
    eventId: new mongoose.Types.ObjectId(eventId),
  })
    .populate({
      path: 'photoId',
      match: { status: 'active' },
      select: 'watermarkedUrl thumbnailUrl width height',
    })
    .lean();

  // Calculate cosine similarity
  const results = faceDescriptors
    .filter((fd) => fd.photoId) // Only include faces with active photos
    .map((fd) => {
      const score = cosineSimilarity(queryDescriptor, fd.descriptor);
      return {
        _id: fd._id,
        photoId: fd.photoId,
        score,
        boundingBox: fd.boundingBox,
        photo: fd.photoId,
      };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return results;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
