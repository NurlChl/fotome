import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { Order } from '@/lib/db/models';
import { verifySignature, mapMidtransStatus } from '@/lib/midtrans';
import { logActivity } from '@/lib/axiom';

/**
 * POST /api/webhooks/midtrans
 * Midtrans Payment Notification Handler
 * Docs: https://docs.midtrans.com/reference/notification-handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const {
      order_id: orderNumber,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      payment_type: paymentType,
      transaction_time: transactionTime,
      settlement_time: settlementTime,
    } = body;

    console.log('Midtrans webhook received:', {
      orderNumber,
      transactionStatus,
      statusCode,
    });

    // Verify signature for security
    const isValidSignature = verifySignature({
      orderId: orderNumber,
      statusCode,
      grossAmount,
      signatureKey,
    });

    if (!isValidSignature) {
      console.error('Invalid Midtrans signature:', body);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    await connectDB();

    // Find order by orderNumber
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      console.error('Order not found:', orderNumber);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Map Midtrans status to our order status
    const { paymentStatus, shouldProcess } = mapMidtransStatus(
      transactionStatus,
      fraudStatus
    );

    // Update order
    const updateData: any = {
      paymentStatus,
      paymentMethod: paymentType || 'midtrans',
      midtransTransactionStatus: transactionStatus,
      midtransFraudStatus: fraudStatus,
      midtransPaymentType: paymentType,
      midtransTransactionTime: transactionTime,
    };

    if (shouldProcess && paymentStatus === 'completed') {
      // Payment successful!
      updateData.status = 'paid';
      updateData.paidAt = settlementTime || transactionTime || new Date();

      console.log('Payment completed for order:', orderNumber);
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      // Payment failed or cancelled
      updateData.status = 'cancelled';

      console.log('Payment failed/cancelled for order:', orderNumber);
    } else if (transactionStatus === 'expire') {
      // Payment expired
      updateData.status = 'cancelled';
      updateData.paymentStatus = 'failed';

      console.log('Payment expired for order:', orderNumber);
    }

    await Order.findByIdAndUpdate(order._id, updateData);

    // Log activity
    await logActivity(
      order.userId?.toString(),
      paymentStatus === 'completed' ? 'PAYMENT_SUCCESS' : 'PAYMENT_NOTIFICATION',
      `Midtrans webhook: ${transactionStatus} for order ${orderNumber}`,
      req.headers.get('x-forwarded-for') || 'midtrans-server',
      null,
      null
    );

    return NextResponse.json({
      success: true,
      message: 'Notification processed',
    });
  } catch (error) {
    console.error('Midtrans webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
