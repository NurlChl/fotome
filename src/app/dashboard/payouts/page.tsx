'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DollarSign, Loader2 } from 'lucide-react';

interface PayoutData {
  _id: string;
  amount: number;
  bankName: string;
  bankAccount: string;
  status: 'pending' | 'completed' | 'failed';
  requestedAt: string;
  photographerId: {
    _id: string;
    name: string;
    email: string;
  };
}

export default function PayoutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const canManagePayouts = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.managePayouts;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !canManagePayouts) {
      router.push('/dashboard');
      return;
    }

    if (canManagePayouts) {
      fetchPayouts();
    }
  }, [status, canManagePayouts, router]);

  async function fetchPayouts() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (res.ok) {
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePayoutAction = async (payoutId: string, action: 'approve' | 'reject') => {
    const note = prompt(`Enter optional review note for this ${action}:`);
    if (note === null) return;

    setActionId(payoutId);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId,
          action,
          notes: note || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Payout ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
        fetchPayouts();
      } else {
        throw new Error(data.error || 'Failed to process payout');
      }
    } catch (error) {
      console.error('Error processing payout:', error);
      alert(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setActionId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Header Skeleton */}
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-neutral-900 rounded w-64" />
          <div className="h-4 bg-neutral-900 rounded w-96" />
        </div>

        {/* Table Skeleton */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
            <div className="h-6 bg-neutral-800 rounded w-48 animate-pulse" />
            <div className="h-6 bg-neutral-800 rounded-full w-24 animate-pulse" />
          </div>
          <div className="overflow-x-auto border border-neutral-900 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-950/50 border-b border-neutral-900">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <th key={i} className="px-6 py-4">
                      <div className="h-4 bg-neutral-800 rounded animate-pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-neutral-900 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">Payout Management</h1>
        <p className="text-neutral-400 text-sm mt-1">Review and approve photographer withdrawal requests</p>
      </div>

      {/* Payouts Table */}
      <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-neutral-800/50 pb-4">
          <h2 className="text-lg font-bold text-neutral-50">Photographer Withdrawals</h2>
          <span className="badge badge-primary">{payouts.length} pending</span>
        </div>
        <div className="overflow-x-auto border border-neutral-800/50 rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-950/50 border-b border-neutral-800/50 text-neutral-400 text-xs uppercase font-medium">
                <th className="px-6 py-4">Photographer</th>
                <th className="px-6 py-4">Amount Requested</th>
                <th className="px-6 py-4">Bank Details</th>
                <th className="px-6 py-4">Requested At</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {payouts.map((payout) => (
                <tr key={payout._id} className="hover:bg-neutral-900/10 text-neutral-300">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-neutral-50">{payout.photographerId?.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{payout.photographerId?.email}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-500">{formatPrice(payout.amount)}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-neutral-50">{payout.bankName}</div>
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">{payout.bankAccount}</div>
                  </td>
                  <td className="px-6 py-4">{formatDate(payout.requestedAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button 
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition duration-200 disabled:opacity-50" 
                        onClick={() => handlePayoutAction(payout._id, 'approve')} 
                        disabled={actionId === payout._id}
                      >
                        {actionId === payout._id ? 'Processing...' : 'Approve'}
                      </button>
                      <button 
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition duration-200 disabled:opacity-50" 
                        onClick={() => handlePayoutAction(payout._id, 'reject')} 
                        disabled={actionId === payout._id}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">
              No pending payouts at this time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
