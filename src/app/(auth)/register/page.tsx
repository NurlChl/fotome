'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';

import { signIn } from 'next-auth/react';
import { User, Mail, Lock, Loader2, Camera, ArrowLeft, AlertTriangle } from 'lucide-react';

function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role] = useState<'user' | 'photographer'>('user');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'Validation error' && data.details) {
          const errors = data.details as Record<string, string[]>;
          const msg = Object.entries(errors)
            .map(([field, msgs]) => {
              const fieldName = field === 'name' ? 'Nama' : field === 'email' ? 'Email' : 'Password';
              return `${fieldName}: ${msgs.join(', ')}`;
            })
            .join('; ');
          setError(`Error Validasi - ${msg}`);
        } else {
          setError(data.error || 'Pendaftaran gagal.');
        }
        return;
      }

      // Do not auto-login since email needs verification
      setIsSuccess(true);
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5 text-center">
        <div className="w-16 h-16 bg-primary-500/10 border border-primary-500/20 text-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-50 mb-3">Periksa Email Anda</h2>
        <p className="text-neutral-400 text-sm mb-6">
          Kami telah mengirimkan tautan verifikasi ke <span className="text-primary-400 font-medium">{email}</span>.
          Silakan periksa kotak masuk (atau folder spam) untuk mengaktifkan akun Anda.
        </p>
        <Link href="/login" className="btn btn-primary w-full py-3 rounded-xl text-sm font-semibold flex justify-center shadow-lg shadow-primary-500/20">
          Kembali ke Halaman Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5">
      
      {/* Back button */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Beranda
      </Link>

      <div className="text-center mb-8">
        <div className="mx-auto w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center mb-4">
          <Camera className="w-6 h-6 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Buat Akun Baru</h1>
        <p className="text-xs text-neutral-400 mt-2 font-light">Mulai temukan foto-foto menakjubkan Anda</p>
      </div>

      {error && (
        <div className="bg-error-bg border border-error-border text-error-text text-xs p-4 rounded-xl mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
          <div className="relative">
            <User className="absolute left-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              id="register-name"
              type="text"
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-neutral-50 text-sm placeholder-neutral-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              id="register-email"
              type="email"
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-neutral-50 text-sm placeholder-neutral-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              id="register-password"
              type="password"
              className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/60 border border-neutral-850 rounded-xl text-neutral-50 text-sm placeholder-neutral-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="Min. 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <span className="block text-[10px] text-neutral-500 mt-2 ml-1">
            * Password harus memiliki huruf besar, huruf kecil, dan angka.
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full py-3.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 mt-6"
          disabled={isLoading}
          id="register-submit"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            'Buat Akun'
          )}
        </button>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-neutral-800" />
          <span className="px-3 text-xs text-neutral-500 uppercase tracking-wider">Atau daftar dengan</span>
          <div className="flex-1 border-t border-neutral-800" />
        </div>

        <button
          type="button"
          className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-50 rounded-xl text-sm font-semibold transition duration-200 flex items-center justify-center gap-3 shadow-md"
          onClick={() => signIn('google', { callbackUrl: '/events' })}
          id="register-google"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google Account
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-neutral-500 border-t border-neutral-900 pt-6">
        Sudah memiliki akun? <Link href="/login" className="text-primary-400 hover:underline">Sign In</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen pt-28 pb-12 bg-neutral-950 bg-gradient-glow flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <Suspense fallback={
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
