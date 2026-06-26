'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Download, ShoppingBag, ExternalLink, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface OrderItemData {
  _id: string;
  price: number;
  photoId: {
    _id: string;
    thumbnailUrl: string;
  };
  eventId: {
    title: string;
    slug: string;
  };
}

interface OrderData {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  midtransSnapToken?: string;
  midtransRedirectUrl?: string;
  createdAt: string;
  paidAt?: string;
  items: OrderItemData[];
}

function OrdersContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'pending' | 'error'; message: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/orders');
      return;
    }

    if (status === 'authenticated') {
      setTimeout(() => fetchOrders(), 0);
    }
  }, [status, router, fetchOrders]);

  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const pending = searchParams.get('pending') === 'true';
    const error = searchParams.get('error') === 'true';

    const timer = setTimeout(() => {
      if (success) {
        setNotification({ type: 'success', message: 'Payment successful! Your photos are now available in My Gallery.' });
      } else if (pending) {
        setNotification({ type: 'pending', message: 'Payment is pending. We will update your order once the payment is confirmed.' });
      } else if (error) {
        setNotification({ type: 'error', message: 'Payment failed or was cancelled. Please try again.' });
      }

      setTimeout(() => setNotification(null), 8000);
    }, 0);

    return () => clearTimeout(timer);
  }, [searchParams]);



  const handlePayPending = async (order: OrderData) => {
    setPayingId(order._id);
    try {
      // Prefer redirect URL, fall back to Snap token popup
      if (order.midtransRedirectUrl) {
        window.location.assign(order.midtransRedirectUrl);
        return;
      }

      if (order.midtransSnapToken) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as unknown as Record<string, any>;
        if (!win.snap) {
          const script = document.createElement('script');
          script.src = `https://app.${
            process.env.MIDTRANS_IS_PRODUCTION === 'true' ? '' : 'sandbox.'
          }midtrans.com/snap/snap.js`;
          script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
          document.head.appendChild(script);

          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        win.snap.pay(order.midtransSnapToken, {
          onSuccess: function () {
            router.push('/orders?success=true');
          },
          onPending: function () {
            router.push('/orders?pending=true');
          },
          onError: function () {
            router.push('/orders?error=true');
          },
          onClose: function () {
            setPayingId(null);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return;
      }

      throw new Error('Payment link is not available for this order. Please contact support.');
    } catch (error) {
      console.error('Payment error:', error);
      alert(error instanceof Error ? error.message : 'Failed to open payment page. Please try again.');
      setPayingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="pt-28 min-h-screen pb-24 bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-400 text-sm">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-50 mb-4">My Orders</h1>
            <p className="text-neutral-400 text-sm sm:text-base font-light">Track your purchase history and photo downloads</p>
          </div>
        </div>

        {notification && (
          <div className={`max-w-4xl mx-auto mb-8 p-5 rounded-2xl flex items-start gap-4 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/30 border border-emerald-500/20 text-emerald-400'
              : notification.type === 'pending'
              ? 'bg-amber-950/30 border border-amber-500/20 text-amber-400'
              : 'bg-rose-950/30 border border-rose-500/20 text-rose-400'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            ) : notification.type === 'pending' ? (
              <Clock className="w-6 h-6 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className={`font-bold mb-1 ${
                notification.type === 'success' ? 'text-emerald-50' : notification.type === 'pending' ? 'text-amber-50' : 'text-rose-50'
              }`}>
                {notification.type === 'success' ? 'Payment Successful' : notification.type === 'pending' ? 'Payment Pending' : 'Payment Failed'}
              </h3>
              <p className="text-sm font-light">{notification.message}</p>
            </div>
          </div>
        )}

        {orders.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {orders.map((order) => (
              <div key={order._id} className="bg-neutral-900/30 border border-neutral-900 rounded-3xl overflow-hidden hover:border-neutral-800 transition duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-neutral-900/50 bg-neutral-900/20">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-neutral-50">Order #{order.orderNumber}</h3>
                    <div className="text-xs text-neutral-400 font-light">{formatDate(order.createdAt)}</div>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      order.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : order.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="p-6 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {order.items.map((item) => (
                    <div key={item._id} className="aspect-square rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative group" title={item.eventId?.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.photoId?.thumbnailUrl} alt="Order item thumb" className="w-full h-full object-cover transition duration-300 group-hover:scale-110" loading="lazy" />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 border-t border-neutral-900/50 bg-neutral-900/20">
                  <div className="flex flex-col">
                    <div className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mb-0.5">Total Payment</div>
                    <div className="text-xl font-bold text-primary-400 font-display">{formatPrice(order.totalAmount)}</div>
                  </div>

                  {order.status === 'pending' && (
                    <button
                      className="btn btn-primary rounded-xl px-6 py-2.5 flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary-500/20"
                      onClick={() => handlePayPending(order)}
                      disabled={payingId === order._id}
                      id={`btn-pay-${order._id}`}
                    >
                      {payingId === order._id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" /> Pay Now
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'paid' && (
                    <Link href="/my-photos" className="btn btn-secondary rounded-xl px-6 py-2.5 flex items-center justify-center gap-2 text-sm">
                      <Download className="w-4 h-4" /> View Photos
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-neutral-900 border-dashed rounded-3xl bg-neutral-900/10">
            <div className="mb-4 p-4 rounded-full bg-neutral-900/50 border border-neutral-800 inline-flex text-neutral-500">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-neutral-50 mb-2">No orders found</h2>
            <p className="text-xs text-neutral-500 font-light mb-6 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Visit an event, search for photos, and make your first purchase!
            </p>
            <Link href="/events" className="btn btn-primary rounded-xl px-6 py-2">
              Browse Events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 min-h-screen pb-24 bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-400 text-sm">Loading your orders...</p>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
