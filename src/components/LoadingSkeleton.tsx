export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-neutral-900 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-neutral-950/50 border-b border-neutral-900">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <div className="h-4 bg-neutral-800 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-6 py-4">
                  <div className="h-4 bg-neutral-900 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-6 bg-neutral-800 rounded w-1/3" />
        <div className="h-4 bg-neutral-800 rounded w-2/3" />
        <div className="h-32 bg-neutral-800 rounded" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="border border-neutral-900 rounded-2xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-neutral-800 rounded w-1/3" />
        <div className="w-10 h-10 bg-neutral-800 rounded-xl" />
      </div>
      <div className="h-8 bg-neutral-800 rounded w-1/2" />
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-8 bg-neutral-900 rounded w-1/4" />
      <div className="h-4 bg-neutral-900 rounded w-1/3" />
    </div>
  );
}
