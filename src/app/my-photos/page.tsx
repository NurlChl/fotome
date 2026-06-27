'use client';

import { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Download, Loader2, X, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react';

interface PurchasedPhoto {
  _id: string;
  thumbnailUrl: string;
  watermarkedUrl: string;
  cloudinaryUrl: string;
  eventTitle: string;
  eventSlug: string;
  purchasedAt: string;
  orderNumber: string;
}

interface OrderItemResponse {
  photoId: {
    _id: string;
    thumbnailUrl: string;
    watermarkedUrl: string;
    cloudinaryUrl: string;
  };
  eventId: {
    title: string;
    slug: string;
  };
}

interface OrderResponse {
  status: string;
  paidAt?: string;
  createdAt: string;
  orderNumber: string;
  items: OrderItemResponse[];
}

interface EventOption {
  title: string;
  slug: string;
}

function MyPhotos() {
  const { status } = useSession();
  const router = useRouter();
  const [photos, setPhotos] = useState<PurchasedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedEventSlug, setSelectedEventSlug] = useState<string>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PurchasedPhoto | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    console.log('[DEBUG-MYPHOTOS] useSession status:', status);
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/my-photos');
      return;
    }

    const fetchPurchasedPhotos = async () => {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (res.ok && data.orders) {
          const fetchedPhotos: PurchasedPhoto[] = [];
          data.orders.forEach((order: OrderResponse) => {
            if (order.status === 'paid') {
              order.items.forEach((item: OrderItemResponse) => {
                // Avoid duplicates if user purchased same photo multiple times (shouldn't happen, but safe check)
                if (!fetchedPhotos.some((p) => p._id === item.photoId._id)) {
                  fetchedPhotos.push({
                    _id: item.photoId._id,
                    thumbnailUrl: item.photoId.thumbnailUrl,
                    watermarkedUrl: item.photoId.watermarkedUrl,
                    cloudinaryUrl: item.photoId.cloudinaryUrl || item.photoId.thumbnailUrl,
                    eventTitle: item.eventId.title,
                    eventSlug: item.eventId.slug,
                    purchasedAt: order.paidAt || order.createdAt,
                    orderNumber: order.orderNumber,
                  });
                }
              });
            }
          });
          setPhotos(fetchedPhotos);
        }
      } catch (error) {
        console.error('Error fetching purchased photos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchPurchasedPhotos();
    }
  }, [status, router]);

  const handleDownload = async (photoId: string, orderNumber: string) => {
    setDownloadingId(photoId);
    try {
      const res = await fetch(`/api/photos/${photoId}/download?download=true`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download photo');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `FotoMe-${orderNumber}-${photoId.substring(18)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download handler error:', error);
      alert(error instanceof Error ? error.message : 'Failed to download photo. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Build unique event options from purchased photos
  const eventOptions = useMemo<EventOption[]>(() => {
    const map = new Map<string, string>();
    photos.forEach((p) => {
      if (!map.has(p.eventSlug)) {
        map.set(p.eventSlug, p.eventTitle);
      }
    });
    return [{ title: 'Semua Event', slug: 'all' }, ...Array.from(map.entries()).map(([slug, title]) => ({ slug, title }))];
  }, [photos]);

  const filteredEventOptions = useMemo(() => {
    const term = eventSearch.trim().toLowerCase();
    if (!term) return eventOptions;
    return eventOptions.filter((e) => e.title.toLowerCase().includes(term));
  }, [eventOptions, eventSearch]);

  const filteredPhotos = useMemo(() => {
    if (selectedEventSlug === 'all') return photos;
    return photos.filter((p) => p.eventSlug === selectedEventSlug);
  }, [photos, selectedEventSlug]);

  const handleOpenPreview = (photo: PurchasedPhoto, index: number) => {
    setPreviewPhoto(photo);
    setPreviewIndex(index);
  };

  const handlePrevPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewIndex > 0) {
      const newIndex = previewIndex - 1;
      setPreviewIndex(newIndex);
      setPreviewPhoto(filteredPhotos[newIndex]);
    }
  }, [previewIndex, filteredPhotos]);

  const handleNextPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewIndex < filteredPhotos.length - 1) {
      const newIndex = previewIndex + 1;
      setPreviewIndex(newIndex);
      setPreviewPhoto(filteredPhotos[newIndex]);
    }
  }, [previewIndex, filteredPhotos]);

  const selectedEventTitle = useMemo(() => {
    return eventOptions.find((e) => e.slug === selectedEventSlug)?.title || 'Semua Event';
  }, [eventOptions, selectedEventSlug]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    }
    if (isEventDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEventDropdownOpen]);

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (!previewPhoto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && previewIndex > 0) {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight' && previewIndex < filteredPhotos.length - 1) {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        setPreviewPhoto(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPhoto, previewIndex, filteredPhotos, handlePrevPhoto, handleNextPhoto]);

  // Touch/swipe navigation for preview modal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && previewIndex < filteredPhotos.length - 1) {
        // Swipe left - go to next
        handleNextPhoto();
      } else if (diff < 0 && previewIndex > 0) {
        // Swipe right - go to previous
        handlePrevPhoto();
      }
    }
  };

  // Hide header when preview is active
  useEffect(() => {
    if (previewPhoto) {
      document.body.classList.add('preview-modal-open');
    } else {
      document.body.classList.remove('preview-modal-open');
    }
    return () => {
      document.body.classList.remove('preview-modal-open');
    };
  }, [previewPhoto]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="pt-28 min-h-screen pb-24 bg-white dark:bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-600 dark:text-neutral-400 text-sm">Loading your photos...</p>
      </div>
    );
  }

  return (
    <div className="pt-28 min-h-screen pb-24 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="relative border-b border-neutral-200 dark:border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

          <div className="relative z-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 mb-4">My Gallery</h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base font-light">
              You have purchased {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              Showing {filteredPhotos.length} of {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </div>

            {/* Event filter dropdown with search */}
            <div className="relative w-full sm:w-72" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsEventDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-100 hover:border-neutral-400 dark:hover:border-neutral-700 transition"
              >
                <span className="truncate">{selectedEventTitle}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isEventDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isEventDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-30 overflow-hidden">
                  <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        type="text"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Cari event..."
                        className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-neutral-950 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredEventOptions.length > 0 ? (
                      filteredEventOptions.map((evt) => (
                        <button
                          key={evt.slug}
                          type="button"
                          onClick={() => {
                            setSelectedEventSlug(evt.slug);
                            setIsEventDropdownOpen(false);
                            setEventSearch('');
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                            selectedEventSlug === evt.slug ? 'text-primary-400 bg-primary-500/5' : 'text-neutral-900 dark:text-neutral-200'
                          }`}
                        >
                          {evt.title}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-500">Tidak ada event ditemukan</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {filteredPhotos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPhotos.map((photo, index) => (
              <div key={photo._id} className="group bg-neutral-900/30 border border-neutral-900 rounded-2xl overflow-hidden hover:border-neutral-800 transition duration-300 flex flex-col">
                <div className="relative w-full aspect-video overflow-hidden bg-neutral-950 cursor-pointer" onClick={() => handleOpenPreview(photo, index)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl} alt={photo.eventTitle} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-medium px-2.5 py-1 bg-black/65 text-white rounded-full backdrop-blur-sm border border-white/10">
                      Preview
                    </span>
                  </div>
                </div>
                <div className="p-5 flex flex-col grow">
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-3 line-clamp-1">{photo.eventTitle}</div>
                  <div className="flex flex-col gap-1 mb-6 text-xs text-neutral-600 dark:text-neutral-400 font-light">
                    <span>Purchased: {formatDate(photo.purchasedAt)}</span>
                    <span>Order: #{photo.orderNumber}</span>
                  </div>
                  <button
                    className="mt-auto w-full btn btn-primary flex items-center justify-center gap-2 rounded-xl text-sm py-2.5"
                    onClick={() => handleDownload(photo._id, photo.orderNumber)}
                    disabled={downloadingId === photo._id}
                    id={`btn-download-${photo._id}`}
                  >
                    {downloadingId === photo._id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Download High-Res
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-neutral-200 dark:border-neutral-900 border-dashed rounded-3xl bg-neutral-50 dark:bg-neutral-900/10">
            <div className="mb-4 p-4 rounded-full bg-neutral-200 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800 inline-flex text-neutral-500">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-2">{photos.length > 0 ? 'No photos in selected event' : 'No photos found'}</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-500 font-light mb-6 max-w-sm mx-auto">
              {photos.length > 0
                ? 'Try selecting a different event from the filter above.'
                : "You haven't purchased any photos yet. Visit events to search for your photos!"}
            </p>
            <Link href="/events" className="btn btn-primary rounded-xl px-6 py-2">
              Browse Events
            </Link>
          </div>
        )}
      </div>

      {/* Preview Modal - unwatermarked because photo is already purchased */}
      {previewPhoto && (
        <div className="fixed inset-0 z-150 bg-black/95 flex flex-col overflow-hidden animate-fadeIn" onClick={() => setPreviewPhoto(null)}>
          {/* Header / Top Bar */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/80 backdrop-blur-md text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">{previewPhoto.eventTitle}</div>
              {filteredPhotos.length > 1 && (
                <span className="text-xs text-gray-400 font-medium">
                  {previewIndex + 1} / {filteredPhotos.length}
                </span>
              )}
            </div>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition duration-150 cursor-pointer"
              onClick={() => setPreviewPhoto(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo Container */}
          <div 
            className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden" 
            onClick={() => setPreviewPhoto(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Previous Button */}
            {previewIndex > 0 && (
              <button
                type="button"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 sm:bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition absolute left-2 sm:left-6 z-20 cursor-pointer shadow-lg border border-white/10"
                onClick={handlePrevPhoto}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Photo Wrapper */}
            <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPhoto.cloudinaryUrl}
                alt={previewPhoto.eventTitle}
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Next Button */}
            {previewIndex < filteredPhotos.length - 1 && (
              <button
                type="button"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 sm:bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition absolute right-2 sm:right-6 z-20 cursor-pointer shadow-lg border border-white/10"
                onClick={handleNextPhoto}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Footer / Control Bar */}
          <div className="p-5 border-t border-white/10 bg-black/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1 text-left">
              <h4 className="text-sm font-bold text-white">{previewPhoto.eventTitle}</h4>
              <p className="text-xs text-gray-400 font-light">Purchased: {formatDate(previewPhoto.purchasedAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyPhotosPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 min-h-screen pb-24 bg-white dark:bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-600 dark:text-neutral-400 text-sm">Loading your gallery...</p>
      </div>
    }>
      <MyPhotos />
    </Suspense>
  );
}
