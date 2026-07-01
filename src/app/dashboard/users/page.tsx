'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'photographer' | 'admin' | 'superadmin';
  isVerified: boolean;
  googleOAuth?: { googleId?: string };
  createdAt: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const canManageUsers = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.manageUsers;

  const fetchUsers = useCallback(async (p = 1, searchVal = '', roleVal = '') => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/dashboard?usersPage=${p}&usersLimit=10&usersSearch=${encodeURIComponent(searchVal)}&usersRole=${roleVal}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setPage(data.pagination?.users?.page || 1);
        setTotalPages(data.pagination?.users?.totalPages || 1);
        setTotalUsers(data.pagination?.users?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect — only fires after user stops typing
  useEffect(() => {
    if (!initialLoadDone) return;
    const timer = setTimeout(() => fetchUsers(1, debouncedSearch, roleFilter), 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch, fetchUsers, roleFilter, initialLoadDone]);

  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !canManageUsers) {
      router.push('/dashboard');
      return;
    }

    if (canManageUsers) {
      timer = setTimeout(() => {
        fetchUsers(1, '', '').then(() => {
          setInitialLoadDone(true);
        });
      }, 0);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, canManageUsers, router, fetchUsers]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (status === 'loading' || (isLoading && !initialLoadDone)) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <PageHeaderSkeleton />
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
            <div className="h-6 bg-neutral-800 rounded w-1/4 animate-pulse" />
            <div className="h-6 bg-neutral-800 rounded w-16 animate-pulse" />
          </div>
          <TableSkeleton rows={8} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">User Management</h1>
        <p className="text-neutral-400 text-sm mt-1">View and manage registered users</p>
      </div>

      {/* Users Table */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6 pb-4 border-b border-neutral-900 justify-between items-center">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <h2 className="text-lg font-bold text-neutral-50">Registered Accounts</h2>
            <span className="badge badge-primary">{totalUsers} users</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-neutral-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              />
              {isSearching && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}
            </div>
            
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full sm:w-44 px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-neutral-300 text-sm focus:outline-none focus:border-primary-500 transition duration-200"
            >
              <option value="">Semua Peran</option>
              <option value="user">User</option>
              <option value="photographer">Photographer</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto border border-neutral-900 rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Login Via</th>
                <th className="px-6 py-4">Verifikasi</th>
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
                  <td className="px-6 py-4">
                    {user.googleOAuth?.googleId ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 font-semibold rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Google
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 font-semibold rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                        Email
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.googleOAuth?.googleId || user.isVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Terverifikasi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <XCircle className="w-3 h-3" /> Belum Verifikasi
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {users.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-5 mt-4">
            <button
              onClick={() => fetchUsers(page - 1, debouncedSearch, roleFilter)}
              disabled={page === 1}
              className="px-3.5 py-2 text-xs font-medium bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-neutral-300 disabled:opacity-40 disabled:hover:bg-neutral-950 transition duration-150"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-400 font-light">
              Page <span className="font-semibold text-neutral-200">{page}</span> of <span className="font-semibold text-neutral-200">{totalPages}</span>
            </span>
            <button
              onClick={() => fetchUsers(page + 1, debouncedSearch, roleFilter)}
              disabled={page === totalPages}
              className="px-3.5 py-2 text-xs font-medium bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-neutral-300 disabled:opacity-40 disabled:hover:bg-neutral-950 transition duration-150"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
