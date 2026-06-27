import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order, OrderItem, ActivityLog } from '@/lib/db/models';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (role === 'admin' && !session.user.permissions?.managePayouts) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    // 1. Fetch Purchases grouped by Order
    const [paidOrders, totalPaidOrders] = await Promise.all([
      Order.find({ status: 'paid' })
        .populate({
          path: 'userId',
          select: 'name email',
        })
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ status: 'paid' }),
    ]);

    const paidOrderIds = paidOrders.map((o) => o._id);
    const orderMap = new Map(paidOrders.map((o) => [o._id.toString(), o]));

    const orderItems = await OrderItem.find({ orderId: { $in: paidOrderIds } })
      .populate({
        path: 'photoId',
        select: 'thumbnailUrl watermarkedUrl',
      })
      .populate({
        path: 'eventId',
        select: 'title slug',
      })
      .lean();

    // Group items by order
    const itemsTyped = orderItems as unknown as Record<string, unknown>[];
    const groupedByOrder = new Map<string, Record<string, unknown>[]>();
    for (const item of itemsTyped) {
      const orderIdStr = (item.orderId as string).toString();
      if (!groupedByOrder.has(orderIdStr)) {
        groupedByOrder.set(orderIdStr, []);
      }
      groupedByOrder.get(orderIdStr)!.push(item);
    }

    const purchases = Array.from(groupedByOrder.entries())
      .map(([orderIdStr, items]) => {
        const order = orderMap.get(orderIdStr);
        if (!order) return null;

        const photos = items
          .map((item) => item.photoId as { _id: string; thumbnailUrl: string; watermarkedUrl: string } | undefined)
          .filter((photo): photo is { _id: string; thumbnailUrl: string; watermarkedUrl: string } => !!photo);

        const firstEvent = items.find((item) => item.eventId)?.eventId as { _id: string; title: string; slug: string } | null | undefined;

        return {
          _id: orderIdStr,
          orderNumber: (order.orderNumber as string) || '-',
          userId: (order.userId as unknown as { _id: string; name: string; email: string } | null) || null,
          eventId: firstEvent || null,
          totalAmount: (order.totalAmount as number) || 0,
          paidAt: (order.paidAt as Date) || (order.updatedAt as Date) || new Date(),
          photos,
          photoCount: photos.length,
        };
      })
      .filter((purchase): purchase is NonNullable<typeof purchase> => purchase !== null)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    // 2. Fetch Downloads (DOWNLOAD_PHOTO action logs)
    const downloadLogs = await ActivityLog.find({ action: 'DOWNLOAD_PHOTO' })
      .populate({
        path: 'userId',
        select: 'name email',
      })
      .populate({
        path: 'photoId',
        select: 'thumbnailUrl watermarkedUrl',
      })
      .populate({
        path: 'eventId',
        select: 'title slug',
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const logsTyped = downloadLogs as unknown as Record<string, unknown>[];
    const downloads = logsTyped.map((log) => ({
      _id: (log._id as string).toString(),
      userId: log.userId as { _id: string; name: string; email: string } | null | undefined || null,
      photoId: log.photoId as { _id: string; thumbnailUrl: string; watermarkedUrl: string } | null | undefined || null,
      eventId: log.eventId as { _id: string; title: string; slug: string } | null | undefined || null,
      ipAddress: (log.ipAddress as string) || '-',
      details: (log.details as string) || '',
      downloadedAt: (log.createdAt as string) || new Date(),
    }));

    return NextResponse.json({
      success: true,
      purchases,
      downloads,
      pagination: {
        page,
        limit,
        total: totalPaidOrders,
        totalPages: Math.ceil(totalPaidOrders / limit),
        hasMore: skip + limit < totalPaidOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
