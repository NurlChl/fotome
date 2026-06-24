'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DashboardSettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(session?.user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (status === 'loading') {
    return (
      <div className="space-y-6 animate-fadeIn max-w-4xl">
        {/* Header Skeleton */}
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-neutral-900 rounded w-48" />
          <div className="h-4 bg-neutral-900 rounded w-64" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Card Skeleton */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-6 border-b border-neutral-900 pb-4">
              <div className="w-5 h-5 bg-neutral-800 rounded" />
              <div className="h-6 bg-neutral-800 rounded w-40" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-neutral-800 rounded w-20" />
                  <div className="h-12 bg-neutral-950 border border-neutral-900 rounded-xl" />
                </div>
              ))}
              <div className="h-12 bg-neutral-800 rounded-xl mt-6" />
            </div>
          </div>

          {/* Password Card Skeleton */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-6 border-b border-neutral-900 pb-4">
              <div className="w-5 h-5 bg-neutral-800 rounded" />
              <div className="h-6 bg-neutral-800 rounded w-40" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-neutral-800 rounded w-24" />
                  <div className="h-12 bg-neutral-950 border border-neutral-900 rounded-xl" />
                </div>
              ))}
              <div className="h-12 bg-neutral-800 rounded-xl mt-6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login/admin');
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMessage('Profile updated successfully!');
        await update({ name });
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setSuccessMessage('');
    setErrorMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      setIsChangingPassword(false);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      setIsChangingPassword(false);
      return;
    }

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(data.error || 'Failed to change password');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">Dashboard Settings</h1>
        <p className="text-neutral-400 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-success-bg border border-success-border text-success-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-800/50 pb-4">
            <User className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-bold text-neutral-50">Profile Information</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-500 text-sm cursor-not-allowed" 
                value={session?.user?.email || ''} 
                disabled 
              />
              <p className="text-xs text-neutral-600 mt-1.5">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Role</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-500 text-sm cursor-not-allowed capitalize" 
                value={session?.user?.role || ''} 
                disabled 
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full rounded-xl py-3 shadow-lg shadow-primary-500/25 text-sm font-semibold" 
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Password Settings */}
        <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-800/50 pb-4">
            <Lock className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-bold text-neutral-50">Change Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Current Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">New Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                minLength={8}
              />
              <p className="text-xs text-neutral-600 mt-1.5">Must be at least 8 characters</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Confirm New Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800/50 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                minLength={8}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full rounded-xl py-3 shadow-lg shadow-primary-500/25 text-sm font-semibold" 
              disabled={isChangingPassword}
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
