'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { Receipt, DollarSign, Download, Eye, X, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderPhoto {
  _id: string;
  thumbnailUrl: string;
  watermarkedUrl: string;
}

interface PurchaseEntry {
  _id: string;
  orderNumber: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  eventId?: {
    _id: string;
    title: string;
    slug: string;
  };
  totalAmount: number;
  paidAt: string;
  photos: OrderPhoto[];
  photoCount: number;
}

interface DownloadEntry {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  photoId?: {
    _id: string;
    thumbnailUrl: string;
    watermarkedUrl: string;
  };
  eventId?: {
    _id: string;
    title: string;
    slug: string;
  };
  ipAddress: string;
  details: string;
  downloadedAt: string;
}

export default function TransactionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'downloads'>('purchases');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesHasMore, setPurchasesHasMore] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<PurchaseEntry | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const canManagePayouts = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.managePayouts;

  async function fetchTransactions(nextPage = 1) {
    try {
      if (nextPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const res = await fetch(`/api/admin/transactions?page=${nextPage}&limit=50`);
      const data = await res.json();
      if (res.ok) {
        const nextPurchases = data.purchases || [];
        if (nextPage === 1) {
          setPurchases(nextPurchases);
        } else {
          setPurchases((prev) => [...prev, ...nextPurchases]);
        }
        if (nextPage === 1) {
          setDownloads(data.downloads || []);
        }
        setPurchasesPage(nextPage);
        setPurchasesHasMore(!!data.pagination?.hasMore);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'unauthenticated') {
        router.push('/login/admin');
        return;
      }

      if (status === 'authenticated' && !canManagePayouts) {
        router.push('/dashboard');
        return;
      }

      if (canManagePayouts) {
        fetchTransactions(1);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [status, canManagePayouts, router]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openOrderPreview = (purchase: PurchaseEntry) => {
    if (purchase.photos.length === 0) return;
    setPreviewOrder(purchase);
    setPreviewIndex(0);
  };

  const closeOrderPreview = () => {
    setPreviewOrder(null);
    setPreviewIndex(0);
  };

  const goToPrev = () => {
    if (!previewOrder) return;
    setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewOrder.photos.length - 1));
  };

  const goToNext = () => {
    if (!previewOrder) return;
    setPreviewIndex((prev) => (prev < previewOrder.photos.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation for order preview modal
  useEffect(() => {
    if (!previewOrder) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        closeOrderPreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewOrder]);

  // Touch/swipe navigation for order preview modal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const handleSwipe = () => {
    if (!previewOrder) return;
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - go to next
        goToNext();
      } else {
        // Swipe right - go to previous
        goToPrev();
      }
    }
  };

  // Hide header when preview is active
  useEffect(() => {
    if (previewOrder || previewPhotoUrl) {
      document.body.classList.add('preview-modal-open');
    } else {
      document.body.classList.remove('preview-modal-open');
    }
    return () => {
      document.body.classList.remove('preview-modal-open');
    };
  }, [previewOrder, previewPhotoUrl]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <PageHeaderSkeleton />
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <TableSkeleton rows={8} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-50 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary-500" /> Transaksi Foto
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            View photo purchases, event logs, and download records with image previews
          </p>
        </div>
        <button
          onClick={() => fetchTransactions(1)}
          className="btn btn-secondary btn-sm rounded-lg text-xs"
        >
          Refresh Data
        </button>
      </div>

      {/* Sub-tabs switchers */}
      <div className="flex border-b border-neutral-900 gap-6">
        <button
          onClick={() => setActiveSubTab('purchases')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeSubTab === 'purchases' ? 'text-primary-500' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pembelian Foto ({purchases.length})
          </span>
          {activeSubTab === 'purchases' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('downloads')}
          className={`pb-3 font-semibold text-sm transition relative ${
            activeSubTab === 'downloads' ? 'text-primary-500' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Foto ({downloads.length})
          </span>
          {activeSubTab === 'downloads' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
        {activeSubTab === 'purchases' ? (
          purchases.length > 0 ? (
            <>
              <div className="overflow-x-auto border border-neutral-900 rounded-xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                      <th className="px-6 py-4">Preview</th>
                      <th className="px-6 py-4">Order Number</th>
                      <th className="px-6 py-4">Account</th>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {purchases.map((purchase) => (
                      <tr key={purchase._id} className="hover:bg-neutral-900/10 text-neutral-300">
                        <td className="px-6 py-4">
                          {purchase.photos.length > 0 ? (
                            <div
                              className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 group cursor-pointer"
                              onClick={() => openOrderPreview(purchase)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={purchase.photos[0].thumbnailUrl || purchase.photos[0].watermarkedUrl}
                                alt="Photo Thumbnail"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                              {purchase.photoCount > 1 && (
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/10">
                                  +{purchase.photoCount - 1}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-neutral-950 flex items-center justify-center border border-neutral-900">
                              <ImageIcon className="w-5 h-5 text-neutral-600" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-neutral-100">
                          {purchase.orderNumber}
                        </td>
                        <td className="px-6 py-4">
                          {purchase.userId ? (
                            <>
                              <div className="font-semibold text-neutral-50">{purchase.userId.name}</div>
                              <div className="text-xs text-neutral-500">{purchase.userId.email}</div>
                            </>
                          ) : (
                            <span className="text-neutral-500 text-xs italic">Unknown User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {purchase.eventId ? (
                            <>
                              <div className="font-medium text-neutral-200">{purchase.eventId.title}</div>
                              <div className="text-xs text-neutral-500 font-mono">/{purchase.eventId.slug}</div>
                            </>
                          ) : (
                            <span className="text-neutral-500 text-xs">Unknown Event</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-500 font-display">
                          {formatPrice(purchase.totalAmount)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                          {formatDate(purchase.paidAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {purchasesHasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchTransactions(purchasesPage + 1)}
                    disabled={isLoadingMore}
                    className="btn btn-secondary btn-sm rounded-lg text-xs"
                  >
                    {isLoadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-neutral-500 text-sm">No photo purchase transactions completed yet.</div>
          )
        ) : (
          downloads.length > 0 ? (
            <div className="overflow-x-auto border border-neutral-900 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                    <th className="px-6 py-4">Preview</th>
                    <th className="px-6 py-4">Downloaded By</th>
                    <th className="px-6 py-4">Event Source</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Public IP</th>
                    <th className="px-6 py-4">Downloaded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {downloads.map((dl) => (
                    <tr key={dl._id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="px-6 py-4">
                        {dl.photoId ? (
                          <div
                            className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 relative group cursor-pointer"
                            onClick={() => setPreviewPhotoUrl(dl.photoId?.watermarkedUrl || dl.photoId?.thumbnailUrl || null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={dl.photoId.thumbnailUrl || dl.photoId.watermarkedUrl}
                              alt="Photo Thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-neutral-950 flex items-center justify-center border border-neutral-900">
                            <ImageIcon className="w-5 h-5 text-neutral-600" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {dl.userId ? (
                          <>
                            <div className="font-semibold text-neutral-50">{dl.userId.name}</div>
                            <div className="text-xs text-neutral-500">{dl.userId.email}</div>
                          </>
                        ) : (
                          <span className="text-neutral-500 text-xs italic">Anonymous / System</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {dl.eventId ? (
                          <>
                            <div className="font-medium text-neutral-200">{dl.eventId.title}</div>
                            <div className="text-xs text-neutral-500 font-mono">/{dl.eventId.slug}</div>
                          </>
                        ) : (
                          <span className="text-neutral-500 text-xs">Unknown Event</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-neutral-300 font-medium">
                        {dl.details}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                        {dl.ipAddress}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                        {formatDate(dl.downloadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-500 text-sm">No photo downloads logged yet.</div>
          )
        )}
      </div>

      {/* Order Photo Slider Modal */}
      {previewOrder && previewOrder.photos.length > 0 && (
        <div className="fixed inset-0 z-150 bg-black/95 flex flex-col overflow-hidden animate-fadeIn" onClick={closeOrderPreview}>
          {/* Header / Top Bar */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/80 backdrop-blur-md text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">Order #{previewOrder.orderNumber}</div>
              {previewOrder.photos.length > 1 && (
                <span className="text-xs text-gray-400 font-medium">
                  {previewIndex + 1} / {previewOrder.photos.length}
                </span>
              )}
            </div>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition duration-150 cursor-pointer"
              onClick={closeOrderPreview}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo Container */}
          <div 
            className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden" 
            onClick={closeOrderPreview}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Previous Button */}
            {previewOrder.photos.length > 1 && (
              <button
                type="button"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 sm:bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition absolute left-2 sm:left-6 z-20 cursor-pointer shadow-lg border border-white/10"
                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Photo Wrapper */}
            <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewOrder.photos[previewIndex].watermarkedUrl || previewOrder.photos[previewIndex].thumbnailUrl}
                alt={`Photo ${previewIndex + 1}`}
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Next Button */}
            {previewOrder.photos.length > 1 && (
              <button
                type="button"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 sm:bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition absolute right-2 sm:right-6 z-20 cursor-pointer shadow-lg border border-white/10"
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Footer / Control Bar */}
          <div className="p-5 border-t border-white/10 bg-black/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1 text-left">
              <h4 className="text-sm font-bold text-white">Order #{previewOrder.orderNumber}</h4>
              <p className="text-xs text-gray-400 font-light">
                {previewOrder.eventId?.title || 'Unknown Event'} • {formatPrice(previewOrder.totalAmount)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Single Photo Preview Modal (for downloads) */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-150 bg-black/95 flex flex-col overflow-hidden animate-fadeIn" onClick={() => setPreviewPhotoUrl(null)}>
          {/* Header / Top Bar */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/80 backdrop-blur-md text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium">Download Preview</div>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition duration-150 cursor-pointer"
              onClick={() => setPreviewPhotoUrl(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo Container */}
          <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden" onClick={() => setPreviewPhotoUrl(null)}>
            {/* Photo Wrapper */}
            <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPhotoUrl}
                alt="Photo Preview"
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>
          </div>

          {/* Footer / Control Bar */}
          <div className="p-5 border-t border-white/10 bg-black/80 backdrop-blur-md text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1 text-left">
              <h4 className="text-sm font-bold text-white">Photo Preview</h4>
              <p className="text-xs text-gray-400 font-light">Downloaded photo preview</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
