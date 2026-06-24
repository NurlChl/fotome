import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, OrderItem, Order, User } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import mongoose from 'mongoose';

/**
 * GET /api/photographer/dashboard - Fetch photographer's dashboard stats and events
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'photographer' && session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photographerId = new mongoose.Types.ObjectId(session.user.id);
    await connectDB();

    // 1. Get user available balance
    const user = await User.findById(photographerId).select('photographerProfile');
    const availableBalance = user?.photographerProfile?.availableBalance || 0;

    // 2. Get total events
    const totalEvents = await Event.countDocuments({ photographerId });

    // 3. Get active events (published)
    const activeEvents = await Event.countDocuments({ photographerId, status: 'published' });

    // 4. Find paid orders
    const paidOrders = await Order.find({ status: 'paid' }).distinct('_id');

    // 5. Get total photos sold & photographer revenue
    const salesStats = await OrderItem.aggregate([
      {
        $match: {
          photographerId,
          orderId: { $in: paidOrders },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$photographerRevenue' },
          photosSold: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = salesStats[0]?.totalRevenue || 0;
    const photosSold = salesStats[0]?.photosSold || 0;

    // 6. Get recent events with photo counts and sales count
    const events = await Event.find({ photographerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const eventsWithSales = await Promise.all(
      events.map(async (event) => {
        const soldCount = await OrderItem.countDocuments({
          eventId: event._id,
          orderId: { $in: paidOrders },
        });

        // Calculate event revenue
        const eventSales = await OrderItem.aggregate([
          {
            $match: {
              eventId: event._id,
              orderId: { $in: paidOrders },
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$photographerRevenue' },
            },
          },
        ]);
        const eventRevenue = eventSales[0]?.revenue || 0;

        return {
          ...event,
          soldCount,
          revenue: eventRevenue,
        };
      })
    );

    return NextResponse.json({
      stats: {
        totalRevenue,
        photosSold,
        activeEvents,
        totalEvents,
        availableBalance,
      },
      events: eventsWithSales,
    });
  } catch (error) {
    console.error('Error fetching photographer dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
