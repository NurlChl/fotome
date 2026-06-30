import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Event, OrderItem, Order, User } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import mongoose from 'mongoose';

/**
 * GET /api/photographer/dashboard - Fetch photographer's dashboard stats and events
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'photographer' && session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photographerId = new mongoose.Types.ObjectId(session.user.id);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '5')));
    const skip = (page - 1) * limit;

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

    const events = await Event.find({ photographerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const eventIds = events.map((e) => e._id);

    const salesByEvent = await OrderItem.aggregate([
      {
        $match: {
          eventId: { $in: eventIds },
          orderId: { $in: paidOrders },
        },
      },
      {
        $group: {
          _id: '$eventId',
          soldCount: { $sum: 1 },
          revenue: { $sum: '$photographerRevenue' },
        },
      },
    ]);

    const salesMap = salesByEvent.reduce((acc, item) => {
      if (item._id) {
        acc[item._id.toString()] = {
          soldCount: item.soldCount,
          revenue: item.revenue,
        };
      }
      return acc;
    }, {} as Record<string, { soldCount: number; revenue: number }>);

    const eventsWithSales = events.map((event) => {
      const stats = salesMap[event._id.toString()] || { soldCount: 0, revenue: 0 };
      return {
        ...event,
        soldCount: stats.soldCount,
        revenue: stats.revenue,
      };
    });

    return NextResponse.json({
      stats: {
        totalRevenue,
        photosSold,
        activeEvents,
        totalEvents,
        availableBalance,
      },
      events: eventsWithSales,
      pagination: {
        page,
        limit,
        total: totalEvents,
        totalPages: Math.ceil(totalEvents / limit),
        hasMore: skip + limit < totalEvents,
      },
    });
  } catch (error) {
    console.error('Error fetching photographer dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
