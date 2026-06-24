import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Photo, Event, FaceDescriptor } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { deleteImage } from '@/lib/cloudinary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/photos/[id] - Delete an individual event photo (Admin/Superadmin or Event Owner only)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: photoId } = await params;
    await connectDB();

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Get event to verify permissions
    const event = await Event.findById(photo.eventId);
    if (!event) {
      return NextResponse.json({ error: 'Associated event not found' }, { status: 404 });
    }

    const isOwner = event.photographerId.toString() === session.user.id;
    const isAdmin = session.user.role === 'admin' || session.user.role === 'superadmin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Delete image from Cloudinary
    try {
      await deleteImage(photo.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.warn('Failed to delete image from Cloudinary:', cloudinaryError);
      // Continue to delete from DB to prevent broken records
    }

    // 2. Delete all FaceDescriptor records for this photo
    await FaceDescriptor.deleteMany({ photoId: photo._id });

    // 3. Decrement the event's photoCount
    await Event.findByIdAndUpdate(photo.eventId, { $inc: { photoCount: -1 } });

    // 4. Delete the Photo document itself
    await Photo.findByIdAndDelete(photo._id);

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
