import Link from 'next/link';
import { UserCheck, Search, Sparkles, Download, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Cara Kerja - FotoMe',
  description: 'Bagaimana cara menemukan dan mendapatkan foto Anda di FotoMe.',
};

export default function HowItWorksPage() {
  const steps = [
    {
      title: '1. Daftarkan Wajah',
      description: 'Buat akun dan unggah foto selfie Anda. Sistem Face Recognition kami akan mengenali wajah Anda secara aman dan privat.',
      icon: UserCheck,
    },
    {
      title: '2. Jelajahi Event',
      description: 'Cari event yang Anda hadiri di halaman Explore Events. Berbagai event dari fotografer profesional tersedia di sini.',
      icon: Search,
    },
    {
      title: '3. Temukan Foto',
      description: 'Sistem kami secara otomatis memindai dan menemukan semua foto Anda di event tersebut menggunakan kecerdasan buatan.',
      icon: Sparkles,
    },
    {
      title: '4. Beli & Unduh',
      description: 'Beli foto kenangan Anda dan unduh dalam resolusi tinggi tanpa watermark dengan mudah dan cepat.',
      icon: Download,
    },
  ];

  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="relative border-b border-neutral-900 py-16 mb-16 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-50 mb-6">Cara Kerja FotoMe</h1>
            <p className="text-neutral-400 text-base sm:text-lg font-light leading-relaxed">
              Dapatkan foto terbaik Anda dari berbagai event tanpa perlu mencarinya satu per satu. Teknologi <span className="text-primary-400 font-medium">Face Recognition</span> kami akan menemukan Anda dalam hitungan detik.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto relative z-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex flex-col items-center text-center group">
                <div className="w-20 h-20 rounded-3xl bg-neutral-900/50 border border-neutral-800 flex items-center justify-center mb-6 text-primary-500 group-hover:bg-primary-500/10 group-hover:border-primary-500/30 group-hover:-translate-y-2 transition duration-300 shadow-lg shadow-transparent group-hover:shadow-primary-500/10">
                  <Icon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-neutral-50 mb-3">{step.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed px-2">{step.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-24 text-center">
          <Link href="/register" className="btn btn-primary rounded-xl px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2 group shadow-lg shadow-primary-500/20">
            Mulai Sekarang <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
