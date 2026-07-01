import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { User, Event, Photo, Order, OrderItem, Payout } from '@/lib/db/models';
import { auth } from '@/lib/auth';

interface AdminDashboardEvent {
  _id: unknown;
  photographerId?: {
    name: string;
    email: string;
  } | null;
  title: string;
  slug: string;
  category: string;
  status: string;
  photoCount: number;
  pricePerPhoto: number;
  eventDate: Date | string;
  soldCount?: number;
  revenue?: number;
}

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

    const usersSearch = searchParams.get('usersSearch') || '';
    const usersRole = searchParams.get('usersRole') || '';
    const eventsSearch = searchParams.get('eventsSearch') || '';
    const eventsStatus = searchParams.get('eventsStatus') || '';
    const eventsCategory = searchParams.get('eventsCategory') || '';

    const usersSkip = (usersPage - 1) * usersLimit;
    const eventsSkip = (eventsPage - 1) * eventsLimit;

    const usersQuery: Record<string, unknown> = {};
    if (usersSearch) {
      usersQuery.$or = [
        { name: { $regex: usersSearch, $options: 'i' } },
        { email: { $regex: usersSearch, $options: 'i' } }
      ];
    }
    if (usersRole) {
      usersQuery.role = usersRole;
    }

    const eventsQuery: Record<string, unknown> = {};
    if (eventsSearch) {
      eventsQuery.$or = [
        { title: { $regex: eventsSearch, $options: 'i' } },
        { slug: { $regex: eventsSearch, $options: 'i' } },
        { category: { $regex: eventsSearch, $options: 'i' } }
      ];
    }
    if (eventsStatus) {
      eventsQuery.status = eventsStatus;
    }
    if (eventsCategory) {
      eventsQuery.category = eventsCategory;
    }

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
      ? User.find(usersQuery)
          .select('-passwordHash')
          .sort({ createdAt: -1 })
          .skip(usersSkip)
          .limit(usersLimit)
          .lean()
      : Promise.resolve([]);

    const usersTotalPromise = canManageUsers ? User.countDocuments(usersQuery) : Promise.resolve(0);

    const payoutsPromise = canManagePayouts
      ? Payout.find({ status: 'pending' })
          .populate('photographerId', 'name email')
          .sort({ requestedAt: -1 })
          .limit(100)
          .lean()
      : Promise.resolve([]);

    const eventsPromise = canManageEvents
      ? Event.find(eventsQuery)
          .populate('photographerId', 'name email')
          .sort({ createdAt: -1 })
          .skip(eventsSkip)
          .limit(eventsLimit)
          .lean()
      : Promise.resolve([]);

    const eventsTotalPromise = canManageEvents ? Event.countDocuments(eventsQuery) : Promise.resolve(0);

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

    let eventsWithSales: AdminDashboardEvent[] = [];
    if (events && events.length > 0) {
      const eventIds = events.map((e) => e._id);
      const paidOrders = await Order.find({ status: 'paid' }).distinct('_id');
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

      eventsWithSales = (events as unknown as AdminDashboardEvent[]).map((event) => {
        const stats = salesMap[String(event._id)] || { soldCount: 0, revenue: 0 };
        return {
          ...event,
          soldCount: stats.soldCount,
          revenue: stats.revenue,
        };
      });
    }

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
      events: eventsWithSales,
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
