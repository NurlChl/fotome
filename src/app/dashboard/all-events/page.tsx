'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowUpRight, Edit2, Trash2 } from 'lucide-react';

interface EventData {
  _id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  photoCount: number;
  eventDate: string;
  coverImage?: string;
  pricePerPhoto: number;
  photographerId?: {
    _id: string;
    name: string;
    email: string;
  };
}

export default function AllEventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);

  const isSuperadmin = session?.user?.role === 'superadmin';
  const canManageEvents = isSuperadmin || !!session?.user?.permissions?.manageEvents;

  async function fetchAllEvents(p = 1) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?eventsPage=${p}&eventsLimit=10`);
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events || []);
        setPage(data.pagination?.events?.page || 1);
        setTotalPages(data.pagination?.events?.totalPages || 1);
        setTotalEvents(data.pagination?.events?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated') {
      const role = session?.user?.role;
      
      // Security check - only admin/superadmin
      if (role !== 'admin' && role !== 'superadmin') {
        router.push('/');
        return;
      }

      // Check permission
      if (!canManageEvents) {
        router.push('/dashboard');
        return;
      }

      timer = setTimeout(() => {
        fetchAllEvents(1);
      }, 0);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, session, canManageEvents, router]);

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete event "${eventTitle}"? This action cannot be undone.`)) {
      return;
    }

    setActionId(eventId);

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Event "${eventTitle}" deleted successfully!`);
        fetchAllEvents(page);
      } else {
        throw new Error(data.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setActionId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Header Skeleton */}
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-neutral-900 rounded w-64" />
          <div className="h-4 bg-neutral-900 rounded w-96" />
        </div>

        {/* Table Skeleton */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
            <div className="h-6 bg-neutral-800 rounded w-32 animate-pulse" />
            <div className="h-6 bg-neutral-800 rounded-full w-20 animate-pulse" />
          </div>
          <div className="overflow-x-auto border border-neutral-900 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-950/50 border-b border-neutral-900">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={i} className="px-6 py-4">
                      <div className="h-4 bg-neutral-800 rounded animate-pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-neutral-900 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">All Platform Events</h1>
        <p className="text-neutral-400 text-sm mt-1">View and manage all events from all photographers</p>
      </div>

      {/* Events Table */}
      <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-neutral-800/50 pb-4">
          <h2 className="text-lg font-bold text-neutral-50">Platform Events</h2>
          <span className="badge badge-primary">{totalEvents} events</span>
        </div>
        <div className="overflow-x-auto border border-neutral-800/50 rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-950/50 border-b border-neutral-800/50 text-neutral-400 text-xs uppercase font-medium">
                <th className="px-6 py-4">Cover</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Uploader</th>
                <th className="px-6 py-4">Photo Count</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {events.map((event) => (
                <tr key={event._id} className="hover:bg-neutral-900/10 text-neutral-300">
                  <td className="px-6 py-4">
                    {event.coverImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={event.coverImage} alt="" className="w-12 h-12 rounded-lg object-cover border border-neutral-850" />
                    ) : (
                      <div className="w-12 h-12 bg-neutral-900 border border-neutral-850 rounded-lg flex items-center justify-center font-bold text-neutral-600 text-[10px]">NO IMG</div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-neutral-50">
                    <Link href={`/events/${event.slug}`} target="_blank" className="hover:text-primary-400 hover:underline flex items-center gap-1.5">
                      {event.title}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-neutral-50">{event.photographerId?.name || 'Admin'}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{event.photographerId?.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4">{event.photoCount} photos</td>
                  <td className="px-6 py-4 font-semibold">
                    {event.pricePerPhoto === 0 ? (
                      <span className="text-emerald-500">FREE</span>
                    ) : (
                      <span className="text-neutral-50">{formatPrice(event.pricePerPhoto)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{formatDate(event.eventDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                      event.status === 'published' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 
                      event.status === 'draft' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                      'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/events/${event.slug}`}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 rounded-lg transition"
                        title="Manage event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteEvent(event._id, event.title)}
                        disabled={actionId === event._id}
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg transition disabled:opacity-50"
                        title="Delete event"
                      >
                        {actionId === event._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">
              No events found.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {events.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-5 mt-4">
            <button
              onClick={() => fetchAllEvents(page - 1)}
              disabled={page === 1}
              className="px-3.5 py-2 text-xs font-medium bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-neutral-300 disabled:opacity-40 disabled:hover:bg-neutral-950 transition duration-150"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-400 font-light">
              Page <span className="font-semibold text-neutral-200">{page}</span> of <span className="font-semibold text-neutral-200">{totalPages}</span>
            </span>
            <button
              onClick={() => fetchAllEvents(page + 1)}
              disabled={page === totalPages}
              className="px-3.5 py-2 text-xs font-medium bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-neutral-300 disabled:opacity-40 disabled:hover:bg-neutral-950 transition duration-150"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
