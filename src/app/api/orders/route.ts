import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order, OrderItem, Photo, Event } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { createOrderSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/orders - List user's orders
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const orders = await Order.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await OrderItem.find({ orderId: order._id })
          .populate('photoId', 'thumbnailUrl watermarkedUrl')
          .populate('eventId', 'title slug')
          .lean();
        return { ...order, items };
      })
    );

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders - Create new order
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = createOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { photoIds, eventId } = result.data;

    await connectDB();

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get photos and verify they belong to the event
    const photos = await Photo.find({
      _id: { $in: photoIds },
      eventId,
      status: 'active',
    });

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'No valid photos found' },
        { status: 400 }
      );
    }

    // Check if user already purchased any of these photos
    const existingItems = await OrderItem.find({
      photoId: { $in: photoIds },
      orderId: {
        $in: await Order.find({
          userId: session.user.id,
          status: 'paid',
        }).distinct('_id'),
      },
    });

    const alreadyPurchasedIds = new Set(
      existingItems.map((item) => item.photoId.toString())
    );

    const newPhotos = photos.filter(
      (p) => !alreadyPurchasedIds.has(p._id.toString())
    );

    if (newPhotos.length === 0) {
      return NextResponse.json(
        { error: 'You have already purchased all selected photos' },
        { status: 400 }
      );
    }

    // Calculate total
    const commissionPercent =
      parseInt(process.env.PLATFORM_COMMISSION_PERCENT || '25') / 100;

    const totalAmount = newPhotos.length * event.pricePerPhoto;

    // Create order
    const order = await Order.create({
      userId: session.user.id,
      totalAmount,
      status: 'pending',
    });

    // Create order items
    const orderItems = newPhotos.map((photo) => ({
      orderId: order._id,
      photoId: photo._id,
      eventId: event._id,
      photographerId: event.photographerId,
      price: event.pricePerPhoto,
      platformFee: Math.round(event.pricePerPhoto * commissionPercent),
      photographerRevenue: Math.round(
        event.pricePerPhoto * (1 - commissionPercent)
      ),
    }));

    await OrderItem.insertMany(orderItems);

    // In production, generate Midtrans snap token here
    // For now, return order details
    // const snapToken = await createMidtransTransaction(order, session.user);

    return NextResponse.json(
      {
        message: 'Order created',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          itemCount: newPhotos.length,
          status: order.status,
          // snapToken,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
