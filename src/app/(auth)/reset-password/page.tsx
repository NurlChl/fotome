'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-neutral-50 mb-3">Akses Tidak Valid</h2>
        <p className="text-neutral-400 text-sm mb-6">Token reset password tidak ditemukan di URL.</p>
        <Link href="/login" className="btn btn-primary w-full py-3 rounded-xl text-sm font-semibold flex justify-center">
          Kembali ke Halaman Login
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Password tidak cocok.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(data.error || 'Gagal mereset password.');
      }
    } catch {
      setStatus('error');
      setMessage('Koneksi bermasalah. Coba lagi nanti.');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-50 mb-3">Password Berhasil Direset</h2>
        <p className="text-neutral-400 text-sm mb-6">
          Password Anda telah berhasil diubah. Silakan login menggunakan password baru Anda.
        </p>
        <Link href="/login" className="btn btn-primary w-full py-3 rounded-xl text-sm font-semibold flex justify-center shadow-lg shadow-primary-500/20">
          Masuk Sekarang
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-neutral-50 mb-2">Buat Password Baru</h2>
        <p className="text-sm text-neutral-400">
          Masukkan password baru Anda di bawah ini (minimal 8 karakter).
        </p>
      </div>

      {status === 'error' && (
        <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl text-sm text-primary-400 text-center">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
            Password Baru
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-neutral-500" />
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/50 border border-neutral-800 rounded-xl text-sm text-neutral-50 placeholder-neutral-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition duration-200"
              placeholder="Min. 8 karakter"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
            Konfirmasi Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-neutral-500" />
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/50 border border-neutral-800 rounded-xl text-sm text-neutral-50 placeholder-neutral-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition duration-200"
              placeholder="Ketik ulang password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn btn-primary w-full py-3.5 rounded-xl text-sm font-semibold flex justify-center mt-4 shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Password Baru'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen pt-28 pb-12 bg-neutral-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5">
        <Suspense fallback={
          <div className="flex justify-center"><Loader2 className="w-8 h-8 text-primary-500 animate-spin" /></div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
