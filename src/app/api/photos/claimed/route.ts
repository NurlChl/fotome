import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { ClaimedPhoto, Photo, Event } from '@/lib/db/models';
import { auth } from '@/lib/auth';

/**
 * GET /api/photos/claimed - Get all photos claimed by the current user
 * These are auto-saved when user claims a photo and grant automatic access
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = req.nextUrl;
    const eventId = searchParams.get('eventId');

    // Build query
    const query: any = { userId: session.user.id };
    if (eventId) {
      query.eventId = eventId;
    }

    // Get claimed photos
    const claimedPhotos = await ClaimedPhoto.find(query)
      .populate({
        path: 'photoId',
        select: 'watermarkedUrl thumbnailUrl width height faceCount hasFaces createdAt',
      })
      .populate({
        path: 'eventId',
        select: 'title slug',
      })
      .sort({ claimedAt: -1 })
      .lean();

    return NextResponse.json({
      claimedPhotos,
      count: claimedPhotos.length,
    });
  } catch (error) {
    console.error('Error fetching claimed photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
