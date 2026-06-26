import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, Voucher, VoucherUsage } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { voucherSchema } from '@/lib/validation';

// GET /api/events/[slug]/vouchers - get all vouchers for event
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await connectDB();

    const event = await Event.findOne({ slug });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const vouchers = await Voucher.find({ eventId: event._id }).sort({ createdAt: -1 });

    // Check if user is photographer or admin - if not, only show published vouchers
    const session = await auth();
    if (
      session?.user?.id !== event.photographerId.toString() &&
      session?.user?.role !== 'admin' &&
      session?.user?.role !== 'superadmin'
    ) {
      // Only show published vouchers for regular users
      const publishedVouchers = vouchers.filter(v => v.status === 'published');
      
      // For each published voucher, check if it's usable by current user
      if (session?.user?.id) {
        const limitedVoucherIds = publishedVouchers
          .filter((v) => !!v.usageLimitPerUser)
          .map((v) => v._id);

        const usageByVoucherId = new Map<string, number>();
        if (limitedVoucherIds.length > 0) {
          const usageCounts = await VoucherUsage.aggregate([
            {
              $match: {
                voucherId: { $in: limitedVoucherIds },
                userId: session.user.id,
              },
            },
            {
              $group: {
                _id: '$voucherId',
                count: { $sum: 1 },
              },
            },
          ]);
          for (const row of usageCounts) {
            usageByVoucherId.set(row._id.toString(), row.count);
          }
        }

        const usableVouchers = publishedVouchers.filter((voucher) => {
          if (voucher.allowedUserIds && voucher.allowedUserIds.length > 0) {
            if (!voucher.allowedUserIds.some((id) => id.toString() === session.user.id)) {
              return false;
            }
          }

          if (voucher.usageLimitPerUser) {
            const usageCount = usageByVoucherId.get(voucher._id.toString()) || 0;
            if (usageCount >= voucher.usageLimitPerUser) {
              return false;
            }
          }

          return true;
        });
        return NextResponse.json({ vouchers: usableVouchers });
      }

      return NextResponse.json({ vouchers: publishedVouchers });
    }

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/events/[slug]/vouchers - create a new voucher
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await req.json();
    await connectDB();

    const event = await Event.findOne({ slug });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check ownership
    if (
      event.photographerId.toString() !== session.user.id &&
      session.user.role !== 'superadmin' &&
      !(session.user.role === 'admin' && session.user.permissions?.manageEvents)
    ) {
      return NextResponse.json(
        { error: 'You can only edit your own events' },
        { status: 403 }
      );
    }

    // Check if event has paid photos (pricePerPhoto > 0)
    if (event.pricePerPhoto <= 0) {
      return NextResponse.json(
        { error: 'Vouchers can only be created for events with paid photos' },
        { status: 400 }
      );
    }

    // Validate voucher data
    const result = voucherSchema.safeParse(body);
    if (!result.success) {
      const errorDetails = result.error.flatten().fieldErrors;
      const firstError = Object.values(errorDetails).find(Boolean);
      return NextResponse.json(
        { error: firstError ? firstError[0] : 'Validation error' },
        { status: 400 }
      );
    }

    const voucher = new Voucher({
      eventId: event._id,
      name: body.name,
      description: body.description,
      usageLimitPerUser: body.usageLimitPerUser || null,
      allowedUserIds: body.allowedUserIds || [],
      minPhotos: body.minPhotos || 1,
      discountType: body.discountType,
      discountValue: body.discountValue,
      status: body.status || 'draft',
    });

    await voucher.save();
    return NextResponse.json({ voucher });
  } catch (error) {
    console.error('Error creating voucher:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
