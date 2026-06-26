/**
 * Midtrans Payment Gateway Integration
 * Docs: https://docs.midtrans.com/reference/getting-started
 */

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

const MIDTRANS_SNAP_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

/**
 * Create Snap Token for payment
 * @param orderId Unique order ID
 * @param amount Total amount in IDR (integer, no decimals)
 * @param customerDetails Customer information
 * @param itemDetails Array of items
 */
export async function createSnapToken(params: {
  orderId: string;
  amount: number;
  customerDetails: {
    firstName: string;
    email: string;
    phone?: string;
  };
  itemDetails: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}): Promise<{ token: string; redirectUrl: string }> {
  const authHeader = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');

  const payload = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    customer_details: {
      first_name: params.customerDetails.firstName,
      email: params.customerDetails.email,
      phone: params.customerDetails.phone || '',
    },
    item_details: params.itemDetails,
    credit_card: {
      secure: true,
    },
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL}/orders?success=true`,
      error: `${process.env.NEXT_PUBLIC_APP_URL}/orders?error=true`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/orders?pending=true`,
    },
  };

  const response = await fetch(`${MIDTRANS_API_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Midtrans API error:', error);
    throw new Error(error.error_messages?.[0] || 'Failed to create payment token');
  }

  const data = await response.json();

  return {
    token: data.token,
    redirectUrl: data.redirect_url,
  };
}

/**
 * Get transaction status from Midtrans
 * @param orderId Order ID to check
 */
export async function getTransactionStatus(orderId: string): Promise<{
  transactionStatus: string;
  fraudStatus?: string;
  statusCode: string;
  grossAmount: string;
  paymentType?: string;
  transactionTime?: string;
  settlementTime?: string;
}> {
  const authHeader = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');

  const response = await fetch(
    `${MIDTRANS_API_URL.replace('/snap/v1', '/v2')}/${orderId}/status`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Midtrans status check error:', error);
    throw new Error('Failed to check transaction status');
  }

  const data = await response.json();
  return data;
}

/**
 * Get Midtrans client key for frontend Snap.js
 */
export function getMidtransClientKey(): string {
  return MIDTRANS_CLIENT_KEY;
}

/**
 * Get Snap.js script URL
 */
export function getSnapScriptUrl(): string {
  return MIDTRANS_SNAP_URL;
}

/**
 * Verify Midtrans notification signature
 * Used in webhook endpoint for security
 */
export function verifySignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHash('sha512')
    .update(
      params.orderId + params.statusCode + params.grossAmount + MIDTRANS_SERVER_KEY
    )
    .digest('hex');

  return hash === params.signatureKey;
}

/**
 * Map Midtrans transaction status to our order status
 */
export function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): {
  paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled';
  shouldProcess: boolean;
} {
  // Reference: https://docs.midtrans.com/reference/transaction-status
  
  if (transactionStatus === 'capture') {
    if (fraudStatus === 'accept') {
      return { paymentStatus: 'completed', shouldProcess: true };
    } else if (fraudStatus === 'challenge') {
      return { paymentStatus: 'pending', shouldProcess: false };
    } else {
      return { paymentStatus: 'failed', shouldProcess: false };
    }
  } else if (transactionStatus === 'settlement') {
    return { paymentStatus: 'completed', shouldProcess: true };
  } else if (transactionStatus === 'pending') {
    return { paymentStatus: 'pending', shouldProcess: false };
  } else if (
    transactionStatus === 'deny' ||
    transactionStatus === 'expire' ||
    transactionStatus === 'cancel'
  ) {
    return { paymentStatus: 'failed', shouldProcess: false };
  }

  // Default for unknown status
  return { paymentStatus: 'pending', shouldProcess: false };
}
