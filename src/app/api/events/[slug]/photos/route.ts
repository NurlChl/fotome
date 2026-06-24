import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, Photo, FaceDescriptor } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  uploadEventPhoto,
  getWatermarkedUrl,
  getThumbnailUrl,
} from '@/lib/cloudinary';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/events/[slug]/photos - List event photos (watermarked previews)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    await connectDB();

    const event = await Event.findOne({ slug });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      Photo.find({ eventId: event._id, status: 'active' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('watermarkedUrl thumbnailUrl width height faceCount createdAt')
        .lean(),
      Photo.countDocuments({ eventId: event._id, status: 'active' }),
    ]);

    return NextResponse.json({
      photos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[slug]/photos - Upload photos to event (photographer only)
 * Accepts multipart/form-data with multiple images
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const rateLimited = checkRateLimit(req, 'upload');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    await connectDB();

    const event = await Event.findOne({ slug });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check ownership
    if (
      event.photographerId.toString() !== session.user.id &&
      session.user.role !== 'admin' &&
      session.user.role !== 'superadmin'
    ) {
      return NextResponse.json(
        { error: 'You can only upload to your own events' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll('photos') as File[];
    const facesDataStr = formData.get('facesData') as string || '{}';
    let facesData: Record<string, { descriptor: number[], boundingBox: unknown }[]> = {};
    try {
      facesData = JSON.parse(facesDataStr);
    } catch (e) {
      console.warn('Failed to parse facesData:', e);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided' },
        { status: 400 }
      );
    }

    if (files.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 photos per upload batch' },
        { status: 400 }
      );
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPEG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Maximum file size is 20MB per photo' },
          { status: 400 }
        );
      }
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Cloudinary with face detection
        const cloudinaryResult = await uploadEventPhoto(
          buffer,
          slug,
          session.user.id
        );

        const clientFaces = facesData[file.name] || [];
        const hasFaces = clientFaces.length > 0 || (cloudinaryResult.faces && cloudinaryResult.faces.length > 0);
        const faceCount = clientFaces.length > 0 ? clientFaces.length : (cloudinaryResult.faces?.length || 0);

        // Create photo record
        const photo = await Photo.create({
          eventId: event._id,
          photographerId: session.user.id,
          cloudinaryPublicId: cloudinaryResult.public_id,
          cloudinaryUrl: cloudinaryResult.secure_url,
          watermarkedUrl: getWatermarkedUrl(cloudinaryResult.public_id),
          thumbnailUrl: getThumbnailUrl(cloudinaryResult.public_id),
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          hasFaces,
          faceCount,
          status: 'active',
          metadata: {
            takenAt: cloudinaryResult.created_at
              ? new Date(cloudinaryResult.created_at)
              : undefined,
          },
        });

        // Store descriptors in database
        if (clientFaces.length > 0) {
          const faceDescriptors = clientFaces.map(
            (face: { descriptor: number[], boundingBox: unknown }, index: number) => ({
              photoId: photo._id,
              eventId: event._id,
              descriptor: face.descriptor,
              boundingBox: face.boundingBox,
              faceIndex: index,
            })
          );
          await FaceDescriptor.insertMany(faceDescriptors);
        } else if (cloudinaryResult.faces && cloudinaryResult.faces.length > 0) {
          const faceDescriptors = cloudinaryResult.faces.map(
            (face: number[], index: number) => ({
              photoId: photo._id,
              eventId: event._id,
              descriptor: new Array(128).fill(0),
              boundingBox: {
                x: face[0],
                y: face[1],
                width: face[2],
                height: face[3],
              },
              faceIndex: index,
            })
          );
          await FaceDescriptor.insertMany(faceDescriptors);
        }

        uploadResults.push({
          id: photo._id,
          status: 'success',
          filename: file.name,
          faceCount: cloudinaryResult.faces?.length || 0,
        });
      } catch (uploadError) {
        console.error(`Failed to upload ${file.name}:`, uploadError);
        uploadResults.push({
          status: 'failed',
          filename: file.name,
          error: 'Upload failed',
        });
      }
    }

    // Update photo count on event
    const activePhotoCount = await Photo.countDocuments({
      eventId: event._id,
      status: 'active',
    });
    event.photoCount = activePhotoCount;
    await event.save();

    const successCount = uploadResults.filter(
      (r) => r.status === 'success'
    ).length;

    return NextResponse.json(
      {
        message: `${successCount}/${files.length} photos uploaded successfully`,
        results: uploadResults,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
