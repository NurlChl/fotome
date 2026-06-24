'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Image as ImageIcon, 
  Layers, 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Calendar
} from 'lucide-react';

interface EventData {
  _id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  photoCount: number;
  soldCount: number;
  revenue: number;
  eventDate: string;
}

interface DashboardStats {
  totalRevenue: number;
  photosSold: number;
  activeEvents: number;
  totalEvents: number;
  availableBalance: number;
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Withdraw State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status, router]);

  async function fetchDashboardData() {
    try {
      const res = await fetch('/api/photographer/dashboard');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingWithdraw(true);
    setWithdrawError('');
    setWithdrawSuccess('');

    const amountNum = parseInt(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 50000) {
      setWithdrawError('Minimum withdrawal is Rp 50.000');
      setIsProcessingWithdraw(false);
      return;
    }

    try {
      const res = await fetch('/api/photographer/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          bankName,
          bankAccount,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWithdrawSuccess('Permintaan penarikan berhasil diajukan! Menunggu persetujuan admin.');
        setWithdrawAmount('');
        setBankName('');
        setBankAccount('');
        fetchDashboardData();
        setTimeout(() => {
          setIsWithdrawOpen(false);
          setWithdrawSuccess('');
        }, 3000);
      } else {
        throw new Error(data.error || 'Penarikan gagal');
      }
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : 'Penarikan gagal');
    } finally {
      setIsProcessingWithdraw(false);
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading dashboard data...</p>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Revenue', 
      value: stats ? formatPrice(stats.totalRevenue) : 'Rp 0',
      icon: TrendingUp,
      color: 'from-emerald-500/10 to-green-500/5 border-emerald-500/20'
    },
    { 
      label: 'Photos Sold', 
      value: stats ? stats.photosSold.toString() : '0',
      icon: ImageIcon,
      color: 'from-blue-500/10 to-indigo-500/5 border-blue-500/20'
    },
    { 
      label: 'Active Events', 
      value: stats ? `${stats.activeEvents}/${stats.totalEvents}` : '0/0',
      icon: Layers,
      color: 'from-amber-500/10 to-orange-500/5 border-amber-500/20'
    },
    { 
      label: 'Available Balance', 
      value: stats ? formatPrice(stats.availableBalance) : 'Rp 0',
      icon: Wallet,
      color: 'from-purple-500/10 to-pink-500/5 border-purple-500/20',
      action: stats && stats.availableBalance >= 50000 ? (
        <button 
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition duration-200 shadow-md shadow-primary-500/25"
          onClick={() => {
            setWithdrawError('');
            setWithdrawSuccess('');
            setIsWithdrawOpen(true);
          }}
          id="btn-withdraw-dashboard"
        >
          Withdraw Funds <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      ) : stats && stats.availableBalance < 50000 ? (
        <span className="block mt-3.5 text-[10px] text-neutral-500 font-medium">
          Min Rp 50.000 to withdraw
        </span>
      ) : null
    },
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-50">Dashboard Overview</h1>
          <p className="text-neutral-400 text-xs mt-1">Kelola event dan pantau hasil unggahan foto Anda.</p>
        </div>
        <Link href="/dashboard/events/new" className="btn btn-primary rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 text-sm font-semibold" id="btn-create-event-dashboard">
          <Plus className="w-4 h-4" /> Create New Event
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <div key={i} className={`bg-linear-to-br ${stat.color} border rounded-2xl p-6 shadow-xl flex flex-col justify-between`}>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 text-xs font-semibold uppercase tracking-wider">{stat.label}</span>
                <div className="bg-neutral-950/45 p-2 rounded-lg border border-neutral-850">
                  <IconComponent className="w-4 h-4 text-neutral-300" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold tracking-tight text-neutral-50 font-display">{stat.value}</div>
                {stat.action}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Events */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-6">
        <div className="mb-6 border-b border-neutral-900 pb-3">
          <h2 className="text-lg font-bold text-neutral-50">Your Events</h2>
        </div>
        
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event._id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 bg-neutral-950/40 border border-neutral-900 rounded-2xl hover:border-neutral-800 transition duration-200">
                <div className="space-y-1.5 min-w-0">
                  <p className="font-bold text-neutral-50 text-base truncate">{event.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 font-light">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.eventDate)}</span>
                    <span>•</span>
                    <span>Kategori: {event.category}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                      event.status === 'published' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 
                      'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}>{event.status}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:self-center">
                  <div className="text-right">
                    <p className="font-bold text-neutral-50 text-sm font-display">{event.photoCount} Photos</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{event.soldCount} Sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-500 text-sm font-display">{formatPrice(event.revenue)}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Earnings</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/events/${event.slug}`} className="btn btn-ghost btn-sm text-xs flex items-center gap-1 rounded-lg" target="_blank">
                      View Page <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <Link href={`/dashboard/events/${event.slug}`} className="btn btn-secondary btn-sm text-xs font-semibold rounded-lg flex items-center gap-1" id={`btn-manage-${event.slug}`}>
                      Manage & Upload <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-neutral-950/20 border border-neutral-900 border-dashed rounded-2xl space-y-4">
            <Layers className="w-10 h-10 text-neutral-600 mx-auto" />
            <p className="text-sm text-neutral-500 max-w-xs mx-auto font-light">
              Belum ada event yang dibuat. Silakan buat event pertama Anda untuk mulai mengunggah foto.
            </p>
            <Link href="/dashboard/events/new" className="btn btn-secondary btn-sm rounded-lg py-2">
              Create First Event
            </Link>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center px-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative">
            <button 
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-50 transition duration-150"
              onClick={() => setIsWithdrawOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 border-b border-neutral-850 pb-3 mb-5">
              <Wallet className="w-5 h-5 text-primary-400" />
              <h3 className="text-lg font-bold text-neutral-50">Withdraw Funds</h3>
            </div>

            {withdrawError && (
              <div className="bg-error-bg border border-error-border text-error-text text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="bg-success-bg border border-success-border text-success-text text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Amount to Withdraw (IDR)
                </label>
                <input 
                  type="number" 
                  value={withdrawAmount} 
                  onChange={(e) => setWithdrawAmount(e.target.value)} 
                  required 
                  min="50000"
                  max={stats?.availableBalance}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                  placeholder="e.g. 100000"
                />
                <span className="block text-[10px] text-neutral-500 mt-2">
                  Max balance: {stats ? formatPrice(stats.availableBalance) : 'Rp 0'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Bank Name
                </label>
                <input 
                  type="text" 
                  value={bankName} 
                  onChange={(e) => setBankName(e.target.value)} 
                  required 
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                  placeholder="e.g. Bank Central Asia (BCA)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Bank Account Number & Name
                </label>
                <input 
                  type="text" 
                  value={bankAccount} 
                  onChange={(e) => setBankAccount(e.target.value)} 
                  required 
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                  placeholder="e.g. 123456789 - John Doe"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold" 
                  onClick={() => setIsWithdrawOpen(false)}
                  disabled={isProcessingWithdraw}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-primary-500/20" 
                  disabled={isProcessingWithdraw || (stats ? stats.availableBalance < 50000 : true)}
                  id="btn-confirm-withdraw"
                >
                  {isProcessingWithdraw ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
