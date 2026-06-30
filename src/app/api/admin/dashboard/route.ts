import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, Event, Photo, Order, OrderItem, Payout } from '@/lib/db/models';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/dashboard - Fetch admin dashboard stats and pending payouts
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isSuperadmin = session.user.role === 'superadmin';
    const p = session.user.permissions;
    const canManageUsers = isSuperadmin || !!p?.manageUsers;
    const canManageEvents = isSuperadmin || !!p?.manageEvents;
    const canManagePayouts = isSuperadmin || !!p?.managePayouts;
    const canManageTransactions = isSuperadmin || !!p?.manageTransactions;
    const canManageClaims = isSuperadmin || !!p?.manageClaims;
    const canManageLogs = isSuperadmin || !!p?.manageLogs;
    const canManageCategories = isSuperadmin || !!p?.manageCategories;

    if (
      !canManageUsers &&
      !canManageEvents &&
      !canManagePayouts &&
      !canManageTransactions &&
      !canManageClaims &&
      !canManageLogs &&
      !canManageCategories
    ) {
      return NextResponse.json({ error: 'Forbidden: No admin permissions assigned' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const usersPage = Math.max(1, parseInt(searchParams.get('usersPage') || '1'));
    const usersLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('usersLimit') || '50')));
    const eventsPage = Math.max(1, parseInt(searchParams.get('eventsPage') || '1'));
    const eventsLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('eventsLimit') || '50')));

    const usersSkip = (usersPage - 1) * usersLimit;
    const eventsSkip = (eventsPage - 1) * eventsLimit;

    // 1. Core platform metrics
    const [totalUsers, totalPhotographers, totalEvents, totalPhotos] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'photographer' }),
      Event.countDocuments({}),
      Photo.countDocuments({ status: 'active' }),
    ]);

    // 2. Platform revenue (platform fees from paid orders)
    const revenuePromise = canManagePayouts
      ? (async () => {
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
          return {
            grossSales: revenueStats[0]?.totalSales || 0,
            platformRevenue: revenueStats[0]?.platformFees || 0,
          };
        })()
      : Promise.resolve({ grossSales: 0, platformRevenue: 0 });

    // 3. Payout status
    const payoutStatsPromise = canManagePayouts
      ? Payout.aggregate([
          {
            $group: {
              _id: '$status',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
      : Promise.resolve([]);

    const usersPromise = canManageUsers
      ? User.find({})
          .select('-passwordHash')
          .sort({ createdAt: -1 })
          .skip(usersSkip)
          .limit(usersLimit)
          .lean()
      : Promise.resolve([]);

    const usersTotalPromise = canManageUsers ? User.countDocuments({}) : Promise.resolve(0);

    const payoutsPromise = canManagePayouts
      ? Payout.find({ status: 'pending' })
          .populate('photographerId', 'name email')
          .sort({ requestedAt: -1 })
          .limit(100)
          .lean()
      : Promise.resolve([]);

    const eventsPromise = canManageEvents
      ? Event.find({})
          .populate('photographerId', 'name email')
          .sort({ createdAt: -1 })
          .skip(eventsSkip)
          .limit(eventsLimit)
          .lean()
      : Promise.resolve([]);

    const eventsTotalPromise = canManageEvents ? Event.countDocuments({}) : Promise.resolve(0);

    const [{ grossSales, platformRevenue }, payoutStats, users, usersTotal, payouts, events, eventsTotal] =
      await Promise.all([
        revenuePromise,
        payoutStatsPromise,
        usersPromise,
        usersTotalPromise,
        payoutsPromise,
        eventsPromise,
        eventsTotalPromise,
      ]);

    const pendingPayouts = (payoutStats as { _id: string; total: number }[]).find((p) => p._id === 'pending')?.total || 0;
    const completedPayouts = (payoutStats as { _id: string; total: number }[]).find((p) => p._id === 'completed')?.total || 0;

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
      pagination: {
        users: {
          page: usersPage,
          limit: usersLimit,
          total: usersTotal,
          totalPages: usersLimit > 0 ? Math.ceil(usersTotal / usersLimit) : 0,
          hasMore: usersSkip + usersLimit < usersTotal,
        },
        events: {
          page: eventsPage,
          limit: eventsLimit,
          total: eventsTotal,
          totalPages: eventsLimit > 0 ? Math.ceil(eventsTotal / eventsLimit) : 0,
          hasMore: eventsSkip + eventsLimit < eventsTotal,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
