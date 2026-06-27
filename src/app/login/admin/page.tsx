'use client';

import { useState, Suspense, useEffect } from 'react';
import { signIn, signOut, getSession, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role === 'admin' || role === 'superadmin') {
        router.push('/dashboard/admin');
      } else {
        setTimeout(() => {
          setError('Akses Ditolak: Akun Anda saat ini tidak memiliki hak akses Administrator. Hubungi Superadmin atau pastikan akun Anda sudah dipromosikan di database.');
        }, 0);
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        // Retrieve session to verify role
        const sessionData = await getSession();
        const role = sessionData?.user?.role;

        if (role === 'admin' || role === 'superadmin') {
          router.push('/dashboard/admin');
          router.refresh();
        } else {
          // Force sign out since regular users are blocked from admin portal
          await signOut({ redirect: false });
          setError('Akses Ditolak: Hanya akun Administrator yang dapat mengakses halaman ini.');
        }
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5">
      
      {/* Back button */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Beranda
      </Link>

      <div className="text-center mb-8">
        <div className="mx-auto w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Portal Administrator</h1>
        <p className="text-xs text-neutral-400 mt-2">Sign in untuk masuk ke CMS FotoMe</p>
      </div>

      {error && (
        <div className="bg-error-bg border border-error-border text-error-text text-xs p-4 rounded-xl mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              id="admin-email"
              type="email"
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-neutral-50 text-sm placeholder-neutral-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="admin@fotome.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="admin-password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider ml-1">Password</label>
            <Link href="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">Lupa Password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              id="admin-password"
              type="password"
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-neutral-50 text-sm placeholder-neutral-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="Masukkan password Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full py-3.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 mt-6"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            'Sign In to Admin Console'
          )}
        </button>
      </form>

      <div className="mt-8 text-center border-t border-neutral-900 pt-6">
        <span className="text-xs text-neutral-500">Bukan Administrator? <Link href="/login" className="text-primary-400 hover:underline">Login User</Link></span>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen pt-28 pb-12 bg-neutral-950 bg-gradient-glow flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <Suspense fallback={
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
      }>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
