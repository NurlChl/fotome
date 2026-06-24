import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order, OrderItem, User } from '@/lib/db/models';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/orders/mock-pay - Simulate payment success for an order
 */
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, 'general');
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Security: Only the owner of the order can pay for it
    if (order.userId.toString() !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.status === 'paid') {
      return NextResponse.json({ message: 'Order is already paid', order });
    }

    // Update order status to paid
    order.status = 'paid';
    order.paidAt = new Date();
    order.midtransTransactionId = 'MOCK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    await order.save();

    // Fetch order items to credit photographers
    const orderItems = await OrderItem.find({ orderId: order._id });

    // Group earnings by photographer
    const photographerEarnings: Record<string, number> = {};
    for (const item of orderItems) {
      const photographerIdStr = item.photographerId.toString();
      photographerEarnings[photographerIdStr] = 
        (photographerEarnings[photographerIdStr] || 0) + item.photographerRevenue;
    }

    // Update photographer balances
    for (const [photographerId, revenue] of Object.entries(photographerEarnings)) {
      await User.findByIdAndUpdate(photographerId, {
        $inc: {
          'photographerProfile.totalRevenue': revenue,
          'photographerProfile.availableBalance': revenue,
        },
      });
    }

    return NextResponse.json({
      message: 'Payment simulated successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        paidAt: order.paidAt,
      },
    });
  } catch (error) {
    console.error('Error simulating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
