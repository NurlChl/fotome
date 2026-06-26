'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  Settings, 
  ShieldAlert, 
  Activity, 
  Plus, 
  TrendingUp, 
  Briefcase, 
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Loader2
} from 'lucide-react';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'photographer' | 'admin' | 'superadmin';
  createdAt: string;
}

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

interface EventData {
  _id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  photoCount: number;
  eventDate: string;
  coverImage?: string;
  pricePerPhoto: number;
  photographerId?: {
    name: string;
    email: string;
  };
}

interface AdminData {
  _id: string;
  name: string;
  email: string;
  role: string;
  adminPermissions?: {
    manageUsers: boolean;
    manageEvents: boolean;
    managePayouts: boolean;
    manageLogs: boolean;
  };
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  totalPhotographers: number;
  totalEvents: number;
  totalPhotos: number;
  grossSales: number;
  platformRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
}

type TabType = 'overview' | 'users' | 'events' | 'payouts' | 'admins' | 'claims';

interface ClaimData {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  eventId: {
    _id: string;
    title: string;
    slug: string;
  };
  photoId?: {
    _id: string;
    watermarkedUrl: string;
    thumbnailUrl: string;
  };
  selfieUrl?: string;
  ipAddress?: string;
  isMatched: boolean;
  type?: 'biometric' | 'override' | 'false_positive';
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Core Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Create Admin Form States
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [permUsers, setPermUsers] = useState(false);
  const [permEvents, setPermEvents] = useState(false);
  const [permPayouts, setPermPayouts] = useState(false);
  const [permLogs, setPermLogs] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState('');
  const [adminError, setAdminError] = useState('');

  // Edit Admin States
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPermUsers, setEditPermUsers] = useState(false);
  const [editPermEvents, setEditPermEvents] = useState(false);
  const [editPermPayouts, setEditPermPayouts] = useState(false);
  const [editPermLogs, setEditPermLogs] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  // Access Roles & Permissions Flags
  const isSuperadmin = session?.user?.role === 'superadmin';
  const canManageUsers = isSuperadmin || !!session?.user?.permissions?.manageUsers;
  const canManageEvents = isSuperadmin || !!session?.user?.permissions?.manageEvents;
  const canManagePayouts = isSuperadmin || !!session?.user?.permissions?.managePayouts;
  const canManageLogs = isSuperadmin || !!session?.user?.permissions?.manageLogs;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated') {
      const role = session.user.role;
      if (role !== 'admin' && role !== 'superadmin') {
        router.push('/login/admin');
        return;
      }
      fetchAdminData();
    }
  }, [status, session, router]);

  // Fetch Admin Admins List if Superadmin navigates to admins tab
  useEffect(() => {
    if (activeTab === 'admins' && isSuperadmin) {
      fetchAdminsList();
    }
  }, [activeTab, isSuperadmin]);

  // Fetch claims list when claims tab is selected
  useEffect(() => {
    if (activeTab === 'claims') {
      fetchClaimsList();
    }
  }, [activeTab]);

  async function fetchAdminData() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setUsers(data.users || []);
        setPayouts(data.payouts || []);
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAdminsList() {
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  }

  async function fetchClaimsList() {
    setClaimsLoading(true);
    try {
      const res = await fetch('/api/admin/claims');
      const data = await res.json();
      if (res.ok) {
        setClaims(data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setClaimsLoading(false);
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
        fetchAdminData();
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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAdmin(true);
    setAdminSuccess('');
    setAdminError('');

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          permissions: {
            manageUsers: permUsers,
            manageEvents: permEvents,
            managePayouts: permPayouts,
            manageLogs: permLogs,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAdminSuccess('Admin account created successfully!');
        setAdminName('');
        setAdminEmail('');
        setAdminPassword('');
        setPermUsers(false);
        setPermEvents(false);
        setPermPayouts(false);
        setPermLogs(false);
        fetchAdminsList();
      } else {
        throw new Error(data.error || 'Failed to create admin');
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleEditAdmin = (admin: AdminData) => {
    setEditingAdminId(admin._id);
    setEditName(admin.name);
    setEditEmail(admin.email);
    setEditPermUsers(admin.adminPermissions?.manageUsers || false);
    setEditPermEvents(admin.adminPermissions?.manageEvents || false);
    setEditPermPayouts(admin.adminPermissions?.managePayouts || false);
    setEditPermLogs(admin.adminPermissions?.manageLogs || false);
    setIsEditModalOpen(true);
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminId) return;

    setIsUpdatingAdmin(true);
    setAdminSuccess('');
    setAdminError('');

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: editingAdminId,
          name: editName,
          email: editEmail,
          permissions: {
            manageUsers: editPermUsers,
            manageEvents: editPermEvents,
            managePayouts: editPermPayouts,
            manageLogs: editPermLogs,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAdminSuccess('Admin updated successfully!');
        setIsEditModalOpen(false);
        setEditingAdminId(null);
        fetchAdminsList();
      } else {
        throw new Error(data.error || 'Failed to update admin');
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`Are you sure you want to delete admin "${adminName}"? This action cannot be undone.`)) {
      return;
    }

    setActionId(adminId);
    setAdminSuccess('');
    setAdminError('');

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      });

      const data = await res.json();

      if (res.ok) {
        setAdminSuccess(`Admin "${adminName}" deleted successfully!`);
        fetchAdminsList();
      } else {
        throw new Error(data.error || 'Failed to delete admin');
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Something went wrong.');
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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Filter Stat Cards depending on logged-in user permissions
  const statCards = [];
  if (canManageUsers) {
    statCards.push({ label: 'Total Registrations', value: stats?.totalUsers.toString() || '0', icon: Users, color: 'from-blue-500/10 to-indigo-500/5 border-blue-500/20' });
    statCards.push({ label: 'Photographers', value: stats?.totalPhotographers.toString() || '0', icon: Briefcase, color: 'from-purple-500/10 to-pink-500/5 border-purple-500/20' });
  }
  if (canManageEvents) {
    statCards.push({ label: 'Total Events', value: stats?.totalEvents.toString() || '0', icon: Calendar, color: 'from-amber-500/10 to-orange-500/5 border-amber-500/20' });
    statCards.push({ label: 'Photos Uploaded', value: stats?.totalPhotos.toString() || '0', icon: Activity, color: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20' });
  }
  if (canManagePayouts) {
    statCards.push({ label: 'Gross Sales Volume', value: stats ? formatPrice(stats.grossSales) : 'Rp 0', icon: DollarSign, color: 'from-emerald-500/10 to-green-500/5 border-emerald-500/20' });
    statCards.push({ label: 'Platform Revenue', value: stats ? formatPrice(stats.platformRevenue) : 'Rp 0', icon: TrendingUp, color: 'from-cyan-500/10 to-blue-500/5 border-cyan-500/20' });
    statCards.push({ label: 'Pending Payout Volume', value: stats ? formatPrice(stats.pendingPayouts) : 'Rp 0', icon: ShieldAlert, color: 'from-rose-500/10 to-red-500/5 border-rose-500/20' });
    statCards.push({ label: 'Completed Payouts', value: stats ? formatPrice(stats.completedPayouts) : 'Rp 0', icon: DollarSign, color: 'from-indigo-500/10 to-violet-500/5 border-indigo-500/20' });
  }

  return (
    <div className="pt-28 min-h-screen pb-16 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-neutral-900">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              Admin Console
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Welcome back, <span className="text-neutral-50 font-medium">{session?.user?.name}</span>. Manage platform telemetry and permissions.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-neutral-300 font-mono capitalize">{session?.user?.role} Mode</span>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-neutral-900 pb-3">
          <button 
            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
              activeTab === 'overview' 
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Overview</span>
          </button>
          
          {canManageUsers && (
            <button 
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
                activeTab === 'users' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
              }`}
              onClick={() => setActiveTab('users')}
            >
              <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Users ({users.length})</span>
            </button>
          )}

          {canManageEvents && (
            <button 
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
                activeTab === 'events' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
              }`}
              onClick={() => setActiveTab('events')}
            >
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Events ({events.length})</span>
            </button>
          )}

          {canManagePayouts && (
            <button 
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
                activeTab === 'payouts' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
              }`}
              onClick={() => setActiveTab('payouts')}
            >
              <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Payouts ({payouts.length})</span>
            </button>
          )}

          {isSuperadmin && (
            <button 
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
                activeTab === 'admins' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
              }`}
              onClick={() => setActiveTab('admins')}
            >
              <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Admins</span>
            </button>
          )}

          {(isSuperadmin || canManageUsers) && (
            <button 
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition duration-200 ${
                activeTab === 'claims' 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-neutral-300 hover:text-neutral-50 hover:bg-neutral-900/50'
              }`}
              onClick={() => setActiveTab('claims')}
            >
              <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Claims Log</span>
            </button>
          )}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat, i) => {
                const IconComponent = stat.icon;
                return (
                  <div key={i} className={`bg-linear-to-br ${stat.color} border rounded-2xl p-6 shadow-xl flex items-center justify-between`}>
                    <div>
                      <div className="text-neutral-300 text-xs font-semibold uppercase tracking-wider">{stat.label}</div>
                      <div className="text-2xl font-bold tracking-tight text-neutral-50 mt-1 font-display">{stat.value}</div>
                    </div>
                    <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-850">
                      <IconComponent className="w-5 h-5 text-neutral-300" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Payouts Section */}
              {canManagePayouts && (
                <div className="lg:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-3">
                    <h2 className="text-lg font-bold text-neutral-50 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-neutral-400" /> Pending Photographer Payouts
                    </h2>
                    <span className="badge badge-primary">{payouts.length} requests</span>
                  </div>
                  {payouts.length > 0 ? (
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                            <th className="pb-3 pr-4">Photographer</th>
                            <th className="pb-3 pr-4">Amount</th>
                            <th className="pb-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                          {payouts.slice(0, 5).map((payout) => (
                            <tr key={payout._id} className="text-neutral-300 hover:bg-neutral-900/10">
                              <td className="py-4 pr-4">
                                <div className="font-semibold text-neutral-50">{payout.photographerId?.name}</div>
                                <div className="text-xs text-neutral-500 mt-0.5">{payout.photographerId?.email}</div>
                              </td>
                              <td className="py-4 pr-4 font-semibold text-emerald-500">{formatPrice(payout.amount)}</td>
                              <td className="py-4">
                                <button 
                                  className="btn btn-primary btn-sm rounded-lg" 
                                  onClick={() => handlePayoutAction(payout._id, 'approve')} 
                                  disabled={actionId === payout._id}
                                >
                                  Approve
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-neutral-500 text-sm">No pending payouts at this time.</div>
                  )}
                </div>
              )}

              {/* Recent Users Section */}
              {canManageUsers && (
                <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-3">
                    <h2 className="text-lg font-bold text-neutral-50 flex items-center gap-2"><Users className="w-5 h-5 text-neutral-400" /> Recent Users</h2>
                  </div>
                  <div className="space-y-4">
                    {users.slice(0, 5).map((user) => (
                      <div key={user._id} className="flex items-center justify-between gap-4 p-3 bg-neutral-950/40 border border-neutral-900 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-linear-to-br from-primary-500 to-accent-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-50 text-sm truncate">{user.name}</div>
                            <div className="text-xs text-neutral-500 truncate">{user.email}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                          user.role === 'superadmin' ? 'bg-primary-500/10 text-primary-300 border-primary-500/20' : 
                          user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 
                          'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USERS */}
        {activeTab === 'users' && canManageUsers && (
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
              <h2 className="text-xl font-bold text-neutral-50">Registered Accounts</h2>
              <span className="badge badge-primary">{users.length} accounts</span>
            </div>
            <div className="overflow-x-auto border border-neutral-900 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                    <th className="px-6 py-4">User ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="px-6 py-4 font-mono text-xs text-neutral-500">{user._id}</td>
                      <td className="px-6 py-4 font-semibold text-neutral-50">{user.name}</td>
                      <td className="px-6 py-4">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                          user.role === 'superadmin' ? 'bg-primary-500/10 text-primary-300 border-primary-500/20' : 
                          user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 
                          user.role === 'photographer' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 
                          'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EVENTS */}
        {activeTab === 'events' && canManageEvents && (
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
              <h2 className="text-xl font-bold text-neutral-50">Platform Events</h2>
              <span className="badge badge-primary">{events.length} events</span>
            </div>
            <div className="overflow-x-auto border border-neutral-900 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                    <th className="px-6 py-4">Cover</th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Uploader</th>
                    <th className="px-6 py-4">Photo Count</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {events.map((event) => (
                    <tr key={event._id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="px-6 py-4">
                        {event.coverImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={event.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-neutral-850" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-900 border border-neutral-850 rounded-lg flex items-center justify-center font-bold text-neutral-600 text-[10px]">NO IMG</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-neutral-50">
                        <Link href={`/events/${event.slug}`} target="_blank" className="hover:text-primary-400 hover:underline flex items-center gap-1.5">
                          {event.title}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                      <td className="px-6 py-4">{event.photographerId?.name || 'Admin'}</td>
                      <td className="px-6 py-4">{event.photoCount} photos</td>
                      <td className="px-6 py-4 font-semibold">
                        {event.pricePerPhoto === 0 ? (
                          <span className="text-emerald-500">FREE</span>
                        ) : (
                          <span className="text-neutral-50">{formatPrice(event.pricePerPhoto)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">{formatDate(event.eventDate)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                          event.status === 'published' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 
                          'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PAYOUTS */}
        {activeTab === 'payouts' && canManagePayouts && (
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
              <h2 className="text-xl font-bold text-neutral-50">Photographer Withdrawals</h2>
              <span className="badge badge-primary">{payouts.length} pending requests</span>
            </div>
            <div className="overflow-x-auto border border-neutral-900 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                    <th className="px-6 py-4">Uploader</th>
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
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition duration-200" 
                            onClick={() => handlePayoutAction(payout._id, 'approve')} 
                            disabled={actionId === payout._id}
                          >
                            Approve
                          </button>
                          <button 
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition duration-200" 
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
            </div>
          </div>
        )}

        {/* TAB 5: ADMINS MANAGEMENT */}
        {activeTab === 'admins' && isSuperadmin && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fadeIn">
            {/* Left side: Admins list */}
            <div className="lg:col-span-3 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
                <h2 className="text-xl font-bold text-neutral-50">Manage Administrators</h2>
                <span className="badge badge-primary">{admins.length} admins</span>
              </div>
              <div className="overflow-x-auto border border-neutral-900 rounded-xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                      <th className="px-6 py-4">Name / Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Permissions</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {admins.map((adm) => (
                      <tr key={adm._id} className="hover:bg-neutral-900/10 text-neutral-300">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-50">{adm.name}</div>
                          <div className="text-xs text-neutral-500 mt-0.5">{adm.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                            adm.role === 'superadmin' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 
                            'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                          }`}>
                            {adm.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {adm.role === 'superadmin' ? (
                            <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Full Access</span>
                          ) : (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className={adm.adminPermissions?.manageUsers ? 'text-emerald-500' : 'text-rose-500'}>
                                  {adm.adminPermissions?.manageUsers ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-neutral-400">Users</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={adm.adminPermissions?.manageEvents ? 'text-emerald-500' : 'text-rose-500'}>
                                  {adm.adminPermissions?.manageEvents ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-neutral-400">Events</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={adm.adminPermissions?.managePayouts ? 'text-emerald-500' : 'text-rose-500'}>
                                  {adm.adminPermissions?.managePayouts ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-neutral-400">Payouts</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={adm.adminPermissions?.manageLogs ? 'text-emerald-500' : 'text-rose-500'}>
                                  {adm.adminPermissions?.manageLogs ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-neutral-400">Activity Logs</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {adm.role !== 'superadmin' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditAdmin(adm)}
                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 rounded-lg transition"
                                title="Edit admin"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(adm._id, adm.name)}
                                disabled={actionId === adm._id}
                                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg transition disabled:opacity-50"
                                title="Delete admin"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right side: Add admin form */}
            <div className="lg:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 h-fit">
              <div className="mb-6 border-b border-neutral-900 pb-4">
                <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary-400" /> Add New Admin
                </h2>
              </div>

              {adminSuccess && (
                <div className="bg-success-bg border border-success-border text-success-text p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {adminSuccess}
                </div>
              )}

              {adminError && (
                <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {adminError}
                </div>
              )}

              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2" htmlFor="admin-name">Name</label>
                  <input 
                    id="admin-name" 
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                    placeholder="e.g. Admin Dua" 
                    value={adminName} 
                    onChange={(e) => setAdminName(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2" htmlFor="admin-email">Email</label>
                  <input 
                    id="admin-email" 
                    type="email" 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                    placeholder="admin2@fotome.com" 
                    value={adminEmail} 
                    onChange={(e) => setAdminEmail(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2" htmlFor="admin-password">Password</label>
                  <input 
                    id="admin-password" 
                    type="password" 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                    placeholder="Min. 8 characters" 
                    value={adminPassword} 
                    onChange={(e) => setAdminPassword(e.target.value)} 
                    required 
                    minLength={8} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Select Permissions</label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-900 rounded-xl text-sm text-neutral-300 cursor-pointer hover:bg-neutral-900/50 hover:border-neutral-800 transition duration-200">
                      <input 
                        type="checkbox" 
                        className="rounded accent-primary-500 text-primary-600 focus:ring-primary-500 bg-neutral-950 border-neutral-900" 
                        checked={permUsers} 
                        onChange={(e) => setPermUsers(e.target.checked)} 
                      />
                      <span>Users</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-900 rounded-xl text-sm text-neutral-300 cursor-pointer hover:bg-neutral-900/50 hover:border-neutral-800 transition duration-200">
                      <input 
                        type="checkbox" 
                        className="rounded accent-primary-500 text-primary-600 focus:ring-primary-500 bg-neutral-950 border-neutral-900" 
                        checked={permEvents} 
                        onChange={(e) => setPermEvents(e.target.checked)} 
                      />
                      <span>Events</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-900 rounded-xl text-sm text-neutral-300 cursor-pointer hover:bg-neutral-900/50 hover:border-neutral-800 transition duration-200">
                      <input 
                        type="checkbox" 
                        className="rounded accent-primary-500 text-primary-600 focus:ring-primary-500 bg-neutral-950 border-neutral-900" 
                        checked={permPayouts} 
                        onChange={(e) => setPermPayouts(e.target.checked)} 
                      />
                      <span>Payouts</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-950 border border-neutral-900 rounded-xl text-sm text-neutral-300 cursor-pointer hover:bg-neutral-900/50 hover:border-neutral-800 transition duration-200">
                      <input 
                        type="checkbox" 
                        className="rounded accent-primary-500 text-primary-600 focus:ring-primary-500 bg-neutral-950 border-neutral-900" 
                        checked={permLogs} 
                        onChange={(e) => setPermLogs(e.target.checked)} 
                      />
                      <span>Activity Logs</span>
                    </label>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary w-full mt-4 rounded-xl py-3 shadow-lg shadow-primary-500/25 text-sm font-semibold flex items-center justify-center gap-2" 
                  disabled={isCreatingAdmin}
                >
                  {isCreatingAdmin ? 'Creating...' : 'Create Admin Account'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: CLAIMS */}
        {activeTab === 'claims' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-3">
                <h2 className="text-lg font-bold text-neutral-50 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary-500" /> Manual & Biometric Photo Claims Log
                </h2>
                <span className="badge badge-primary">{claims.length} entries</span>
              </div>

              {claimsLoading ? (
                <div className="flex flex-col items-center py-12 gap-3 text-neutral-500 text-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                  <span>Loading claims log...</span>
                </div>
              ) : claims.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                        <th className="pb-3 pr-4 pl-2">User / Account</th>
                        <th className="pb-3 pr-4">Event</th>
                        <th className="pb-3 pr-4">Target Photo</th>
                        <th className="pb-3 pr-4">Verification Selfie</th>
                        <th className="pb-3 pr-4">IP Address</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {claims.map((claim) => (
                        <tr key={claim._id} className="text-neutral-300 hover:bg-neutral-900/10">
                          <td className="py-4 pr-4 pl-2">
                            <div className="font-semibold text-neutral-50">{claim.userId?.name || 'Unknown User'}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{claim.userId?.email || 'No Email'}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="font-medium text-neutral-200">{claim.eventId?.title || 'Unknown Event'}</div>
                            <div className="text-xs text-neutral-500 mt-0.5 font-mono">/{claim.eventId?.slug || ''}</div>
                          </td>
                          <td className="py-4 pr-4">
                            {claim.photoId ? (
                              <div className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={claim.photoId.thumbnailUrl || claim.photoId.watermarkedUrl} 
                                  alt="Target Photo" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <span className="text-neutral-500 text-xs italic">Deleted Photo</span>
                            )}
                          </td>
                          <td className="py-4 pr-4">
                            {claim.selfieUrl ? (
                              <div className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-850 bg-neutral-950">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={claim.selfieUrl} 
                                  alt="Selfie Verification" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <span className="text-neutral-500 text-xs italic">No Selfie (Flagged)</span>
                            )}
                          </td>
                          <td className="py-4 pr-4 font-mono text-xs text-neutral-300">
                            {claim.ipAddress || '-'}
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                              claim.type === 'biometric' 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                                : claim.type === 'override'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            }`}>
                              {claim.type === 'biometric' 
                                ? 'Biometric Match' 
                                : claim.type === 'override'
                                ? 'Manual Override'
                                : 'False Positive Flag'}
                            </span>
                          </td>
                          <td className="py-4 text-xs text-neutral-500">
                            {new Date(claim.createdAt).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500 text-sm">No manual or biometric photo claims logged yet.</div>
              )}
            </div>
          </div>
        )}

        {/* Edit Admin Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center px-4 z-50 animate-fadeIn">
            <div className="w-full max-w-lg bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative">
              <button 
                className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-50 transition duration-150"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingAdminId(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-neutral-850 pb-3 mb-5">
                <Edit2 className="w-5 h-5 text-primary-400" />
                <h3 className="text-lg font-bold text-neutral-50">Edit Admin</h3>
              </div>

              {adminSuccess && (
                <div className="bg-success-bg border border-success-border text-success-text text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{adminSuccess}</span>
                </div>
              )}

              {adminError && (
                <div className="bg-error-bg border border-error-border text-error-text text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{adminError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Select Permissions</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editPermUsers} 
                        onChange={(e) => setEditPermUsers(e.target.checked)} 
                        className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-300">Users</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editPermEvents} 
                        onChange={(e) => setEditPermEvents(e.target.checked)} 
                        className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-300">Events</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editPermPayouts} 
                        onChange={(e) => setEditPermPayouts(e.target.checked)} 
                        className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-300">Payouts</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editPermLogs} 
                        onChange={(e) => setEditPermLogs(e.target.checked)} 
                        className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-300">Activity Logs</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold" 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingAdminId(null);
                    }}
                    disabled={isUpdatingAdmin}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-primary-500/20" 
                    disabled={isUpdatingAdmin}
                  >
                    {isUpdatingAdmin ? 'Updating...' : 'Update Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
