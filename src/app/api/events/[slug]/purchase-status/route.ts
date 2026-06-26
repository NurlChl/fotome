import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, Order, OrderItem } from '@/lib/db/models';
import { auth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/events/[slug]/purchase-status
 * Returns photo IDs that the current user has already purchased or has in a pending order for this event.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    await connectDB();

    const event = await Event.findOne({ slug }).select('_id');
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const photoIds = searchParams.get('photoIds')?.split(',').filter(Boolean) || [];

    const orderQuery: Record<string, unknown> = {
      userId: session.user.id,
      status: { $in: ['paid', 'pending'] },
    };

    const orders = await Order.find(orderQuery).select('_id status').lean();
    const orderIds = orders.map((o) => o._id);

    const itemQuery: Record<string, unknown> = {
      orderId: { $in: orderIds },
      eventId: event._id,
    };

    if (photoIds.length > 0) {
      itemQuery.photoId = { $in: photoIds };
    }

    const items = await OrderItem.find(itemQuery)
      .populate('photoId', '_id')
      .lean();

    const purchased: string[] = [];
    const pending: string[] = [];
    const pendingOrderMap: Record<string, { orderId: string; orderNumber: string }> = {};

    const orderMap = new Map(
      orders.map((o) => [o._id.toString(), { status: o.status, orderNumber: o.orderNumber, orderId: o._id.toString() }])
    );

    for (const item of items) {
      const photoId = (item.photoId as unknown as { _id: string })?._id?.toString();
      if (!photoId) continue;

      const order = orderMap.get(item.orderId.toString());
      if (!order) continue;

      if (order.status === 'paid') {
        if (!purchased.includes(photoId)) purchased.push(photoId);
      } else if (order.status === 'pending') {
        if (!pending.includes(photoId)) {
          pending.push(photoId);
          pendingOrderMap[photoId] = { orderId: order.orderId, orderNumber: order.orderNumber };
        }
      }
    }

    return NextResponse.json({
      purchased,
      pending,
      pendingOrderMap,
    });
  } catch (error) {
    console.error('Error fetching purchase status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
