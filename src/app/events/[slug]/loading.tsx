import React from 'react';

export default function EventDetailLoading() {
  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      {/* Cover Area Skeleton */}
      <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10 space-y-4">
          <div className="h-4 bg-neutral-900 border border-neutral-850 w-32 rounded-lg animate-pulse" />
          <div className="h-8 bg-neutral-900 border border-neutral-850 w-1/2 rounded-xl animate-pulse" />
          <div className="flex gap-4">
            <div className="h-4 bg-neutral-900 border border-neutral-850 w-24 rounded-lg animate-pulse" />
            <div className="h-4 bg-neutral-900 border border-neutral-850 w-24 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content Grid Skeleton */}
      <div className="container mx-auto px-6 max-w-7xl space-y-8">
        {/* Tab bar skeleton */}
        <div className="flex justify-center mb-8 border-b border-neutral-900 pb-px">
          <div className="bg-neutral-900 border border-neutral-800 w-64 h-10 rounded-2xl animate-pulse" />
        </div>
        
        {/* Photo Grid Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-4/3 rounded-2xl bg-neutral-900/30 border border-neutral-900 animate-pulse overflow-hidden" />
          ))}
        </div>
      </div>
    </div>
  );
}
