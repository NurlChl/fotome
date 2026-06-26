import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { SavedPhoto, ClaimedPhoto, Photo, Event } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import mongoose from 'mongoose';

/**
 * GET /api/photos/saved - Get all saved photos for the current user
 * Includes both SavedPhoto and ClaimedPhoto (combined as "Tersimpan")
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
    const query: any = { userId: new mongoose.Types.ObjectId(session.user.id) };
    if (eventId) {
      query.eventId = new mongoose.Types.ObjectId(eventId);
    }

    // Get saved photos
    const savedPhotos = await SavedPhoto.find(query)
      .populate({
        path: 'photoId',
        select: 'watermarkedUrl thumbnailUrl width height faceCount hasFaces createdAt',
      })
      .populate({
        path: 'eventId',
        select: 'title slug',
      })
      .sort({ savedAt: -1 })
      .lean();

    // Get claimed photos (also part of "Tersimpan" collection)
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

    // Combine and deduplicate by photoId
    const photoMap = new Map();
    
    // Add saved photos
    for (const item of savedPhotos) {
      const photoId = item.photoId?._id?.toString() || item.photoId?.toString();
      if (photoId && !photoMap.has(photoId)) {
        photoMap.set(photoId, {
          ...item,
          type: 'saved',
          savedAt: item.savedAt,
        });
      }
    }

    // Add claimed photos (if not already in map)
    for (const item of claimedPhotos) {
      const photoId = item.photoId?._id?.toString() || item.photoId?.toString();
      if (photoId && !photoMap.has(photoId)) {
        photoMap.set(photoId, {
          ...item,
          type: 'claimed',
          savedAt: item.claimedAt,
        });
      } else if (photoId && photoMap.has(photoId)) {
        // If photo is both saved and claimed, mark as both
        const existing = photoMap.get(photoId);
        photoMap.set(photoId, {
          ...existing,
          type: 'both',
        });
      }
    }

    const allSavedPhotos = Array.from(photoMap.values()).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );

    return NextResponse.json({
      savedPhotos: allSavedPhotos,
      count: allSavedPhotos.length,
    });
  } catch (error) {
    console.error('Error fetching saved photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/photos/saved - Save a photo to user's collection
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { photoId, eventId } = body;

    if (!photoId || !eventId) {
      return NextResponse.json(
        { error: 'photoId and eventId are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if photo exists
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Save photo (upsert to handle duplicates)
    const savedPhoto = await SavedPhoto.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(session.user.id),
        photoId: new mongoose.Types.ObjectId(photoId),
      },
      {
        userId: new mongoose.Types.ObjectId(session.user.id),
        photoId: new mongoose.Types.ObjectId(photoId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      savedPhoto,
      message: 'Photo saved successfully',
    });
  } catch (error) {
    console.error('Error saving photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/photos/saved - Remove a photo from saved collection
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json(
        { error: 'photoId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await SavedPhoto.findOneAndDelete({
      userId: new mongoose.Types.ObjectId(session.user.id),
      photoId: new mongoose.Types.ObjectId(photoId),
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Saved photo not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Photo removed from saved collection',
    });
  } catch (error) {
    console.error('Error removing saved photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
