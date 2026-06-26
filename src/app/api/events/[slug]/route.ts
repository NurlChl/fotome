import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, Photo } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { updateEventSchema } from '@/lib/validation';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/events/[slug] - Get single event details
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    await connectDB();

    const event = await Event.findOne({ slug })
      .populate('photographerId', 'name avatar photographerProfile.bio')
      .lean();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get photo count
    const photoCount = await Photo.countDocuments({
      eventId: event._id,
      status: 'active',
    });

    return NextResponse.json({
      event: { ...event, photoCount },
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[slug] - Update event (owner only)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const contentType = req.headers.get('content-type') || '';

    await connectDB();

    const event = await Event.findOne({ slug });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check ownership
    const isOwner = event.photographerId.toString() === session.user.id;
    const isSuperadmin = session.user.role === 'superadmin';
    const canManageEvents =
      session.user.role === 'admin' && !!session.user.permissions?.manageEvents;

    if (!isOwner && !isSuperadmin && !canManageEvents) {
      return NextResponse.json(
        { error: 'You can only edit your own events' },
        { status: 403 }
      );
    }

    // Handle file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const coverImageFile = formData.get('coverImage') as File;

      if (coverImageFile) {
        // Validate file
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(coverImageFile.type)) {
          return NextResponse.json(
            { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
            { status: 400 }
          );
        }
        if (coverImageFile.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Maximum file size is 5MB' },
            { status: 400 }
          );
        }

        // Upload to Cloudinary
        const arrayBuffer = await coverImageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const { uploadEventPhoto } = await import('@/lib/cloudinary');
        const cloudinaryResult = await uploadEventPhoto(
          buffer,
          slug,
          session.user.id
        );

        event.coverImage = cloudinaryResult.secure_url;
        await event.save();

        return NextResponse.json({
          message: 'Cover image updated successfully',
          event,
        });
      }
    }

    // Handle JSON update
    const body = await req.json();
    const result = updateEventSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Update event
    Object.assign(event, result.data);
    if (result.data.eventDate) {
      event.eventDate = new Date(result.data.eventDate);
    }
    await event.save();

    return NextResponse.json({
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[slug] - Delete event (owner only)
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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

    if (
      event.photographerId.toString() !== session.user.id &&
      session.user.role !== 'superadmin' &&
      !(session.user.role === 'admin' && session.user.permissions?.manageEvents)
    ) {
      return NextResponse.json(
        { error: 'You can only delete your own events' },
        { status: 403 }
      );
    }

    // Soft delete: archive instead of hard delete
    event.status = 'archived';
    await event.save();

    return NextResponse.json({ message: 'Event archived successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
