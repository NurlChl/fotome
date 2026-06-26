'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PartyPopper, PersonStanding, Music, GraduationCap, Heart, Building2, Users, Camera, MapPin, Calendar, Search } from 'lucide-react';

interface EventData {
  _id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  location: { name: string };
  eventDate: string;
  coverImage?: string;
  photoCount: number;
  pricePerPhoto: number;
  photographerId?: { name: string; avatar?: string };
}

const CATEGORIES = [
  { value: 'all', label: 'All Events', icon: PartyPopper },
  { value: 'marathon', label: 'Marathon', icon: PersonStanding },
  { value: 'concert', label: 'Concert', icon: Music },
  { value: 'graduation', label: 'Graduation', icon: GraduationCap },
  { value: 'wedding', label: 'Wedding', icon: Heart },
  { value: 'corporate', label: 'Corporate', icon: Building2 },
  { value: 'community', label: 'Community', icon: Users },
  { value: 'other', label: 'Other', icon: Camera },
];

export default function EventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(category !== 'all' && { category }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEvents(data.events);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, category, search]);

  useEffect(() => {
    setTimeout(() => fetchEvents(), 0);
  }, [fetchEvents]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
        {/* Glow highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-50 mb-4">Explore Events</h1>
          <p className="text-neutral-400 text-sm sm:text-base font-light">Find your photos from recent events</p>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-neutral-900/50 border border-neutral-800/50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-xl pl-11 pr-4 py-3 text-sm text-neutral-50 placeholder:text-neutral-500 transition outline-none"
              id="events-search"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full md:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  category === cat.value 
                    ? 'bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/20' 
                    : 'bg-neutral-900/50 border-neutral-800/50 text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800'
                }`}
                onClick={() => {
                  setCategory(cat.value);
                  setPage(1);
                }}
              >
                <span className="flex items-center justify-center">
                  {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
                </span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-neutral-900/20 border border-neutral-800/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="w-full aspect-video bg-neutral-800/50 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="bg-neutral-800/50 animate-pulse rounded w-3/4 h-5 mb-2" />
                  <div className="bg-neutral-800/50 animate-pulse rounded w-1/2 h-3" />
                  <div className="bg-neutral-800/50 animate-pulse rounded w-2/3 h-3 mb-4" />
                  <div className="border-t border-neutral-900/50 pt-4 flex justify-between">
                    <div className="bg-neutral-800/50 animate-pulse rounded w-1/3 h-4" />
                    <div className="bg-neutral-800/50 animate-pulse rounded w-1/4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {events.map((event) => (
                <Link
                  href={`/events/${event.slug}`}
                  key={event._id}
                  className="group bg-neutral-900/30 border border-neutral-900 rounded-2xl overflow-hidden hover:border-neutral-800 transition duration-300 flex flex-col"
                >
                  <div className="relative w-full aspect-video overflow-hidden bg-neutral-950">
                    {event.coverImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={event.coverImage} 
                        alt={event.title} 
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                        <span className="flex items-center justify-center w-full h-full text-neutral-800">
                          <Camera className="w-10 h-10" />
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-neutral-950/80 backdrop-blur-md border border-neutral-800/50 text-neutral-50 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                      {CATEGORIES.find((c) => c.value === event.category)?.label || event.category}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col grow space-y-1 overflow-hidden">
                    <div className="text-sm font-bold text-neutral-50 truncate group-hover/card:text-primary-400 transition-colors">{event.title}</div>
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{event.location.name}</span>
                    </div>
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" /> {formatDate(event.eventDate)}
                    </div>
                    <div className="mt-auto pt-4 border-t border-neutral-900/50 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-medium bg-neutral-900/80 px-2 py-1 rounded-md">
                        <Camera className="w-3 h-3" /> {event.photoCount} photos
                      </span>
                      <span className="text-sm font-bold text-primary-400 font-display">
                        {event.pricePerPhoto === 0 ? <span className="text-emerald-400">FREE</span> : `${formatPrice(event.pricePerPhoto)}`}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12 mb-8">
                <button
                  className="btn btn-secondary btn-sm px-4 rounded-lg text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ← Previous
                </button>
                <span className="text-xs text-neutral-500 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm px-4 rounded-lg text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-neutral-800/50 border-dashed rounded-3xl bg-neutral-900/10 shadow-sm">
            <div className="mb-4 p-4 rounded-full bg-neutral-900/50 border border-neutral-800/50 inline-flex shadow-sm">
              <Search className="w-8 h-8 text-neutral-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-50 mb-2">No events found</h3>
            <p className="text-xs text-neutral-500 font-light">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
