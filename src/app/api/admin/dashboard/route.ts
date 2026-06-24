import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, Event, Photo, Order, OrderItem, Payout } from '@/lib/db/models';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/dashboard - Fetch admin dashboard stats and pending payouts
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If role is admin, ensure they have at least one valid permission
    if (session.user.role === 'admin') {
      const p = session.user.permissions;
      if (!p || (!p.manageUsers && !p.manageEvents && !p.managePayouts)) {
        return NextResponse.json({ error: 'Forbidden: No admin permissions assigned' }, { status: 403 });
      }
    }

    await connectDB();

    // 1. Core platform metrics
    const [totalUsers, totalPhotographers, totalEvents, totalPhotos] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'photographer' }),
      Event.countDocuments({}),
      Photo.countDocuments({ status: 'active' }),
    ]);

    // 2. Platform revenue (platform fees from paid orders)
    const paidOrders = await Order.find({ status: 'paid' }).distinct('_id');
    const revenueStats = await OrderItem.aggregate([
      {
        $match: {
          orderId: { $in: paidOrders },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$price' },
          platformFees: { $sum: '$platformFee' },
        },
      },
    ]);

    const grossSales = revenueStats[0]?.totalSales || 0;
    const platformRevenue = revenueStats[0]?.platformFees || 0;

    // 3. Payout status
    const payoutStats = await Payout.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const pendingPayouts = payoutStats.find((p) => p._id === 'pending')?.total || 0;
    const completedPayouts = payoutStats.find((p) => p._id === 'completed')?.total || 0;

    // 4. Fetch list of recent users
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(50) // limit to 50 for admin users list
      .lean();

    // 5. Fetch pending payouts to display
    const payouts = await Payout.find({ status: 'pending' })
      .populate('photographerId', 'name email')
      .sort({ requestedAt: -1 })
      .lean();

    // 6. Fetch all events for events tab
    const events = await Event.find({})
      .populate('photographerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      stats: {
        totalUsers,
        totalPhotographers,
        totalEvents,
        totalPhotos,
        grossSales,
        platformRevenue,
        pendingPayouts,
        completedPayouts,
      },
      users,
      payouts,
      events,
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
