'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? 'Memverifikasi email Anda...' : 'Token verifikasi tidak ditemukan.');

  useEffect(() => {
    if (!token) {
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage('Email berhasil diverifikasi! Akun Anda sudah aktif.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Gagal memverifikasi email.');
        }
      } catch {
        setStatus('error');
        setMessage('Terjadi kesalahan. Silakan coba lagi nanti.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="w-full max-w-md bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-primary-500/5 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
        status === 'loading' ? 'bg-neutral-800 border-neutral-700 text-neutral-400' :
        status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
        'bg-primary-500/10 border-primary-500/20 text-primary-500'
      }`}>
        {status === 'loading' && <Loader2 className="w-8 h-8 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-8 h-8" />}
        {status === 'error' && <XCircle className="w-8 h-8" />}
      </div>
      
      <h2 className="text-2xl font-bold text-neutral-50 mb-3">
        {status === 'loading' ? 'Verifikasi Email' : status === 'success' ? 'Aktivasi Berhasil' : 'Verifikasi Gagal'}
      </h2>
      
      <p className="text-neutral-400 text-sm mb-8">
        {message}
      </p>

      {status !== 'loading' && (
        <Link 
          href="/login" 
          className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-50 rounded-xl text-sm font-semibold transition duration-200 flex items-center justify-center gap-2"
        >
          Masuk ke Akun Anda <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen pt-28 pb-12 bg-neutral-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <Suspense fallback={
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
