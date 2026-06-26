import React from 'react';

export default function MyPhotosLoading() {
  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Cover Skeleton */}
        <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 text-center space-y-4">
            <div className="h-10 bg-neutral-900 border border-neutral-850 w-48 mx-auto rounded-2xl animate-pulse" />
            <div className="h-4 bg-neutral-900 border border-neutral-850 w-32 mx-auto rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Gallery Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-neutral-900/20 border border-neutral-900 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="w-full aspect-video bg-neutral-900 border-b border-neutral-900 animate-pulse" />
              <div className="p-5 space-y-4 flex-1 flex flex-col">
                <div className="bg-neutral-900/60 border border-neutral-850 animate-pulse rounded w-3/4 h-5 mb-2" />
                <div className="space-y-2">
                  <div className="bg-neutral-900/60 border border-neutral-850 animate-pulse rounded w-1/2 h-3" />
                  <div className="bg-neutral-900/60 border border-neutral-850 animate-pulse rounded w-2/3 h-3" />
                </div>
                <div className="mt-auto h-10 bg-neutral-900 border border-neutral-850 w-full rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
