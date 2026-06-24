'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users as UsersIcon, Loader2 } from 'lucide-react';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'photographer' | 'admin' | 'superadmin';
  createdAt: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManageUsers = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.manageUsers;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !canManageUsers) {
      router.push('/dashboard');
      return;
    }

    if (canManageUsers) {
      fetchUsers();
    }
  }, [status, canManageUsers, router]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }

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
        <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
          <h2 className="text-lg font-bold text-neutral-50">Registered Accounts</h2>
          <span className="badge badge-primary">{users.length} users</span>
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
    </div>
  );
}
