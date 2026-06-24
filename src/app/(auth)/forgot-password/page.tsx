'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(data.error || 'Terjadi kesalahan.');
      }
    } catch {
      setStatus('error');
      setMessage('Koneksi bermasalah. Coba lagi nanti.');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-12 bg-neutral-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5">
        
        {/* Back button */}
        <Link href="/login" className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
        </Link>

        {status === 'success' ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-50 mb-3">Tautan Reset Dikirim</h2>
            <p className="text-neutral-400 text-sm mb-6">
              Jika email <span className="text-neutral-50 font-medium">{email}</span> terdaftar di sistem kami, tautan untuk mereset password telah dikirimkan ke kotak masuk Anda.
            </p>
            <button 
              onClick={() => {
                setStatus('idle');
                setEmail('');
              }}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-50 rounded-xl text-sm font-semibold transition duration-200"
            >
              Coba Email Lain
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-primary-500/10 border border-primary-500/20 text-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-50 mb-2">Lupa Password?</h2>
              <p className="text-sm text-neutral-400">
                Masukkan alamat email Anda dan kami akan mengirimkan tautan untuk mereset password.
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
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-neutral-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-950/50 border border-neutral-800 rounded-xl text-sm text-neutral-50 placeholder-neutral-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition duration-200"
                    placeholder="nama@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className="btn btn-primary w-full py-3.5 rounded-xl text-sm font-semibold flex justify-center mt-2 shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Kirim Tautan Reset'
                )}
              </button>
            </form>
          </  >
        )}
      </div>
    </div>
  );
}
