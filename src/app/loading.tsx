import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4 text-neutral-400">
      <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      <span className="text-xs tracking-wider animate-[pulse_2s_infinite]">Memuat halaman...</span>
    </div>
  );
}
