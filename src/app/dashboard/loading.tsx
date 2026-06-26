import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 bg-neutral-950 min-h-screen text-neutral-100 pt-24">
      {/* Heading */}
      <div className="h-8 bg-neutral-900 border border-neutral-850 w-48 rounded-xl animate-pulse" />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-neutral-900/40 border border-neutral-900 rounded-2xl animate-pulse" />
        ))}
      </div>

      {/* Main section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-neutral-900/40 border border-neutral-900 rounded-2xl animate-pulse" />
        <div className="h-96 bg-neutral-900/40 border border-neutral-900 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
