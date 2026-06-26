import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order } from '@/lib/db/models';
import { getTransactionStatus, mapMidtransStatus } from '@/lib/midtrans';
import { auth } from '@/lib/auth';

/**
 * GET /api/orders/[orderId]/sync-payment
 * Sync payment status with Midtrans for a specific order
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { orderId } = await params;
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only sync if order is pending and has a Midtrans order number
    if (order.status !== 'pending' || !order.orderNumber) {
      return NextResponse.json({
        success: true,
        message: 'Order is not pending or has no order number',
        order: {
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      });
    }

    // Get transaction status from Midtrans
    const midtransStatus = await getTransactionStatus(order.orderNumber);

    // Map Midtrans status to our order status
    const { paymentStatus, shouldProcess } = mapMidtransStatus(
      midtransStatus.transactionStatus,
      midtransStatus.fraudStatus
    );

    // Update order if status changed
    const updateData: any = {
      paymentStatus,
      midtransTransactionStatus: midtransStatus.transactionStatus,
      midtransFraudStatus: midtransStatus.fraudStatus,
      midtransPaymentType: midtransStatus.paymentType,
      midtransTransactionTime: midtransStatus.transactionTime,
    };

    if (shouldProcess && paymentStatus === 'completed') {
      updateData.status = 'paid';
      updateData.paidAt = midtransStatus.settlementTime || midtransStatus.transactionTime || new Date();
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || midtransStatus.transactionStatus === 'expire') {
      updateData.status = 'cancelled';
    }

    await Order.findByIdAndUpdate(order._id, updateData);

    return NextResponse.json({
      success: true,
      message: 'Payment status synced',
      order: {
        status: updateData.status || order.status,
        paymentStatus: updateData.paymentStatus || order.paymentStatus,
      },
    });
  } catch (error) {
    console.error('Error syncing payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
