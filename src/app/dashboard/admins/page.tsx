'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, 
  Plus, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Shield,
  Loader2,
  X
} from 'lucide-react';
import { useConfirm } from '@/components/ModalProvider';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';

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
    manageTransactions: boolean;
    manageClaims: boolean;
    manageCategories: boolean;
  };
  createdAt: string;
}

export default function AdminsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { confirm } = useConfirm();

  const [admins, setAdmins] = useState<AdminData[]>([]);
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
  const [permTransactions, setPermTransactions] = useState(false);
  const [permClaims, setPermClaims] = useState(false);
  const [permCategories, setPermCategories] = useState(false);
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
  const [editPermTransactions, setEditPermTransactions] = useState(false);
  const [editPermClaims, setEditPermClaims] = useState(false);
  const [editPermCategories, setEditPermCategories] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  const isSuperadmin = session?.user?.role === 'superadmin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !isSuperadmin) {
      router.push('/dashboard');
      return;
    }

    if (isSuperadmin) {
      fetchAdminsList();
    }
  }, [status, isSuperadmin, router]);

  async function fetchAdminsList() {
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setIsLoading(false);
    }
  }

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
            manageTransactions: permTransactions,
            manageClaims: permClaims,
            manageCategories: permCategories,
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
        setPermTransactions(false);
        setPermClaims(false);
        setPermCategories(false);
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
    setEditPermTransactions(admin.adminPermissions?.manageTransactions || false);
    setEditPermClaims(admin.adminPermissions?.manageClaims || false);
    setEditPermCategories(admin.adminPermissions?.manageCategories || false);
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
              manageTransactions: editPermTransactions,
              manageClaims: editPermClaims,
              manageCategories: editPermCategories,
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
    const isConfirmed = await confirm(
      'Delete Admin Account',
      `Are you sure you want to delete admin "${adminName}"? This action cannot be undone.`
    );
    if (!isConfirmed) {
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TableSkeleton rows={5} cols={4} />
          </div>
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 h-fit animate-pulse">
            <div className="space-y-4">
              <div className="h-6 bg-neutral-800 rounded" />
              <div className="h-10 bg-neutral-800 rounded" />
              <div className="h-10 bg-neutral-800 rounded" />
              <div className="h-10 bg-neutral-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">Manage Administrators</h1>
        <p className="text-neutral-400 text-sm mt-1">Create and manage admin accounts and permissions</p>
      </div>

      {/* Success/Error Messages */}
      {adminSuccess && (
        <div className="bg-success-bg border border-success-border text-success-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{adminSuccess}</span>
        </div>
      )}

      {adminError && (
        <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{adminError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admins List */}
        <div className="lg:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
            <h2 className="text-lg font-bold text-neutral-50">Administrator List</h2>
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
                            <span className={adm.adminPermissions?.manageTransactions ? 'text-emerald-500' : 'text-rose-500'}>
                              {adm.adminPermissions?.manageTransactions ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-neutral-400">Transaksi Foto</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={adm.adminPermissions?.manageClaims ? 'text-emerald-500' : 'text-rose-500'}>
                              {adm.adminPermissions?.manageClaims ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-neutral-400">Klaim Manual</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={adm.adminPermissions?.manageCategories ? 'text-emerald-500' : 'text-rose-500'}>
                              {adm.adminPermissions?.manageCategories ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-neutral-400">Event Categories</span>
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
                            {actionId === adm._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

        {/* Create Admin Form */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 h-fit">
          <div className="mb-6 border-b border-neutral-900 pb-4">
            <h2 className="text-lg font-bold text-neutral-50 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" /> Add New Admin
            </h2>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                placeholder="e.g. Admin Dua" 
                value={adminName} 
                onChange={(e) => setAdminName(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                placeholder="admin2@fotome.com" 
                value={adminEmail} 
                onChange={(e) => setAdminEmail(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Password</label>
              <input 
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
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Select Permissions</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permUsers} 
                    onChange={(e) => setPermUsers(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Users</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permEvents} 
                    onChange={(e) => setPermEvents(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Events</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permPayouts} 
                    onChange={(e) => setPermPayouts(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Payouts</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permTransactions} 
                    onChange={(e) => setPermTransactions(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Transaksi Foto</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permClaims} 
                    onChange={(e) => setPermClaims(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Klaim Manual</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permCategories} 
                    onChange={(e) => setPermCategories(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Event Categories</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={permLogs} 
                    onChange={(e) => setPermLogs(e.target.checked)} 
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-300">Activity Logs</span>
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full mt-4 rounded-xl py-3 shadow-lg shadow-primary-500/25 text-sm font-semibold" 
              disabled={isCreatingAdmin}
            >
              {isCreatingAdmin ? 'Creating...' : 'Create Admin Account'}
            </button>
          </form>
        </div>
      </div>

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
                      checked={editPermTransactions} 
                      onChange={(e) => setEditPermTransactions(e.target.checked)} 
                      className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-300">Transaksi Foto</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editPermClaims} 
                      onChange={(e) => setEditPermClaims(e.target.checked)} 
                      className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-300">Klaim Manual</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editPermCategories} 
                      onChange={(e) => setEditPermCategories(e.target.checked)} 
                      className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-300">Event Categories</span>
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
                  className="btn btn-secondary flex-1 py-2.5 rounded-xl text-sm font-semibold" 
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
                  className="btn btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-500/20" 
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
  );
}
