import Link from 'next/link';
import { Search, UserCheck, Image as ImageIcon, Shield, Zap, Target, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-neutral-950 text-neutral-100 min-h-screen">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-primary-500/5 blur-[120px] -top-40 -left-40" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-36 pb-20 lg:pt-44 lg:pb-32 px-6">
        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 px-3.5 py-1 rounded-md text-xs font-medium tracking-wider text-primary-600 uppercase mx-auto lg:mx-0">
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-pulse" />
              AI Face Recognition
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Find Your <span className="text-primary-600">Event Photos</span> in Seconds
            </h1>

            <p className="text-neutral-400 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-light">
              Unggah selfie Anda dan biarkan AI kami memindai ribuan foto dari marathon, konser, pernikahan, dan event lainnya secara instan.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link href="/events" className="btn btn-primary btn-lg w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg">
                <Search className="w-4 h-4" /> Cari Foto Saya
              </Link>
            </div>

            {/* Hero Stats */}
            <div className="flex items-center justify-center lg:justify-start gap-8 pt-8 border-t border-neutral-900 mt-8 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="text-2xl font-semibold text-neutral-50 font-display">10K+</div>
                <div className="text-xs text-neutral-500 mt-0.5">Photos Uploaded</div>
              </div>
              <div className="w-px h-8 bg-neutral-900" />
              <div>
                <div className="text-2xl font-semibold text-neutral-50 font-display">500+</div>
                <div className="text-xs text-neutral-500 mt-0.5">Active Events</div>
              </div>
              <div className="w-px h-8 bg-neutral-900" />
              <div>
                <div className="text-2xl font-semibold text-neutral-50 font-display">98%</div>
                <div className="text-xs text-neutral-500 mt-0.5">Match Accuracy</div>
              </div>
            </div>
          </div>

          {/* Hero Visual Scan Animation */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="w-full max-w-[360px] aspect-4/5 bg-neutral-900/20 backdrop-blur-md border border-neutral-800 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden shadow-xl">
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary-600" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary-600" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary-600" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary-600" />
              
              {/* Scan line animation */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-600 shadow-[0_0_12px_rgba(225,29,72,0.8)] animate-[scanLine_4s_linear_infinite]" style={{
                animationName: 'scanLine',
                animationDuration: '4s',
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear'
              }} />

              {/* Face silhouette placeholder */}
              <div className="flex-1 flex items-center justify-center">
                <svg viewBox="0 0 120 140" className="w-36 h-36 text-primary-600/10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <ellipse cx="60" cy="65" rx="42" ry="50" />
                  <circle cx="45" cy="55" r="4" />
                  <circle cx="75" cy="55" r="4" />
                  <path d="M52 82 Q60 90 68 82" strokeLinecap="round" />
                  <path d="M57 70 L60 76 L63 70" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Match tag */}
              <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Match Found! (98%)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-20 bg-neutral-950/40 border-y border-neutral-900 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-400">Cara Kerja</span>
            <h2 className="text-3xl font-extrabold text-neutral-50">Cari Foto Anda dalam 3 Langkah Mudah</h2>
            <p className="text-neutral-500 text-sm font-light leading-relaxed">
              Tidak perlu membuang waktu menelusuri ribuan foto secara manual. Biarkan AI kami yang melakukannya.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <div className="space-y-4 text-center">
              <div className="mx-auto w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center font-bold text-neutral-50 text-lg">
                <Search className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-neutral-500 text-xs font-bold tracking-widest font-mono">STEP 01</div>
              <h3 className="text-lg font-bold text-neutral-50">Pilih Event</h3>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mx-auto font-light">
                Temukan event olahraga, wisuda, atau konser musik yang Anda hadiri di platform.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 text-center">
              <div className="mx-auto w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center font-bold text-neutral-50 text-lg">
                <UserCheck className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-neutral-500 text-xs font-bold tracking-widest font-mono">STEP 02</div>
              <h3 className="text-lg font-bold text-neutral-50">Ambil Selfie</h3>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mx-auto font-light">
                Unggah foto selfie Anda. Pemindaian wajah dilakukan secara aman di web browser Anda.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 text-center">
              <div className="mx-auto w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center font-bold text-neutral-50 text-lg">
                <ImageIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-neutral-500 text-xs font-bold tracking-widest font-mono">STEP 03</div>
              <h3 className="text-lg font-bold text-neutral-50">Unduh Foto</h3>
              <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mx-auto font-light">
                Lihat hasil pencocokan wajah Anda, lalu unduh versi resolusi tinggi secara gratis atau berbayar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600">Keunggulan</span>
            <h2 className="text-3xl font-extrabold text-neutral-50">Didesain dengan Privasi dan Kecepatan Tinggi</h2>
            <p className="text-neutral-500 text-sm font-light leading-relaxed">
              Kami menjamin keamanan data wajah Anda sembari menyajikan pencarian foto berkecepatan tinggi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-6 space-y-3 hover:border-neutral-700 transition duration-300">
              <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-base font-bold text-neutral-50">Privasi Terjaga</h3>
              <p className="text-neutral-500 text-xs sm:text-sm font-light leading-relaxed">
                Data wajah Anda diproses secara lokal di browser Anda. Kami tidak pernah menyimpan gambar selfie Anda di server kami.
              </p>
            </div>

            <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-6 space-y-3 hover:border-neutral-700 transition duration-300">
              <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-base font-bold text-neutral-50">Pencarian Kilat</h3>
              <p className="text-neutral-500 text-xs sm:text-sm font-light leading-relaxed">
                Dapatkan hasil pencocokan foto dalam waktu kurang dari 3 detik berkat kecerdasan pencarian vektor berbasis AI.
              </p>
            </div>

            <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-6 space-y-3 hover:border-neutral-700 transition duration-300">
              <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center mb-2">
                <Target className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-base font-bold text-neutral-50">98% Akurasi</h3>
              <p className="text-neutral-500 text-xs sm:text-sm font-light leading-relaxed">
                Pemodelan deep learning tingkat lanjut mendeteksi wajah Anda dengan sangat akurat meski sudut pengambilan miring atau minim pencahayaan.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="relative z-10 py-20 text-center px-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-50">Siap untuk Menemukan Foto Anda?</h2>
          <p className="text-neutral-500 text-sm max-w-lg mx-auto leading-relaxed font-light">
            Bergabunglah bersama ribuan pengguna yang telah menemukan dokumentasi foto mereka di FotoMe secara praktis.
          </p>
          <Link href="/events" className="btn btn-primary btn-lg inline-flex items-center gap-2 rounded-lg py-4">
            Get Started — Coba Sekarang <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
