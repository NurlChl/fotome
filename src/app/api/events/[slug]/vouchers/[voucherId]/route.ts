import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, Voucher } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { voucherSchema } from '@/lib/validation';

// PUT /api/events/[slug]/vouchers/[voucherId] - update voucher
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; voucherId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, voucherId } = await params;
    const body = await req.json();
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
        { error: 'You can only edit your own events' },
        { status: 403 }
      );
    }

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    // Check if voucher belongs to event
    if (voucher.eventId.toString() !== event._id.toString()) {
      return NextResponse.json(
        { error: 'Voucher does not belong to this event' },
        { status: 403 }
      );
    }

    // Validate voucher data
    const result = voucherSchema.partial().safeParse(body);
    if (!result.success) {
      const errorDetails = result.error.flatten().fieldErrors;
      const firstError = Object.values(errorDetails).find(Boolean);
      return NextResponse.json(
        { error: firstError ? firstError[0] : 'Validation error' },
        { status: 400 }
      );
    }

    // Update voucher
    Object.assign(voucher, body);
    await voucher.save();

    return NextResponse.json({ voucher });
  } catch (error) {
    console.error('Error updating voucher:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[slug]/vouchers/[voucherId] - delete voucher
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; voucherId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, voucherId } = await params;
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
        { error: 'You can only edit your own events' },
        { status: 403 }
      );
    }

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    // Check if voucher belongs to event
    if (voucher.eventId.toString() !== event._id.toString()) {
      return NextResponse.json(
        { error: 'Voucher does not belong to this event' },
        { status: 403 }
      );
    }

    await voucher.deleteOne();
    return NextResponse.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Error deleting voucher:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
