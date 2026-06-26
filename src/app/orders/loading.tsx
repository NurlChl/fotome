import React from 'react';

export default function OrdersLoading() {
  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Cover Skeleton */}
        <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 text-center space-y-4">
            <div className="h-10 bg-neutral-900 border border-neutral-850 w-48 mx-auto rounded-2xl animate-pulse" />
            <div className="h-4 bg-neutral-900 border border-neutral-850 w-64 mx-auto rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Orders list skeleton */}
        <div className="max-w-4xl mx-auto space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-neutral-900/10 border border-neutral-900 rounded-3xl overflow-hidden animate-pulse">
              <div className="p-6 border-b border-neutral-900/50 bg-neutral-900/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                  <div className="h-5 bg-neutral-900 border border-neutral-850 w-36 rounded-lg" />
                  <div className="h-3.5 bg-neutral-900 border border-neutral-850 w-24 rounded-lg" />
                </div>
                <div className="h-7 bg-neutral-900 border border-neutral-850 w-16 rounded-full" />
              </div>
              <div className="p-6 flex gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-850" />
                ))}
              </div>
              <div className="p-6 border-t border-neutral-900/50 bg-neutral-900/20 flex justify-between items-center">
                <div className="space-y-2">
                  <div className="h-3 bg-neutral-900 border border-neutral-850 w-20 rounded" />
                  <div className="h-5 bg-neutral-900 border border-neutral-850 w-28 rounded-lg" />
                </div>
                <div className="h-10 bg-neutral-900 border border-neutral-850 w-32 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
