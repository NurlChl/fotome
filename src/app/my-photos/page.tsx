'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Camera, Download, Loader2, CheckCircle2 } from 'lucide-react';

interface PurchasedPhoto {
  _id: string;
  thumbnailUrl: string;
  watermarkedUrl: string;
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

function MyPhotos() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';

  const [photos, setPhotos] = useState<PurchasedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
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
      const res = await fetch(`/api/photos/${photoId}/download`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate download URL');
      }

      // Try fetching as blob to force browser save dialog
      try {
        const imageRes = await fetch(data.downloadUrl);
        if (!imageRes.ok) throw new Error('Fetch failed');
        const blob = await imageRes.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `FotoMe-${orderNumber}-${photoId.substring(18)}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (blobError) {
        console.warn('CORS blocked direct blob download, opening in new tab instead:', blobError);
        // Fallback: open in new tab
        window.open(data.downloadUrl, '_blank');
      }
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="pt-28 min-h-screen pb-24 bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-400 text-sm">Loading your photos...</p>
      </div>
    );
  }

  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-7xl">
        {showSuccess && (
          <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 p-5 rounded-2xl mb-10 flex items-start gap-4 shadow-lg shadow-emerald-500/5">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-emerald-50 mb-1">Payment Successful!</h3>
              <p className="text-sm font-light">Your photos have been added to your gallery. You can now download the high-resolution files without watermarks.</p>
            </div>
          </div>
        )}

        <div className="relative border-b border-neutral-900 py-16 mb-12 overflow-hidden -mt-28 pt-36">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-50 mb-4">My Gallery</h1>
            <p className="text-neutral-400 text-sm sm:text-base font-light">
              You have purchased {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {photos.map((photo) => (
              <div key={photo._id} className="group bg-neutral-900/30 border border-neutral-900 rounded-2xl overflow-hidden hover:border-neutral-800 transition duration-300 flex flex-col">
                <div className="relative w-full aspect-video overflow-hidden bg-neutral-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl} alt={photo.eventTitle} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5 flex flex-col grow">
                  <div className="text-lg font-bold text-neutral-50 mb-3 line-clamp-1">{photo.eventTitle}</div>
                  <div className="flex flex-col gap-1 mb-6 text-xs text-neutral-400 font-light">
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
          <div className="flex flex-col items-center justify-center py-24 text-center border border-neutral-900 border-dashed rounded-3xl bg-neutral-900/10">
            <div className="mb-4 p-4 rounded-full bg-neutral-900/50 border border-neutral-800 inline-flex text-neutral-500">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-neutral-50 mb-2">No photos found</h2>
            <p className="text-xs text-neutral-500 font-light mb-6 max-w-sm mx-auto">
              You haven&apos;t purchased any photos yet. Visit events to search for your photos!
            </p>
            <Link href="/events" className="btn btn-primary rounded-xl px-6 py-2">
              Browse Events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyPhotosPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 min-h-screen pb-24 bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-neutral-400 text-sm">Loading your gallery...</p>
      </div>
    }>
      <MyPhotos />
    </Suspense>
  );
}
