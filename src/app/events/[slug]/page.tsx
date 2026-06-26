'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { getFaceDescriptor } from '@/lib/faceDetector';
import {
  MapPin,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Tag,
  Camera,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Lock,
  Download,
  QrCode,
  Landmark,
  X,
  Search,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface PhotographerData {
  _id?: string;
  id?: string;
  name: string;
  avatar?: string;
  photographerProfile?: { bio?: string };
}

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
  photographerId?: string | PhotographerData;
}

interface PhotoData {
  _id: string;
  watermarkedUrl: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  faceCount?: number;
  createdAt?: string;
  cloudinaryPublicId?: string;
  eventId?: string;
  hasFaces?: boolean;
}

interface VoucherData {
  _id: string;
  name: string;
  description?: string;
  usageLimitPerUser?: number;
  allowedUserIds?: string[];
  minPhotos: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

interface PhotoResult {
  _id: string;
  photoId?: string;
  score: number;
  photo: PhotoData;
}

type SearchState = 'idle' | 'capturing' | 'processing' | 'searching' | 'results' | 'error';

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const slug = params.slug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSelfiePrompt, setShowSelfiePrompt] = useState(false);
  const [profile, setProfile] = useState<{ faceDescriptor?: number[]; [key: string]: unknown } | null>(null);

  const [threshold, setThreshold] = useState(0.58);
  const [lastDescriptor, setLastDescriptor] = useState<number[] | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoResult | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [isSavingFaceID, setIsSavingFaceID] = useState(false);
  const [saveFaceSuccess, setSaveFaceSuccess] = useState(false);

  const [manuallyApprovedPhotos, setManuallyApprovedPhotos] = useState<Set<string>>(new Set());
  const [claimedPhotos, setClaimedPhotos] = useState<Set<string>>(new Set());
  const [savedPhotos, setSavedPhotos] = useState<Set<string>>(new Set());
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isVerifyingClaim, setIsVerifyingClaim] = useState(false);
  const [claimChecked, setClaimChecked] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [modalSearchState, setModalSearchState] = useState<'idle' | 'capturing' | 'processing' | 'success' | 'error'>('idle');
  const [modalSelfieDescriptor, setModalSelfieDescriptor] = useState<number[] | null>(null);
  const [isOverridingClaim, setIsOverridingClaim] = useState(false);
  const [isFlaggingPhoto, setIsFlaggingPhoto] = useState(false);
  const [flagConfirmPhotoId, setFlagConfirmPhotoId] = useState<string | null>(null);
  const [flagSuccessMessage, setFlagSuccessMessage] = useState<string | null>(null);
  const [flagErrorMessage, setFlagErrorMessage] = useState<string | null>(null);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'search' | 'all'>('search');
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);
  const [allPhotosLoading, setAllPhotosLoading] = useState(false);
  const [allPhotosPage, setAllPhotosPage] = useState(1);
  const [allPhotosHasMore, setAllPhotosHasMore] = useState(false);
  const [searchSortBy, setSearchSortBy] = useState<'match' | 'newest' | 'oldest'>('match');
  const [allPhotosSortBy, setAllPhotosSortBy] = useState<'newest' | 'oldest'>('newest');
  const [allPhotosFilter, setAllPhotosFilter] = useState<'all' | 'saved'>('all');
  
  // Store full photo objects for claimed/saved photos (for filter display)
  const [claimedPhotoObjects, setClaimedPhotoObjects] = useState<PhotoData[]>([]);
  const [savedPhotoObjects, setSavedPhotoObjects] = useState<PhotoData[]>([]);

  // Track photos that are already purchased or in a pending order
  const [purchasedPhotos, setPurchasedPhotos] = useState<Set<string>>(new Set());
  const [pendingPhotos, setPendingPhotos] = useState<Set<string>>(new Set());

  const [errorPopupMessage, setErrorPopupMessage] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);

  // Calculate discount
  const discountAmount = useMemo(() => {
    if (!event || !selectedVoucher || selectedPhotos.size === 0) return 0;
    const numPhotos = selectedPhotos.size;
    if (numPhotos < selectedVoucher.minPhotos) return 0;
    const totalPrice = event.pricePerPhoto * numPhotos;
    if (selectedVoucher.discountType === 'percentage') {
      return Math.max(0, Math.round(totalPrice * (selectedVoucher.discountValue / 100)));
    } else {
      return Math.max(0, Math.min(selectedVoucher.discountValue, totalPrice));
    }
  }, [event, selectedVoucher, selectedPhotos]);

  const isUsingProfileFaceID = !!(
    profile?.faceDescriptor &&
    lastDescriptor &&
    profile.faceDescriptor.length === lastDescriptor.length &&
    profile.faceDescriptor.every((val, index) => val === lastDescriptor[index])
  );

  // Search faces via API (defined early to prevent before-declaration issues)
  const searchFaces = useCallback(async (descriptor: number[], currentThreshold = threshold) => {
    if (!event) return;
    setSearchState('searching');

    try {
      const res = await fetch('/api/face-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptor,
          eventId: event._id,
          threshold: currentThreshold,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);
        setSearchState('results');
      } else {
        throw new Error(data.error || 'Pencarian gagal');
      }
    } catch (error) {
      console.error('Search error:', error);
      setErrorMessage('Pencarian foto gagal. Silakan coba beberapa saat lagi.');
      setSearchState('error');
    }
  }, [event, threshold]);

  const saveNewFaceID = async () => {
    if (!lastDescriptor) return;
    setIsSavingFaceID(true);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: lastDescriptor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, faceDescriptor: lastDescriptor } : { faceDescriptor: lastDescriptor });
        setSaveFaceSuccess(true);
        setTimeout(() => setSaveFaceSuccess(false), 4000);
      } else {
        throw new Error(data.error || 'Gagal menyimpan Face ID');
      }
    } catch (error) {
      console.error('Error saving Face ID:', error);
      setErrorPopupMessage('Gagal memperbarui Face ID. Silakan coba lagi.');
    } finally {
      setIsSavingFaceID(false);
    }
  };

  const getAccuracyLabel = (acc: number) => {
    if (acc <= 35) return 'Longgar (Banyak Foto)';
    if (acc <= 50) return 'Standar (Rekomendasi)';
    if (acc <= 65) return 'Ketat (Akurat)';
    return 'Sangat Ketat (Sangat Akurat)';
  };

  const handleAccuracyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const accuracyPercent = parseInt(e.target.value, 10);
    const newThreshold = parseFloat((0.65 - ((accuracyPercent - 30) / 40) * 0.12).toFixed(3));
    setThreshold(newThreshold);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(async () => {
      if (lastDescriptor) {
        await searchFaces(lastDescriptor, newThreshold);
      }
    }, 450);
  };

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      fetch('/api/users/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setProfile(data.user);
        })
        .catch((err) => console.error('Error loading biometrics profile:', err))
        .finally(() => {
          setTimeout(() => setProfileLoaded(true), 0);
        });
    } else {
      setTimeout(() => setProfileLoaded(true), 0);
    }
  }, [status]);

  // Combined auto-search & selfie prompt coordination
  useEffect(() => {
    if (event && profileLoaded && !hasAutoSearched) {
      if (profile?.faceDescriptor && profile.faceDescriptor.length === 128) {
        // User has a registered Face ID. Skip popup and search immediately!
        setTimeout(() => {
          setHasAutoSearched(true);
          setShowSelfiePrompt(false);
          setLastDescriptor(profile.faceDescriptor || null);
          searchFaces(profile.faceDescriptor || [], threshold);
        }, 0);
      } else {
        // Guest or logged-in user without Face ID. Show confirmation modal.
        setTimeout(() => {
          setHasAutoSearched(true);
          setShowSelfiePrompt(true);
        }, 0);
      }
    }
  }, [event, profile, profileLoaded, hasAutoSearched, threshold, searchFaces]);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'qris' | 'va'>('qris');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Fetch event data and vouchers
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch event
        const eventRes = await fetch(`/api/events/${slug}`);
        const eventData = await eventRes.json();
        if (eventRes.ok) {
          setEvent(eventData.event);
        }

        // Fetch vouchers
        const vouchersRes = await fetch(`/api/events/${slug}/vouchers`);
        const vouchersData = await vouchersRes.json();
        if (vouchersRes.ok) {
          setVouchers(vouchersData.vouchers || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  // Fetch claimed photos for logged-in users
  useEffect(() => {
    async function fetchClaimedPhotos() {
      if (!session?.user || !event?._id) return;
      
      try {
        const res = await fetch(`/api/photos/claimed?eventId=${event._id}`);
        if (res.ok) {
          const data = await res.json();
          
          // Extract photoIds for Set
          const photoIds = new Set<string>(
            data.claimedPhotos
              .map((cp: any) => {
                const id = cp.photoId?._id || cp.photoId;
                return typeof id === 'string' ? id : id?.toString();
              })
              .filter((id: string | undefined): id is string => !!id)
          );
          setClaimedPhotos(photoIds);
          
          // Store full photo objects for filter display
          const photoObjects = data.claimedPhotos
            .map((cp: any) => cp.photoId)
            .filter((p: any) => p && p._id) as PhotoData[];
          setClaimedPhotoObjects(photoObjects);
          
          console.log(`Loaded ${photoIds.size} claimed photos for this event`);
        }
      } catch (error) {
        console.error('Error fetching claimed photos:', error);
      }
    }
    fetchClaimedPhotos();
  }, [session, event]);

  // Fetch saved photos for logged-in users
  useEffect(() => {
    async function fetchSavedPhotos() {
      if (!session?.user || !event?._id) return;
      
      try {
        const res = await fetch(`/api/photos/saved?eventId=${event._id}`);
        if (res.ok) {
          const data = await res.json();
          
          // Extract photoIds for Set (excluding claimed photos to avoid double counting)
          const photoIds = new Set<string>(
            data.savedPhotos
              .filter((sp: any) => sp.type === 'saved') // Only pure saved photos (not claimed)
              .map((sp: any) => {
                const id = sp.photoId?._id || sp.photoId;
                return typeof id === 'string' ? id : id?.toString();
              })
              .filter((id: string | undefined): id is string => !!id)
          );
          setSavedPhotos(photoIds);
          
          // Store full photo objects for filter display (only pure saved, not claimed)
          const photoObjects = data.savedPhotos
            .filter((sp: any) => sp.type === 'saved')
            .map((sp: any) => sp.photoId)
            .filter((p: any) => p && p._id) as PhotoData[];
          setSavedPhotoObjects(photoObjects);
          
          console.log(`Loaded ${photoIds.size} saved photos for this event`);
        }
      } catch (error) {
        console.error('Error fetching saved photos:', error);
      }
    }
    fetchSavedPhotos();
  }, [session, event]);

  // Fetch purchase status for logged-in users
  useEffect(() => {
    async function fetchPurchaseStatus() {
      if (!session?.user || !event?._id) return;

      try {
        const res = await fetch(`/api/events/${slug}/purchase-status`);
        if (res.ok) {
          const data = await res.json();
          setPurchasedPhotos(new Set(data.purchased || []));
          setPendingPhotos(new Set(data.pending || []));
          console.log(`Loaded purchase status: ${data.purchased?.length || 0} purchased, ${data.pending?.length || 0} pending`);
        }
      } catch (error) {
        console.error('Error fetching purchase status:', error);
      }
    }
    fetchPurchaseStatus();
  }, [session, event, slug]);

  // Cleanup camera and timeout on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (modalStreamRef.current) {
        modalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      setSearchState('capturing');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      setErrorMessage('Tidak dapat mengakses kamera. Silakan berikan izin kamera atau unggah foto selfie Anda.');
      setSearchState('error');
    }
  };

  // Capture selfie from camera
  const captureSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    await processImage(canvas);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      await processImage(canvas);
    };
    img.src = URL.createObjectURL(file);
  };

  // Process image to extract face descriptor
  const processImage = async (canvas: HTMLCanvasElement) => {
    setSearchState('processing');

    try {
      const descriptor = await getFaceDescriptor(canvas);
      if (!descriptor) {
        throw new Error('No face detected');
      }
      setLastDescriptor(descriptor);
      await searchFaces(descriptor, threshold);
    } catch (error) {
      console.error('Face processing error:', error);
      setErrorMessage('Wajah tidak terdeteksi. Silakan coba lagi dengan foto yang lebih jelas.');
      setSearchState('error');
    }
  };





  const isPhotoMatchingFace = useCallback((photoId: string) => {
    const photographerIdStr = event?.photographerId && (
      typeof event.photographerId === 'string' 
        ? event.photographerId 
        : (event.photographerId as PhotographerData)._id?.toString() || (event.photographerId as PhotographerData).id?.toString()
    );
    const isPhotographerOwner = session?.user?.id && photographerIdStr && session.user.id === photographerIdStr;
    const isBypassUser = session?.user?.role === 'admin' || session?.user?.role === 'superadmin' || !!isPhotographerOwner;
    if (isBypassUser) return true;
    // Check if photo is claimed, in search results, or manually approved
    return claimedPhotos.has(photoId) || results.some(r => r.photo._id === photoId) || manuallyApprovedPhotos.has(photoId);
  }, [results, session, event, manuallyApprovedPhotos, claimedPhotos]);

  const checkFaceMatch = useCallback((photoId: string): boolean => {
    const photographerIdStr = event?.photographerId && (
      typeof event.photographerId === 'string' 
        ? event.photographerId 
        : (event.photographerId as PhotographerData)._id?.toString() || (event.photographerId as PhotographerData).id?.toString()
    );
    const isPhotographerOwner = session?.user?.id && photographerIdStr && session.user.id === photographerIdStr;
    const isBypassUser = session?.user?.role === 'admin' || session?.user?.role === 'superadmin' || !!isPhotographerOwner;
    if (isBypassUser) return true;

    if (!lastDescriptor) {
      setErrorPopupMessage("Silakan lakukan pemindaian wajah (selfie) terlebih dahulu di tab 'Cari Foto Saya (AI)' untuk memverifikasi kepemilikan foto sebelum memilih atau mengunduhnya.");
      return false;
    }

    if (!isPhotoMatchingFace(photoId)) {
      setErrorPopupMessage("Verifikasi wajah gagal: Wajah Anda tidak terdeteksi di foto ini.\n\n💡 Tip: Jika ini memang foto Anda, klik foto untuk membuka preview, lalu klik tombol 'Klaim Foto Saya' untuk verifikasi ulang dengan selfie.");
      return false;
    }

    return true;
  }, [lastDescriptor, isPhotoMatchingFace, session, event]);

  const handleConfirmClaimVerification = async (descriptor: number[]) => {
    if (!event || !previewPhoto) return;
    setIsVerifyingClaim(true);
    setClaimError(null);
    setClaimSuccess(null);

    try {
      const res = await fetch('/api/face-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptor,
          eventId: event._id,
          threshold: 0.60, // 30% minimum accuracy (stricter than AI search)
          skipHardNegatives: true, // Skip hard negative filtering for manual claim verification
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses verifikasi biometrik.');
      }

      const photoIdToMatch = previewPhoto.photo._id;
      const isMatched = data.results && data.results.some((r: PhotoResult) => r.photo._id === photoIdToMatch);

      if (isMatched) {
        // AI successfully verified the face match!
        // Call backend to save with isMatched: true
        await handleAIVerifiedClaim(descriptor);
        
        // Find the matched photo from search results
        const matchedPhotoResult = data.results.find((r: PhotoResult) => r.photo._id === photoIdToMatch);
        
        // Add to manuallyApprovedPhotos for immediate access
        setManuallyApprovedPhotos((prev) => {
          const next = new Set(prev);
          next.add(photoIdToMatch);
          return next;
        });
        
        // Add to claimedPhotos
        setClaimedPhotos((prev) => {
          const next = new Set(prev);
          next.add(photoIdToMatch);
          return next;
        });
        
        // CRITICAL: Add to search results so photo appears in "Cari Foto Saya (AI)" tab
        if (matchedPhotoResult) {
          setResults((prev) => {
            // Check if already in results to avoid duplicates
            const exists = prev.some(r => r.photo._id === photoIdToMatch);
            if (!exists) {
              return [...prev, matchedPhotoResult];
            }
            return prev;
          });
        }
        
        setClaimSuccess('Verifikasi Berhasil! Wajah Anda terdeteksi dengan kecocokan 30%+ (threshold ketat). Akses unduh dan pembelian foto ini kini telah terbuka. Foto akan muncul di tab "Cari Foto Saya (AI)".');
        setModalSearchState('success');
        
        setTimeout(() => {
          handleCloseLegalModal();
        }, 3000);
      } else {
        throw new Error('Verifikasi gagal: Wajah Anda tidak terdeteksi mirip dengan threshold 30% (Euclidean distance > 0.60). Jika ini memang foto diri Anda, gunakan tombol "Klaim Manual" di bawah.');
      }
    } catch (error) {
      console.error('Claim verification error:', error);
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat melakukan verifikasi biometrik.';
      setClaimError(message);
      setModalSearchState('error');
    } finally {
      setIsVerifyingClaim(false);
    }
  };

  // AI Verified Claim (face match confirmed by AI)
  const handleAIVerifiedClaim = async (selfieDescriptor: number[]) => {
    if (!event || !previewPhoto || !modalCanvasRef.current) return;

    try {
      const selfieDataUrl = modalCanvasRef.current.toDataURL('image/jpeg', 0.85);

      const res = await fetch('/api/photos/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfieDataUrl,
          selfieDescriptor,
          photoId: previewPhoto.photo._id,
          eventId: event._id,
          isAIVerified: true, // Mark as AI-verified (isMatched: true in DB)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan klaim AI-verified.');
      }

      console.log('AI-verified claim saved:', data);
    } catch (error) {
      console.error('AI-verified claim error:', error);
      // Don't throw - let the main flow continue
    }
  };

  const startModalCamera = async () => {
    try {
      setModalSearchState('capturing');
      setClaimError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      modalStreamRef.current = stream;
      if (modalVideoRef.current) {
        modalVideoRef.current.srcObject = stream;
        await modalVideoRef.current.play();
      }
    } catch (error) {
      console.error('Modal camera error:', error);
      setClaimError('Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin akses kamera.');
      setModalSearchState('error');
    }
  };

  const captureModalSelfie = async () => {
    if (!modalVideoRef.current || !modalCanvasRef.current) return;
    setModalSearchState('processing');

    try {
      const canvas = modalCanvasRef.current;
      canvas.width = modalVideoRef.current.videoWidth;
      canvas.height = modalVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(modalVideoRef.current, 0, 0);

      // Stop camera stream
      if (modalStreamRef.current) {
        modalStreamRef.current.getTracks().forEach(track => track.stop());
        modalStreamRef.current = null;
      }

      const descriptor = await getFaceDescriptor(canvas);
      if (!descriptor) {
        throw new Error('Wajah tidak terdeteksi. Posisikan wajah Anda di tengah lingkaran dan pastikan pencahayaan cukup.');
      }

      // Store descriptor for manual claim override
      setModalSelfieDescriptor(descriptor);

      // Perform re-verification request using this fresh descriptor
      await handleConfirmClaimVerification(descriptor);
    } catch (error) {
      console.error('Modal face processing error:', error);
      setClaimError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses wajah.');
      setModalSearchState('error');
    }
  };

  const stopModalCamera = () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach(track => track.stop());
      modalStreamRef.current = null;
    }
    setModalSearchState('idle');
    setClaimError(null);
  };

  const handleCloseLegalModal = () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach(track => track.stop());
      modalStreamRef.current = null;
    }
    setModalSearchState('idle');
    setModalSelfieDescriptor(null); // Clear stored descriptor
    setClaimChecked(false);
    setClaimError(null);
    setClaimSuccess(null);
    setIsLegalModalOpen(false);
  };

  // Manual Claim Override (user insists it's their photo despite no AI match)
  const handleManualClaimOverride = async () => {
    if (!event || !previewPhoto || !modalCanvasRef.current || !modalSelfieDescriptor) {
      setClaimError('Descriptor wajah tidak tersedia. Silakan coba lagi.');
      return;
    }
    
    setIsOverridingClaim(true);
    setClaimError(null);
    setClaimSuccess(null);

    try {
      const selfieDataUrl = modalCanvasRef.current.toDataURL('image/jpeg', 0.85);

      const res = await fetch('/api/photos/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfieDataUrl,
          selfieDescriptor: modalSelfieDescriptor,
          photoId: previewPhoto.photo._id,
          eventId: event._id,
          isAIVerified: false, // Mark as manual claim (isMatched: false in DB)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan klaim manual Anda.');
      }

      // Success! Add this photo to manuallyApprovedPhotos and claimedPhotos so the user can download it instantly!
      setManuallyApprovedPhotos((prev) => {
        const next = new Set(prev);
        next.add(previewPhoto.photo._id);
        return next;
      });
      setClaimedPhotos((prev) => {
        const next = new Set(prev);
        next.add(previewPhoto.photo._id);
        return next;
      });

      setClaimSuccess('Klaim Manual Berhasil Didaftarkan! Foto ini kini dapat diunduh. Log verifikasi telah disimpan untuk audit keamanan. Foto akan muncul di filter "Tersimpan".');
      setModalSearchState('success');
      
      // Re-fetch claimed photos to update state from database
      setTimeout(async () => {
        try {
          const refetchRes = await fetch(`/api/photos/claimed?eventId=${event._id}`);
          if (refetchRes.ok) {
            const refetchData = await refetchRes.json();
            const photoIds = new Set<string>(
              refetchData.claimedPhotos
                .map((cp: any) => {
                  const id = cp.photoId?._id || cp.photoId;
                  return typeof id === 'string' ? id : id?.toString();
                })
                .filter((id: string | undefined): id is string => !!id)
            );
            setClaimedPhotos(photoIds);
            
            // Store full photo objects
            const photoObjects = refetchData.claimedPhotos
              .map((cp: any) => cp.photoId)
              .filter((p: any) => p && p._id) as PhotoData[];
            setClaimedPhotoObjects(photoObjects);
            
            console.log('Claimed photos re-fetched after manual claim:', photoIds.size);
          }
        } catch (refetchErr) {
          console.error('Error re-fetching claimed photos:', refetchErr);
        }
        handleCloseLegalModal();
      }, 2000);
    } catch (error) {
      console.error('Manual claim override error:', error);
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat mendaftarkan klaim manual.';
      setClaimError(message);
      setModalSearchState('error');
    } finally {
      setIsOverridingClaim(false);
    }
  };

  const executeFlagFalsePositive = async (photoId: string) => {
    if (!event) return;
    
    setIsFlaggingPhoto(true);
    setFlagSuccessMessage(null);
    setFlagErrorMessage(null);
    try {
      const res = await fetch('/api/photos/flag-false-positive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          eventId: event._id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menandai foto.');
      }

      setFlagSuccessMessage("Foto berhasil ditandai sebagai bukan foto Anda dan telah disembunyikan dari hasil pencarian.");
    } catch (error) {
      console.error('Error flagging false positive:', error);
      setFlagErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan saat menandai foto.');
    } finally {
      setIsFlaggingPhoto(false);
    }
  };

  const handleCloseFlagModal = () => {
    if (flagSuccessMessage && flagConfirmPhotoId) {
      setResults((prev) => prev.filter((r) => r.photo._id !== flagConfirmPhotoId));
      setPreviewPhoto(null);
    }
    setFlagConfirmPhotoId(null);
    setFlagSuccessMessage(null);
    setFlagErrorMessage(null);
  };

  function openAllPhotosPreview(photo: PhotoData) {
    const matched = results.find(r => r.photo._id === photo._id);
    if (matched) {
      setPreviewPhoto(matched);
    } else {
      setPreviewPhoto({
        _id: photo._id,
        photo: {
          _id: photo._id,
          watermarkedUrl: photo.watermarkedUrl,
          thumbnailUrl: photo.thumbnailUrl,
          cloudinaryPublicId: '',
          eventId: event?._id || '',
          hasFaces: (photo.faceCount ?? 0) > 0,
        },
        score: 0,
      });
    }
  }

  const fetchAllPhotos = async (pageToFetch = 1) => {
    if (!event) return;
    setAllPhotosLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/photos?page=${pageToFetch}&limit=30&sort=${allPhotosSortBy}`);
      const data = await res.json();
      if (res.ok) {
        if (pageToFetch === 1) {
          setAllPhotos(data.photos || []);
        } else {
          setAllPhotos(prev => [...prev, ...(data.photos || [])]);
        }
        setAllPhotosPage(pageToFetch);
        setAllPhotosHasMore(data.pagination?.hasMore || false);
      }
    } catch (err) {
      console.error('Error fetching all event photos:', err);
    } finally {
      setAllPhotosLoading(false);
    }
  };

  // Computed: Get photos to display based on filter
  const getDisplayPhotos = useCallback((): PhotoData[] => {
    if (allPhotosFilter === 'all') {
      return allPhotos;
    } else {
      // Filter "Tersimpan" - combine allPhotos with claimed/saved photo objects
      const displayMap = new Map<string, PhotoData>();
      
      // Add photos from allPhotos that are claimed/saved
      allPhotos.forEach(photo => {
        if (claimedPhotos.has(photo._id) || savedPhotos.has(photo._id)) {
          displayMap.set(photo._id, photo);
        }
      });
      
      // Add claimed photo objects (may not be in allPhotos due to pagination)
      claimedPhotoObjects.forEach(photo => {
        if (!displayMap.has(photo._id)) {
          displayMap.set(photo._id, photo);
        }
      });
      
      // Add saved photo objects (may not be in allPhotos due to pagination)
      savedPhotoObjects.forEach(photo => {
        if (!displayMap.has(photo._id)) {
          displayMap.set(photo._id, photo);
        }
      });
      
      return Array.from(displayMap.values());
    }
  }, [allPhotos, allPhotosFilter, claimedPhotos, savedPhotos, claimedPhotoObjects, savedPhotoObjects]);

  useEffect(() => {
    if (activeTab === 'all') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAllPhotos(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, event, allPhotosSortBy]);

  // Toggle photo selection
  const togglePhotoSelection = (photoId: string) => {
    // If selecting (not deselecting), verify face matches first
    if (!selectedPhotos.has(photoId)) {
      if (!checkFaceMatch(photoId)) return;
      // Prevent selecting photos already purchased or pending payment
      if (purchasedPhotos.has(photoId)) {
        setErrorPopupMessage('Foto ini sudah dibeli. Silakan lihat di My Gallery untuk mengunduh.');
        return;
      }
      if (pendingPhotos.has(photoId)) {
        setErrorPopupMessage('Foto ini sedang dalam proses pembayaran. Silakan selesaikan pembayaran di My Orders.');
        return;
      }
    }
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  // Toggle save photo
  const toggleSavePhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!session?.user || !event) {
      setErrorPopupMessage('Silakan login terlebih dahulu untuk menyimpan foto.');
      return;
    }

    const isSaved = savedPhotos.has(photoId);

    try {
      if (isSaved) {
        // Unsave
        const res = await fetch(`/api/photos/saved?photoId=${photoId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setSavedPhotos((prev) => {
            const next = new Set(prev);
            next.delete(photoId);
            return next;
          });
        }
      } else {
        // Save
        const res = await fetch('/api/photos/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId,
            eventId: event._id,
          }),
        });

        if (res.ok) {
          setSavedPhotos((prev) => {
            const next = new Set(prev);
            next.add(photoId);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Error toggling save photo:', error);
      setErrorPopupMessage('Gagal menyimpan foto. Silakan coba lagi.');
    }
  };
  // Check if voucher is applicable
  const isVoucherApplicable = useCallback((voucher: VoucherData) => {
    if (!event) return false;
    if (selectedPhotos.size < voucher.minPhotos) return false;
    return true;
  }, [event, selectedPhotos]);

  // Reset search
  const resetSearch = useCallback(() => {
    setSearchState('idle');
    setResults([]);
    setSelectedPhotos(new Set());
    setErrorMessage('');
    setLastDescriptor(null);
    setPreviewPhoto(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  // Trigger order checkout
  const handlePurchaseClick = () => {
    if (!session) {
      router.push(`/login?callbackUrl=/events/${slug}`);
      return;
    }
    setCheckoutError('');
    setIsCheckoutOpen(true);
  };

  // Process Payment (Midtrans or Free)
  const handleConfirmPayment = async () => {
    if (!event || selectedPhotos.size === 0) return;
    setIsProcessingPayment(true);
    setCheckoutError('');

    try {
      // 1. Create the order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: Array.from(selectedPhotos),
          eventId: event._id,
          voucherId: selectedVoucher?._id || null,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // 2. If free event, redirect to My Gallery
      if (orderData.order.totalAmount === 0) {
        router.push('/my-photos');
        return;
      }

      // 3. If paid event, open Midtrans Snap
      if (orderData.order.snapToken) {
        // Load Midtrans Snap.js if not already loaded
        if (!(window as any).snap) {
          const script = document.createElement('script');
          script.src = `https://app.${
            process.env.MIDTRANS_IS_PRODUCTION === 'true' ? '' : 'sandbox.'
          }midtrans.com/snap/snap.js`;
          script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Open Midtrans Snap payment modal
        (window as any).snap.pay(orderData.order.snapToken, {
          onSuccess: function (result: any) {
            console.log('Payment success:', result);
            router.push('/orders?success=true');
          },
          onPending: function (result: any) {
            console.log('Payment pending:', result);
            router.push('/orders?pending=true');
          },
          onError: function (result: any) {
            console.log('Payment error:', result);
            setCheckoutError('Pembayaran gagal. Silakan coba lagi.');
            setIsProcessingPayment(false);
          },
          onClose: function () {
            console.log('Payment popup closed');
            setIsProcessingPayment(false);
          },
        });
      } else {
        throw new Error('Payment token not generated');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError(error instanceof Error ? error.message : 'Terjadi kesalahan saat transaksi. Silakan coba lagi.');
      setIsProcessingPayment(false);
    }
  };

  const [isDownloadingFree, setIsDownloadingFree] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  const handleFreeDownload = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/events/${slug}`);
      return;
    }

    setIsDownloadingFree(true);
    const photoIds = Array.from(selectedPhotos);
    setBulkDownloadProgress({ current: 0, total: photoIds.length, status: 'Membuat order...' });

    try {
      // Step 1: Create Order (even for free downloads)
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          eventId: event?._id,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      console.log('Order created:', orderData.order);

      // Step 2: If free (price = 0), auto-complete payment
      if (orderData.order.totalAmount === 0) {
        const payRes = await fetch('/api/orders/mock-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.order.id,
          }),
        });

        const payData = await payRes.json();
        if (!payRes.ok) {
          throw new Error(payData.error || 'Payment processing failed');
        }

        console.log('Payment completed:', payData);
      }

      // Step 3: Redirect to My Gallery for download
      setSelectedPhotos(new Set()); // Reset selection
      setBulkDownloadProgress(null);
      setIsDownloadingFree(false);
      
      // Redirect to My Gallery with success message
      router.push('/my-photos?success=true');
    } catch (error) {
      console.error('Free download error:', error);
      setErrorPopupMessage(error instanceof Error ? error.message : 'Pengunduhan gagal. Silakan coba lagi.');
      setBulkDownloadProgress(null);
    } finally {
      setIsDownloadingFree(false);
    }
  };

  const getPreviewList = useCallback((): PhotoResult[] => {
    if (activeTab === 'all') {
      return allPhotos.map((p) => ({
        _id: p._id,
        score: results.find((r) => r.photo._id === p._id)?.score || 0,
        photo: p,
      }));
    } else {
      return [...results].sort((a, b) => {
        if (searchSortBy === 'newest') {
          return new Date(b.photo.createdAt || 0).getTime() - new Date(a.photo.createdAt || 0).getTime();
        } else if (searchSortBy === 'oldest') {
          return new Date(a.photo.createdAt || 0).getTime() - new Date(b.photo.createdAt || 0).getTime();
        } else {
          return b.score - a.score;
        }
      });
    }
  }, [activeTab, allPhotos, results, searchSortBy]);

  const previewList = getPreviewList();

  const currentIndex = previewPhoto 
    ? previewList.findIndex((item) => item.photo._id === previewPhoto.photo._id)
    : -1;

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setPreviewPhoto(previewList[currentIndex - 1]);
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < previewList.length - 1) {
      setPreviewPhoto(previewList[currentIndex + 1]);
    }
  };

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (!previewPhoto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setPreviewPhoto(previewList[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < previewList.length - 1) {
        setPreviewPhoto(previewList[currentIndex + 1]);
      } else if (e.key === 'Escape') {
        setPreviewPhoto(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPhoto, currentIndex, previewList]);

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
      if (diff > 0 && currentIndex < previewList.length - 1) {
        // Swipe left - go to next
        setPreviewPhoto(previewList[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous
        setPreviewPhoto(previewList[currentIndex - 1]);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long',
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

  if (isLoading) {
    return (
      <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
        {/* Event Header Skeleton */}
        <div className="relative border-b border-neutral-900 pb-8 mb-10 overflow-hidden">
          <div className="container mx-auto px-6 max-w-7xl relative z-10">
            <div className="h-4 bg-neutral-900 rounded w-32 mb-6 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-neutral-900 rounded w-24 animate-pulse" />
              <div className="h-10 bg-neutral-900 rounded w-3/4 animate-pulse" />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 bg-neutral-900 rounded w-32 animate-pulse" />
                ))}
              </div>
              <div className="h-16 bg-neutral-900 rounded w-full max-w-2xl animate-pulse" />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 max-w-7xl">
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-8 max-w-4xl mx-auto shadow-xl">
            {/* Title Skeleton */}
            <div className="text-center max-w-md mx-auto mb-10 space-y-2">
              <div className="h-6 bg-neutral-900 rounded w-48 mx-auto animate-pulse" />
              <div className="h-4 bg-neutral-900 rounded w-full animate-pulse" />
            </div>

            {/* Buttons Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border border-neutral-850 rounded-2xl p-6 bg-neutral-950/20 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 mx-auto mb-3" />
                  <div className="h-5 bg-neutral-800 rounded w-32 mx-auto mb-2" />
                  <div className="h-4 bg-neutral-800 rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-neutral-50">Event Tidak Ditemukan</h2>
        <p className="text-neutral-500 text-sm max-w-xs">Event yang Anda cari mungkin telah dihapus atau tautan tidak valid.</p>
        <button className="btn btn-secondary btn-sm mt-2 rounded-lg" onClick={() => router.push('/events')}>
          Kembali ke Daftar Event
        </button>
      </div>
    );
  }

  return (
    <div className="pt-28 min-h-screen pb-24 bg-neutral-950 text-neutral-100">
      
      {/* Event Header Block */}
      <div className="relative border-b border-neutral-900 pb-8 mb-10 overflow-hidden">
        {/* Glow highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl aspect-video bg-primary-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <Link href="/events" className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-6">
            <ChevronLeft className="w-4 h-4" /> Kembali ke Jelajah Event
          </Link>

          <div className="space-y-4">
            <span className="badge badge-primary">{event.category}</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-50 leading-tight">
              {event.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs sm:text-sm text-neutral-400">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary-400" /> {event.location.name}</span>
              <span className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4 text-primary-400" /> {formatDate(event.eventDate)}</span>
              <span className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-primary-400" /> {event.photoCount} foto</span>
              <span className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-primary-400" /> 
                {event.pricePerPhoto === 0 ? <span className="text-emerald-400 font-semibold uppercase">FREE</span> : `${formatPrice(event.pricePerPhoto)} / foto`}
              </span>
            </div>

            <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl font-light">
              {event.description}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl space-y-8">
        {/* Centered Controls Section (Clean and Minimalist without card) */}
        <div className="w-full relative space-y-6">
          
          {/* Premium Tab Selector */}
          <div className="flex justify-center mb-8 border-b border-neutral-900 pb-px">
            <div className="flex gap-2 bg-neutral-950/60 p-1.5 rounded-2xl border border-neutral-900 max-w-md w-full">
              <button
                type="button"
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'search'
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                }`}
                onClick={() => setActiveTab('search')}
              >
                <Camera className="w-3.5 h-3.5" /> Cari Foto Saya (AI)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'all'
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                }`}
                onClick={() => setActiveTab('all')}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Semua Foto Event ({event.photoCount})
              </button>
            </div>
          </div>

          {activeTab === 'search' ? (
            <>
              <div className="text-center max-w-md mx-auto mb-10 space-y-2">
                <h2 className="text-xl font-bold text-neutral-50 flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5 text-neutral-400" /> Temukan Foto Anda
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed font-light">
                  Unggah selfie Anda untuk mencocokkan wajah Anda secara otomatis dengan database foto event menggunakan kecerdasan AI.
                </p>
              </div>

              <canvas ref={canvasRef} className="hidden" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="face-upload-input"
              />

              {/* IDLE STATE */}
              {searchState === 'idle' && (
                <div className={`grid grid-cols-1 ${profile?.faceDescriptor ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-6 max-w-2xl mx-auto`}>
                  {profile?.faceDescriptor && (
                    <button
                      className="group border border-emerald-950/40 hover:border-emerald-500 hover:bg-neutral-900/30 rounded-2xl p-6 text-center transition duration-300 flex flex-col items-center gap-3 bg-neutral-950/20"
                      onClick={() => {
                        if (profile?.faceDescriptor) {
                          setLastDescriptor(profile.faceDescriptor);
                          searchFaces(profile.faceDescriptor, threshold);
                        }
                      }}
                      id="btn-search-by-faceid"
                    >
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Check className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-sm text-neutral-50 mt-1">Gunakan Face ID</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">Cari menggunakan data wajah Anda yang terdaftar</p>
                    </button>
                  )}

                  <button
                    className="group border border-neutral-850 hover:border-primary-500 hover:bg-neutral-900/30 rounded-2xl p-6 text-center transition duration-300 flex flex-col items-center gap-3 bg-neutral-950/20"
                    onClick={startCamera}
                    id="btn-start-camera"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-neutral-50 mt-1">Gunakan Kamera</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed">Ambil foto selfie instan dari kamera Anda</p>
                  </button>

                  <button
                    className="group border border-neutral-850 hover:border-primary-500 hover:bg-neutral-900/30 rounded-2xl p-6 text-center transition duration-300 flex flex-col items-center gap-3 bg-neutral-950/20"
                    onClick={() => fileInputRef.current?.click()}
                    id="btn-upload-photo"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-neutral-50 mt-1">Unggah Berkas</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed">Gunakan foto selfie yang sudah ada di galeri</p>
                  </button>
                </div>
              )}

              {/* CAPTURING CAMERA STATE */}
              {searchState === 'capturing' && (
                <div className="flex flex-col items-center gap-6 max-w-md mx-auto">
                  <div className="w-full aspect-4/3 rounded-2xl overflow-hidden border border-neutral-880 bg-black relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-56 border-2 border-dashed border-primary-500/40 rounded-full animate-[pulse_2s_infinite]" />
                    </div>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button className="btn btn-secondary flex-1 rounded-xl" onClick={resetSearch}>
                      Batal
                    </button>
                    <button
                      className="btn btn-primary flex-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                      onClick={captureSelfie}
                      id="btn-capture"
                    >
                      <Camera className="w-4 h-4" /> Ambil & Cari
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 text-center flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Data selfie diproses secara lokal di browser Anda untuk perlindungan privasi.
                  </p>
                </div>
              )}

              {/* SCANNING / SEARCHING STATE */}
              {(searchState === 'processing' || searchState === 'searching') && (
                <div className="flex flex-col items-center py-12 gap-4 text-center max-w-xs mx-auto animate-fadeIn">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-primary-500 rounded-full animate-spin" />
                  </div>
                  <h3 className="font-bold text-base text-neutral-50">
                    {searchState === 'processing' ? 'Menganalisis wajah Anda...' : 'Memindai database foto...'}
                  </h3>
                  <p className="text-xs text-neutral-500">Proses pencarian biasanya memakan waktu beberapa detik.</p>
                </div>
              )}

              {/* ERROR STATE */}
              {searchState === 'error' && (
                <div className="flex flex-col items-center py-10 gap-4 text-center max-w-sm mx-auto animate-fadeIn">
                  <AlertCircle className="w-12 h-12 text-rose-500" />
                  <h3 className="font-bold text-base text-neutral-50">Terjadi Kendala</h3>
                  <p className="text-xs text-neutral-400">{errorMessage}</p>
                  <button className="btn btn-primary btn-sm rounded-lg" onClick={resetSearch}>
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* RESULTS STATE CONTROLS */}
              {searchState === 'results' && (
                <div className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-neutral-900/30 animate-fadeIn">
                  {/* Left Section: Slider & Status */}
                  {lastDescriptor && (
                    <div className="flex-1 space-y-4 max-w-2xl">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-neutral-400">Akurasi Pencocokan (Minimum Kemiripan)</span>
                          <span className="font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2.5 py-0.5 rounded-full border border-primary-500/20">
                            {Math.round(30 + ((0.65 - threshold) / 0.12) * 40)}% ({getAccuracyLabel(Math.round(30 + ((0.65 - threshold) / 0.12) * 40))})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="70"
                          step="2"
                          value={Math.round(30 + ((0.65 - threshold) / 0.12) * 40)}
                          onChange={handleAccuracyChange}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary-500 focus:outline-none"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-400 font-light">
                          <span>Longgar (Banyak Foto)</span>
                          <span>Sangat Ketat (Sangat Akurat)</span>
                        </div>
                      </div>

                      {session && (
                        <div className="pt-2 border-t border-neutral-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isUsingProfileFaceID ? 'bg-emerald-500' : 'bg-primary-500'} auto-search-dot`} />
                            <span className="text-neutral-400 font-light">
                              {isUsingProfileFaceID 
                                ? "Menggunakan Face ID terdaftar di profil" 
                                : "Menggunakan pemindaian foto selfie baru"}
                            </span>
                          </div>
                          
                          {saveFaceSuccess ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-fadeIn">
                              <Check className="w-3.5 h-3.5" /> Face ID berhasil diperbarui!
                            </span>
                          ) : !isUsingProfileFaceID ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs rounded-lg px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 hover:bg-neutral-800 transition duration-150"
                              onClick={saveNewFaceID}
                              disabled={isSavingFaceID}
                            >
                              {isSavingFaceID ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" /> Simpan sebagai Face ID Utama
                                </>
                              )}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Right Section: Sort dropdown & Cari Ulang */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 lg:pt-0 border-t border-neutral-900/30 lg:border-t-0 text-xs shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-400 font-medium">Urutkan berdasarkan:</span>
                      <select
                        value={searchSortBy}
                        onChange={(e) => setSearchSortBy(e.target.value as 'match' | 'newest' | 'oldest')}
                        className="bg-neutral-950 border border-neutral-850 text-neutral-200 px-3 py-1.5 rounded-xl outline-none focus:border-primary-500 cursor-pointer font-medium"
                      >
                        <option value="match">Kemiripan Terbaik</option>
                        <option value="newest">Terbaru Diunggah</option>
                        <option value="oldest">Terlama Diunggah</option>
                      </select>
                    </div>

                    <button className="btn btn-secondary btn-sm rounded-xl px-4 py-2 flex items-center gap-1.5 cursor-pointer hover:bg-neutral-800 transition" onClick={resetSearch}>
                      <RefreshCw className="w-3.5 h-3.5" /> Cari Ulang
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ALL PHOTOS TAB CONTROLS */
            <div className="space-y-6 animate-fadeIn">
              {/* Friendly Info Alert */}
              <div className="bg-blue-50 dark:bg-primary-500/10 border border-blue-200 dark:border-primary-500/20 rounded-2xl p-4 flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-primary-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-blue-900 dark:text-primary-100">Perlindungan Privasi Foto</h4>
                  <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed font-light">
                    Anda diperbolehkan melihat galeri event. Namun, demi menjaga keamanan dan privasi, Anda **hanya diizinkan mengunduh atau membeli foto yang berisi wajah Anda sendiri**. Silakan lakukan selfie di tab **Cari Foto Saya (AI)** terlebih dahulu sebelum melakukan transaksi atau pengunduhan.
                  </p>
                </div>
              </div>

              {/* All Photos Settings Options: Sort dropdown */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 font-medium">Urutkan:</span>
                    <select
                      value={allPhotosSortBy}
                      onChange={(e) => setAllPhotosSortBy(e.target.value as 'newest' | 'oldest')}
                      className="bg-neutral-950 border border-neutral-850 text-neutral-200 px-3 py-1.5 rounded-xl outline-none focus:border-primary-500 cursor-pointer font-medium"
                    >
                      <option value="newest">Terbaru Diunggah</option>
                      <option value="oldest">Terlama Diunggah</option>
                    </select>
                  </div>

                  {/* Filter Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 font-medium">Filter:</span>
                    <select
                      value={allPhotosFilter}
                      onChange={(e) => setAllPhotosFilter(e.target.value as 'all' | 'saved')}
                      className="bg-neutral-950 border border-neutral-850 text-neutral-200 px-3 py-1.5 rounded-xl outline-none focus:border-primary-500 cursor-pointer font-medium"
                    >
                      <option value="all">Semua Foto</option>
                      <option value="saved">Tersimpan ({claimedPhotos.size + savedPhotos.size})</option>
                    </select>
                  </div>
                </div>
                
                <h3 className="font-semibold text-neutral-400">
                  {allPhotosFilter === 'saved' 
                    ? `Menampilkan ${claimedPhotos.size + savedPhotos.size} foto tersimpan`
                    : 'Menampilkan semua foto di event ini'}
                </h3>
              </div>
            </div>
          )}
        </div>

        {/* Full-width content grids */}
        {activeTab === 'search' && searchState === 'results' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <h3 className="font-bold text-sm text-neutral-200">
                {previewList.length > 0 
                  ? `Ditemukan ${previewList.length} foto pencocokan wajah!` 
                  : 'Tidak ada foto pencocokan wajah yang ditemukan'}
              </h3>
            </div>

            {previewList.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                  {previewList.map((result) => {
                    const isSelected = selectedPhotos.has(result.photo._id);
                    return (
                      <div
                        key={result._id}
                        className={`group border rounded-2xl overflow-hidden cursor-pointer relative transition-all duration-200 bg-neutral-950/40 hover:scale-[1.02] ${
                          isSelected 
                            ? 'border-primary-500 ring-1 ring-primary-500/50 shadow-lg shadow-primary-500/10' 
                            : 'border-neutral-850 hover:border-neutral-700'
                        }`}
                        onClick={() => setPreviewPhoto(result)}
                      >
                        <div className="aspect-4/3 overflow-hidden bg-neutral-950 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={result.photo.watermarkedUrl || result.photo.thumbnailUrl}
                            alt="Matched photo"
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          
                          {/* Hover overlay indicator */}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-medium px-2.5 py-1 bg-black/65 text-white rounded-full backdrop-blur-sm border border-white/10">
                              Pratinjau Foto
                            </span>
                          </div>

                          {/* Purchased/Pending/Claimed/Saved Badge */}
                          {(purchasedPhotos.has(result.photo._id) || pendingPhotos.has(result.photo._id) || claimedPhotos.has(result.photo._id) || savedPhotos.has(result.photo._id)) && (
                            <div className="absolute top-2.5 left-2.5 z-10">
                              {purchasedPhotos.has(result.photo._id) ? (
                                <div className="bg-emerald-500/90 backdrop-blur-sm border border-emerald-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                                  <Check className="w-3 h-3" />
                                  Dibeli
                                </div>
                              ) : pendingPhotos.has(result.photo._id) ? (
                                <div className="bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                                  <Clock className="w-3 h-3" />
                                  Proses Bayar
                                </div>
                              ) : claimedPhotos.has(result.photo._id) ? (
                                <div className="bg-emerald-500/90 backdrop-blur-sm border border-emerald-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                                  <Check className="w-3 h-3" />
                                  Diklaim
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white shadow-lg">
                                  <BookmarkCheck className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Match score indicator */}
                          {result.score > 0 && (
                            <span className="absolute bottom-2.5 left-2.5 text-[10px] px-2 py-0.5 font-bold rounded-full bg-black/75 text-emerald-400 backdrop-blur-md">
                              {Math.round(result.score * 100)}% match
                            </span>
                          )}

                          {/* Corner selector button */}
                          {purchasedPhotos.has(result.photo._id) || pendingPhotos.has(result.photo._id) ? (
                            <div
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 border border-neutral-850 text-neutral-400 backdrop-blur-sm cursor-not-allowed z-10"
                              title={purchasedPhotos.has(result.photo._id) ? 'Foto ini sudah dibeli' : 'Foto ini sedang dalam proses pembayaran'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setErrorPopupMessage(purchasedPhotos.has(result.photo._id)
                                  ? 'Foto ini sudah dibeli. Silakan lihat di My Gallery untuk mengunduh.'
                                  : 'Foto ini sedang dalam proses pembayaran. Silakan selesaikan pembayaran di My Orders.');
                              }}
                            >
                              {purchasedPhotos.has(result.photo._id) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 z-10 ${
                                isSelected
                                  ? 'bg-primary-500 border-primary-400 text-white shadow shadow-primary-500/20'
                                  : 'bg-black/40 border-white/20 text-white/70 hover:border-white/50 hover:bg-black/60'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhotoSelection(result.photo._id);
                              }}
                            >
                              <Check className={`w-4 h-4 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Download & Checkout Floating Bar */}
                {selectedPhotos.size > 0 && (
                  <div className="fixed bottom-0 left-0 right-0 py-4 px-6 bg-neutral-950/85 backdrop-blur-xl border-t border-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-50 animate-fadeInUp">
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-500">{selectedPhotos.size} foto dipilih</span>
                      <span className="text-xl font-bold font-display text-neutral-50 mt-0.5">
                        {event.pricePerPhoto === 0 
                          ? 'GRATIS' 
                          : formatPrice(selectedPhotos.size * event.pricePerPhoto)}
                      </span>
                    </div>
                    
                    {event.pricePerPhoto === 0 ? (
                      <button 
                        className="btn btn-primary rounded-xl px-8 py-3 shadow-lg shadow-primary-500/20 text-sm font-semibold flex items-center gap-2"
                        onClick={handlePurchaseClick}
                        disabled={isDownloadingFree}
                      >
                        {isDownloadingFree ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Beli Gratis ({selectedPhotos.size} Foto)
                          </>
                        )}
                      </button>
                    ) : (
                      <button 
                        className="btn btn-primary rounded-xl px-8 py-3 shadow-lg shadow-primary-500/20 text-sm font-semibold flex items-center gap-2"
                        onClick={handlePurchaseClick}
                        id="btn-purchase"
                      >
                        <Lock className="w-4 h-4" /> Beli Akses Download ({selectedPhotos.size} Foto)
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-neutral-950/30 border border-neutral-900 rounded-2xl p-10 text-center space-y-4 animate-fadeIn max-w-2xl mx-auto">
                <div className="mx-auto w-16 h-16 bg-neutral-900/60 border border-neutral-850 rounded-2xl flex items-center justify-center">
                  <Search className="w-8 h-8 text-neutral-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-neutral-300">Wajah Tidak Ditemukan</h3>
                  <p className="text-sm text-neutral-400 font-light">Wajah Anda tidak ditemukan di event ini.</p>
                </div>
                <div className="bg-neutral-900/40 border border-neutral-850 rounded-xl p-4 max-w-md mx-auto">
                  <p className="text-xs text-neutral-400 mb-3 font-semibold">Kemungkinan penyebab:</p>
                  <ul className="text-xs text-neutral-500 space-y-2 text-left font-light">
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                      <span>Kamera tidak fokus atau pencahayaan selfie kurang baik</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                      <span>Foto wajah Anda di event ini terhalang objek/orang lain</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                      <span>Silakan coba unggah foto selfie alternatif dengan cahaya yang cukup</span>
                    </li>
                  </ul>
                </div>
                <button 
                  className="btn btn-secondary rounded-xl px-6 py-2 text-sm font-semibold flex items-center gap-2 mx-auto cursor-pointer"
                  onClick={resetSearch}
                >
                  <Upload className="w-4 h-4" /> Coba Foto Lain
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="space-y-6 animate-fadeIn">
            {(() => {
              const displayPhotos = getDisplayPhotos();
              const savedCount = claimedPhotos.size + savedPhotos.size;
              
              if (displayPhotos.length === 0 && allPhotosFilter === 'saved') {
                return (
                  <div className="bg-neutral-950/30 border border-neutral-900 rounded-2xl p-10 text-center space-y-4 animate-fadeIn max-w-2xl mx-auto">
                    <div className="mx-auto w-16 h-16 bg-neutral-900/60 border border-neutral-850 rounded-2xl flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-neutral-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-neutral-300">Belum Ada Foto Tersimpan</h3>
                      <p className="text-sm text-neutral-400 font-light">Anda belum menyimpan atau mengklaim foto apapun di event ini.</p>
                    </div>
                    <div className="bg-neutral-900/40 border border-neutral-850 rounded-xl p-4 max-w-md mx-auto">
                      <p className="text-xs text-neutral-400 mb-3 font-semibold">Cara menyimpan foto:</p>
                      <ul className="text-xs text-neutral-500 space-y-2 text-left font-light">
                        <li className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                          <span>Klik icon bookmark/save di foto yang Anda suka</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                          <span>Atau klaim foto dengan verifikasi wajah</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                          <span>Foto tersimpan akan muncul di filter ini</span>
                        </li>
                      </ul>
                    </div>
                    <button 
                      className="btn btn-secondary rounded-xl px-6 py-2 text-sm font-semibold flex items-center gap-2 mx-auto cursor-pointer"
                      onClick={() => setAllPhotosFilter('all')}
                    >
                      <ImageIcon className="w-4 h-4" /> Tampilkan Semua Foto
                    </button>
                  </div>
                );
              }
              
              if (displayPhotos.length > 0) {
                return (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                      {displayPhotos.map((photo) => {
                    const isSelected = selectedPhotos.has(photo._id);
                    const matchedFace = isPhotoMatchingFace(photo._id);
                    return (
                      <div
                        key={photo._id}
                        className={`group border rounded-2xl overflow-hidden cursor-pointer relative transition-all duration-200 bg-neutral-950/40 hover:scale-[1.02] ${
                          isSelected 
                            ? 'border-primary-500 ring-1 ring-primary-500/50 shadow-lg shadow-primary-500/10' 
                            : 'border-neutral-850 hover:border-neutral-750'
                        }`}
                        onClick={() => openAllPhotosPreview(photo)}
                      >
                        <div className="aspect-4/3 overflow-hidden bg-neutral-950 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.watermarkedUrl || photo.thumbnailUrl}
                            alt="Event photo"
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          
                          {/* Purchased/Pending/Claimed/Saved Badge (priority: purchased > pending > claimed > saved) */}
                          {purchasedPhotos.has(photo._id) && (
                            <div className="absolute top-2.5 left-2.5 bg-emerald-500/90 backdrop-blur-sm border border-emerald-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg z-10">
                              <Check className="w-3 h-3" />
                              Dibeli
                            </div>
                          )}

                          {!purchasedPhotos.has(photo._id) && pendingPhotos.has(photo._id) && (
                            <div className="absolute top-2.5 left-2.5 bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg z-10">
                              <Clock className="w-3 h-3" />
                              Proses Bayar
                            </div>
                          )}

                          {!purchasedPhotos.has(photo._id) && !pendingPhotos.has(photo._id) && claimedPhotos.has(photo._id) && (
                            <div className="absolute top-2.5 left-2.5 bg-emerald-500/90 backdrop-blur-sm border border-emerald-400/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg z-10">
                              <Check className="w-3 h-3" />
                              Diklaim
                            </div>
                          )}

                          {/* Saved Badge (only show if saved AND not claimed/purchased/pending) */}
                          {!purchasedPhotos.has(photo._id) && !pendingPhotos.has(photo._id) && !claimedPhotos.has(photo._id) && savedPhotos.has(photo._id) && (
                            <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white shadow-lg z-10">
                              <BookmarkCheck className="w-3 h-3" />
                            </div>
                          )}

                          {/* Hover overlay indicator */}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-medium px-2.5 py-1 bg-black/65 text-white rounded-full backdrop-blur-sm border border-white/10">
                              Pratinjau Foto
                            </span>
                          </div>

                          {/* Corner selector button / Lock indicator */}
                          {!matchedFace ? (
                            <div 
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 border border-neutral-850 text-neutral-400 backdrop-blur-sm cursor-not-allowed"
                              title="Foto ini tidak memuat wajah Anda (Unduh/beli terkunci)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setErrorPopupMessage(!lastDescriptor 
                                  ? "Silakan lakukan pemindaian wajah (selfie) terlebih dahulu di tab 'Cari Foto Saya (AI)' untuk memverifikasi kepemilikan foto." 
                                  : "Verifikasi wajah gagal: Wajah Anda tidak terdeteksi di foto ini.\n\n💡 Tip: Jika ini memang foto Anda, klik foto untuk membuka preview, lalu klik tombol 'Klaim Foto Saya' untuk verifikasi ulang dengan selfie.");
                              }}
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : purchasedPhotos.has(photo._id) || pendingPhotos.has(photo._id) ? (
                            <div 
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 border border-neutral-850 text-neutral-400 backdrop-blur-sm cursor-not-allowed"
                              title={purchasedPhotos.has(photo._id) ? 'Foto ini sudah dibeli' : 'Foto ini sedang dalam proses pembayaran'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setErrorPopupMessage(purchasedPhotos.has(photo._id)
                                  ? 'Foto ini sudah dibeli. Silakan lihat di My Gallery untuk mengunduh.'
                                  : 'Foto ini sedang dalam proses pembayaran. Silakan selesaikan pembayaran di My Orders.');
                              }}
                            >
                              {purchasedPhotos.has(photo._id) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 z-10 ${
                                isSelected
                                  ? 'bg-primary-500 border-primary-400 text-white shadow shadow-primary-500/20'
                                  : 'bg-black/40 border-white/20 text-white/70 hover:border-white/50 hover:bg-black/60'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhotoSelection(photo._id);
                              }}
                            >
                              <Check className={`w-4 h-4 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button - Only show when filter is "all" */}
                {allPhotosFilter === 'all' && allPhotosHasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      className="btn btn-secondary rounded-xl px-8 py-2.5 text-xs font-semibold flex items-center gap-2 cursor-pointer border border-neutral-850 hover:bg-neutral-800 transition"
                      onClick={() => fetchAllPhotos(allPhotosPage + 1)}
                      disabled={allPhotosLoading}
                    >
                      {allPhotosLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
                        </>
                      ) : (
                        'Muat Lebih Banyak Foto'
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          }
          
          // Fallback: loading or empty state
          return (
            <div className="py-12 text-center text-xs text-neutral-500">
              {allPhotosLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span>Memuat foto event...</span>
                </div>
              ) : (
                'Tidak ada foto dalam event ini.'
              )}
            </div>
          );
        })()}

            {/* Dynamic Download & Checkout Floating Bar for All Photos Tab */}
            {selectedPhotos.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 py-4 px-6 bg-neutral-950/85 backdrop-blur-xl border-t border-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-50 animate-fadeInUp">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-500">{selectedPhotos.size} foto dipilih</span>
                  <div className="flex items-baseline gap-2">
                    {selectedVoucher && discountAmount > 0 ? (
                      <>
                        <span className="text-sm text-neutral-500 line-through">
                          {formatPrice(selectedPhotos.size * event.pricePerPhoto)}
                        </span>
                        <span className="text-xl font-bold font-display text-neutral-50">
                          {formatPrice(Math.max(0, selectedPhotos.size * event.pricePerPhoto - discountAmount))}
                        </span>
                      </>
                    ) : (
                      <span className="text-xl font-bold font-display text-neutral-50">
                        {event.pricePerPhoto === 0 
                          ? 'GRATIS' 
                          : formatPrice(selectedPhotos.size * event.pricePerPhoto)}
                      </span>
                    )}
                  </div>
                </div>
                
                {event.pricePerPhoto === 0 ? (
                  <button 
                    className="btn btn-primary rounded-xl px-8 py-3 shadow-lg shadow-primary-500/20 text-sm font-semibold flex items-center gap-2"
                    onClick={handlePurchaseClick}
                    disabled={isDownloadingFree}
                  >
                    {isDownloadingFree ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Beli Gratis ({selectedPhotos.size} Foto)
                      </>
                    )}
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary rounded-xl px-8 py-3 shadow-lg shadow-primary-500/20 text-sm font-semibold flex items-center gap-2"
                    onClick={handlePurchaseClick}
                    id="btn-purchase-all"
                  >
                    <Lock className="w-4 h-4" /> Beli Akses Download ({selectedPhotos.size} Foto)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selfie Search Confirmation Modal */}
      {showSelfiePrompt && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center px-4 z-50 animate-fadeIn">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative">
            <button 
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-50 transition duration-150"
              onClick={() => setShowSelfiePrompt(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center text-primary-400">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-50">Face Recognition Search</h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-light">
                Ingin mencari foto Anda menggunakan selfie?
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed font-light">
                Kami akan memindai foto-foto Anda di event ini menggunakan kecerdasan AI face recognition secara instan.
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold"
                  onClick={() => setShowSelfiePrompt(false)}
                >
                  Lain Kali
                </button>
                <button 
                  className="btn btn-primary flex-1 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20"
                  onClick={() => {
                    setShowSelfiePrompt(false);
                    startCamera();
                  }}
                  id="btn-confirm-selfie-search"
                >
                  Cari Selfie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center px-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3 mb-4">
              <h3 className="font-bold text-neutral-50 text-base">Konfirmasi Transaksi</h3>
              <button 
                className="text-neutral-500 hover:text-neutral-50 transition duration-150"
                onClick={() => setIsCheckoutOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {checkoutError && (
              <div className="bg-error-bg border border-error-border text-error-text text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{checkoutError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs sm:text-sm text-neutral-300 mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-500">Event</span>
                <span className="font-semibold text-neutral-50">{event.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Item</span>
                <span className="font-semibold text-neutral-50">{selectedPhotos.size} foto</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Harga per foto</span>
                <span className="text-neutral-50">{formatPrice(event.pricePerPhoto)}</span>
              </div>

              {/* Voucher Selection */}
              {vouchers.length > 0 && event.pricePerPhoto > 0 && (
                <div className="space-y-2 pt-2 border-t border-neutral-850">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 text-xs font-semibold">Voucher</span>
                  </div>
                  <select
                    value={selectedVoucher ? selectedVoucher._id : ''}
                    onChange={(e) => {
                      const voucherId = e.target.value;
                      if (voucherId) {
                        const voucher = vouchers.find(v => v._id === voucherId);
                        setSelectedVoucher(voucher || null);
                      } else {
                        setSelectedVoucher(null);
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none focus:border-primary-500 cursor-pointer"
                  >
                    <option value="">Tidak menggunakan voucher</option>
                    {vouchers.map((voucher) => (
                      <option key={voucher._id} value={voucher._id}>
                        {voucher.name} - {voucher.discountType === 'percentage' ? `${voucher.discountValue}%` : `${formatPrice(voucher.discountValue)}`}
                      </option>
                    ))}
                  </select>
                  {selectedVoucher && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-500">{selectedVoucher.description}</div>
                      {!isVoucherApplicable(selectedVoucher) && (
                        <div className="text-[10px] text-rose-400">Voucher membutuhkan minimal {selectedVoucher.minPhotos} foto</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Total Calculation */}
              <div className="border-t border-dashed border-neutral-850 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="text-neutral-50">{formatPrice(selectedPhotos.size * event.pricePerPhoto)}</span>
                </div>
                {selectedVoucher && discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">Diskon Voucher</span>
                    <span className="text-emerald-400">- {formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base">
                  <span className="text-neutral-400 text-sm">Total Pembayaran</span>
                  <span className="text-primary-400">
                    {formatPrice(Math.max(0, selectedPhotos.size * event.pricePerPhoto - discountAmount))}
                  </span>
                </div>
              </div>
            </div>

            {Math.max(0, selectedPhotos.size * event.pricePerPhoto - discountAmount) > 0 ? (
              <>
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                  Pilih Metode Pembayaran
                </div>

                <div className="space-y-2 mb-6">
                  <div
                    className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition duration-150 ${
                      selectedPaymentMethod === 'qris'
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('qris')}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedPaymentMethod === 'qris' ? 'border-primary-500' : 'border-neutral-700'
                    }`}>
                      {selectedPaymentMethod === 'qris' && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <QrCode className="w-5 h-5 text-neutral-400" />
                    <div>
                      <div className="font-medium text-neutral-50 text-xs sm:text-sm">QRIS (Scan & Pay)</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Konfirmasi pembayaran otomatis secara instan</div>
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition duration-150 ${
                      selectedPaymentMethod === 'va'
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-neutral-850 hover:border-neutral-750 hover:bg-neutral-900/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('va')}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedPaymentMethod === 'va' ? 'border-primary-500' : 'border-neutral-700'
                    }`}>
                      {selectedPaymentMethod === 'va' && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <Landmark className="w-5 h-5 text-neutral-400" />
                    <div>
                      <div className="font-medium text-neutral-50 text-xs sm:text-sm">Virtual Account Transfer</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Transfer antar rekening bank</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-medium text-emerald-50 text-sm">Gratis</div>
                  <div className="text-[10px] text-emerald-400/70 mt-0.5">Tidak perlu pembayaran</div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
                onClick={() => setIsCheckoutOpen(false)}
                disabled={isProcessingPayment}
              >
                Batal
              </button>
              <button
                className="btn btn-primary flex-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-primary-500/20"
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment}
                id="btn-confirm-payment"
              >
                {isProcessingPayment ? 'Processing...' : (Math.max(0, selectedPhotos.size * event.pricePerPhoto - discountAmount) > 0 ? 'Bayar Sekarang' : 'Bayar Gratis')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-150 bg-black/95 flex flex-col overflow-hidden animate-fadeIn" onClick={() => setPreviewPhoto(null)}>
          {/* Header / Top Bar */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/80 backdrop-blur-md text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {previewPhoto.score > 0 && (
                <>
                  <span className="text-xs text-gray-400 font-medium">Akurasi Kemiripan:</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {Math.round(previewPhoto.score * 100)}% match
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 font-medium">
                {currentIndex + 1} / {previewList.length}
              </span>
              <button 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition duration-150 cursor-pointer"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Photo Container */}
          <div 
            className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden" 
            onClick={() => setPreviewPhoto(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Previous Button */}
            {currentIndex > 0 && (
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
                src={previewPhoto.photo.watermarkedUrl}
                alt="Full preview with watermark"
                className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Next Button */}
            {currentIndex < previewList.length - 1 && (
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
              <h4 className="text-sm font-bold text-white">{event.title}</h4>
              <p className="text-xs text-gray-400 font-light">
                {event.pricePerPhoto === 0 
                  ? 'Foto ini dapat diunduh secara gratis.' 
                  : `Harga foto: ${formatPrice(event.pricePerPhoto)}`}
              </p>
            </div>

            {/* Warning if photo does not match face */}
            {!isPhotoMatchingFace(previewPhoto.photo._id) && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl text-left text-xs max-w-sm sm:max-w-md shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-rose-300 font-medium leading-normal block">
                    {!lastDescriptor 
                      ? "Scan wajah Anda di tab 'Cari Foto Saya (AI)' terlebih dahulu untuk membeli/mengunduh." 
                      : "Wajah Anda tidak terdeteksi di foto ini (Akses unduh/beli terkunci)."}
                  </span>
                  {lastDescriptor && !claimedPhotos.has(previewPhoto.photo._id) && (
                    <span className="text-rose-200/70 text-[10px] font-light leading-relaxed block">
                      💡 Tip: Jika ini memang foto Anda, klik tombol &quot;Klaim Foto Saya&quot; di bawah untuk verifikasi ulang dengan selfie.
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {!isPhotoMatchingFace(previewPhoto.photo._id) && lastDescriptor && !claimedPhotos.has(previewPhoto.photo._id) && (
                <button
                  type="button"
                  className="btn bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-5 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-primary-600/20"
                  onClick={() => {
                    setClaimChecked(false);
                    setClaimError(null);
                    setClaimSuccess(null);
                    setIsLegalModalOpen(true);
                  }}
                >
                  Klaim Foto Saya
                </button>
              )}

              {purchasedPhotos.has(previewPhoto.photo._id) && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-emerald-300">
                  <Check className="w-4 h-4" />
                  Sudah Dibeli - Lihat di My Gallery
                </div>
              )}

              {!purchasedPhotos.has(previewPhoto.photo._id) && pendingPhotos.has(previewPhoto.photo._id) && (
                <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-amber-300">
                  <Clock className="w-4 h-4" />
                  Menunggu Pembayaran - Lihat di My Orders
                </div>
              )}

              {!purchasedPhotos.has(previewPhoto.photo._id) && !pendingPhotos.has(previewPhoto.photo._id) && claimedPhotos.has(previewPhoto.photo._id) && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-emerald-300">
                  <Check className="w-4 h-4" />
                  Sudah Diklaim - Akses Download Terbuka
                </div>
              )}

              {/* "Bukan Foto Saya" button - Only show for matching photos that are NOT claimed/purchased/pending */}
              {isPhotoMatchingFace(previewPhoto.photo._id) && !claimedPhotos.has(previewPhoto.photo._id) && !purchasedPhotos.has(previewPhoto.photo._id) && !pendingPhotos.has(previewPhoto.photo._id) && (
                <button
                  type="button"
                  className="btn bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition duration-150"
                  onClick={() => setFlagConfirmPhotoId(previewPhoto.photo._id)}
                  disabled={isFlaggingPhoto}
                >
                  {isFlaggingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Bukan Foto Saya"
                  )}
                </button>
              )}

              {/* Save/Bookmark Button - Only show for photos that match user's face and are not already purchased/pending */}
              {isPhotoMatchingFace(previewPhoto.photo._id) && !purchasedPhotos.has(previewPhoto.photo._id) && !pendingPhotos.has(previewPhoto.photo._id) && (
                <button
                  type="button"
                  className={`btn rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border transition duration-200 ${
                    savedPhotos.has(previewPhoto.photo._id) || claimedPhotos.has(previewPhoto.photo._id)
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer'
                      : 'bg-white/10 border-white/10 text-white hover:bg-white/20 cursor-pointer'
                  }`}
                  onClick={(e) => toggleSavePhoto(previewPhoto.photo._id, e)}
                  title={savedPhotos.has(previewPhoto.photo._id) || claimedPhotos.has(previewPhoto.photo._id) ? 'Hapus dari tersimpan' : 'Simpan foto ini'}
                >
                  {savedPhotos.has(previewPhoto.photo._id) || claimedPhotos.has(previewPhoto.photo._id) ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Tersimpan</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      <span className="hidden sm:inline">Simpan</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                className={`btn flex-1 sm:flex-initial rounded-xl px-6 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border transition duration-200 ${
                  !isPhotoMatchingFace(previewPhoto.photo._id) || purchasedPhotos.has(previewPhoto.photo._id) || pendingPhotos.has(previewPhoto.photo._id)
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                    : selectedPhotos.has(previewPhoto.photo._id)
                    ? 'bg-primary-500 border-primary-400 text-white hover:bg-primary-600 cursor-pointer'
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/20 cursor-pointer'
                }`}
                onClick={() => {
                  if (isPhotoMatchingFace(previewPhoto.photo._id) && !purchasedPhotos.has(previewPhoto.photo._id) && !pendingPhotos.has(previewPhoto.photo._id)) {
                    togglePhotoSelection(previewPhoto.photo._id);
                  }
                }}
                disabled={!isPhotoMatchingFace(previewPhoto.photo._id) || purchasedPhotos.has(previewPhoto.photo._id) || pendingPhotos.has(previewPhoto.photo._id)}
              >
                <Check className={`w-4 h-4 transition-all duration-200 ${selectedPhotos.has(previewPhoto.photo._id) ? 'scale-100 opacity-100' : 'scale-75 opacity-50'}`} />
                {purchasedPhotos.has(previewPhoto.photo._id)
                  ? 'Dibeli'
                  : pendingPhotos.has(previewPhoto.photo._id)
                  ? 'Proses Bayar'
                  : selectedPhotos.has(previewPhoto.photo._id)
                  ? 'Dipilih'
                  : 'Pilih Foto'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Legal & Face Verification Modal Popup */}
      {isLegalModalOpen && previewPhoto && (
        <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center px-4 z-210 animate-fadeIn" onClick={() => !isVerifyingClaim && handleCloseLegalModal()}>
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-3xl p-6 shadow-2xl relative space-y-5 text-left text-neutral-800 dark:text-neutral-200" onClick={(e) => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition duration-150 cursor-pointer"
              onClick={() => !isVerifyingClaim && handleCloseLegalModal()}
              disabled={isVerifyingClaim}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-850 pb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                <AlertCircle className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 font-display">Verifikasi Kepemilikan Foto</h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-500 font-light">Tanggung Jawab Hukum & Konfirmasi Biometrik</p>
              </div>
            </div>

            {/* Canvas helper hidden for capturing frames */}
            <canvas ref={modalCanvasRef} className="hidden" />

            {modalSearchState === 'idle' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 font-light">
                  <div className="bg-rose-50 dark:bg-warning-bg border border-rose-200 dark:border-warning-border p-3.5 rounded-2xl space-y-2 text-rose-900 dark:text-warning-text">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-rose-800 dark:text-warning-title">
                      <AlertCircle className="w-4 h-4" /> Pernyataan Hukum Penting (UU PDP & UU Hak Cipta):
                    </h4>
                    <p className="text-[10px] leading-relaxed">
                      Mengunduh, membeli, atau mengklaim foto orang lain tanpa izin merupakan pelanggaran serius terhadap privasi dan hak kekayaan intelektual di Indonesia:
                    </p>
                    <ul className="list-disc pl-4 text-[10px] space-y-1">
                      <li>
                        <strong className="font-bold">UU No. 27 Tahun 2022 Pasal 65 & 67 (UU PDP)</strong>: Mengumpulkan/menggunakan data pribadi orang lain secara melawan hukum diancam pidana penjara hingga 5 tahun atau denda maksimal <strong className="font-bold">Rp 5 Miliar</strong>.
                      </li>
                      <li>
                        <strong className="font-bold">UU No. 28 Tahun 2014 Pasal 12 & 115 (UU Hak Cipta)</strong>: Penggunaan potret orang lain tanpa persetujuan tertulis untuk tujuan komersial/publik adalah perbuatan melanggar hukum.
                      </li>
                      <li>
                        <strong className="font-bold">KUHP Pasal 310 & 311</strong>: Penyalahgunaan foto orang lain yang merugikan reputasi orang tersebut dapat dituntut secara pidana.
                      </li>
                    </ul>
                  </div>

                  <p className="text-neutral-600 dark:text-neutral-400 text-[10px]">
                    <strong className="font-bold">Sistem Audit Keamanan:</strong> FotoMe mencatat alamat IP dan akun pengguna ({session?.user?.email || 'Guest'}) secara otomatis. Log ini disimpan sebagai bukti audit hukum yang sah dan siap diserahkan kepada aparat penegak hukum jika terjadi indikasi pelanggaran.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={claimChecked}
                      onChange={(e) => setClaimChecked(e.target.checked)}
                      className="mt-0.5 rounded border-neutral-400 bg-white dark:bg-neutral-900 text-primary-500 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="leading-tight font-medium text-neutral-900 dark:text-neutral-100">
                      Saya menyatakan dengan sadar dan di bawah sumpah bahwa wajah saya terdapat di dalam foto ini, dan saya bertanggung jawab penuh secara hukum atas klaim kepemilikan ini.
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold"
                      onClick={handleCloseLegalModal}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary flex-2 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      onClick={startModalCamera}
                      disabled={!claimChecked}
                    >
                      Mulai Verifikasi Wajah
                    </button>
                  </div>
                </div>
              </div>
            )}

            {modalSearchState === 'capturing' && (
              <div className="space-y-5 animate-fadeIn text-center">
                <p className="text-xs text-neutral-300">
                  Posisikan wajah Anda di dalam lingkaran di bawah untuk verifikasi biometrik langsung.
                </p>
                
                <div className="w-full aspect-4/3 rounded-2xl overflow-hidden border border-neutral-800 bg-black relative max-w-sm mx-auto">
                  <video
                    ref={modalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-40 h-40 border-2 border-dashed border-primary-500/50 rounded-full animate-[pulse_2s_infinite]" />
                  </div>
                </div>

                <div className="flex gap-3 max-w-sm mx-auto">
                  <button
                    type="button"
                    className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold"
                    onClick={stopModalCamera}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-2 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    onClick={captureModalSelfie}
                  >
                    <Camera className="w-4 h-4" /> Ambil & Verifikasi
                  </button>
                </div>
              </div>
            )}

            {modalSearchState === 'processing' && (
              <div className="flex flex-col items-center py-10 gap-4 text-center max-w-xs mx-auto animate-fadeIn">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-primary-500 rounded-full animate-spin" />
                </div>
                <h3 className="font-bold text-sm text-neutral-50">
                  Menganalisis wajah Anda...
                </h3>
                <p className="text-[11px] text-neutral-500">Mencocokkan biometrik Anda dengan foto event...</p>
              </div>
            )}

            {modalSearchState === 'error' && (
              <div className="space-y-5 animate-fadeIn text-center">
                {isOverridingClaim ? (
                  <div className="flex flex-col items-center py-10 gap-4 text-center max-w-xs mx-auto animate-fadeIn">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                    <h3 className="font-bold text-sm text-neutral-50 font-display">
                      Mendaftarkan Klaim Manual...
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-light">Menyimpan log audit keamanan dan membuka foto...</p>
                  </div>
                ) : (
                  <>
                    {claimError && (
                      <div className="bg-rose-50 dark:bg-error-bg border border-rose-300 dark:border-error-border p-3.5 rounded-2xl text-rose-900 dark:text-error-text text-xs flex items-start gap-2 text-left max-w-sm mx-auto">
                        <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                        <span>{claimError}</span>
                      </div>
                    )}
                    
                    {claimError?.includes('Verifikasi gagal') && (
                      <div className="bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-800 p-4 rounded-2xl space-y-3 text-left max-w-sm mx-auto animate-fadeIn">
                        <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed font-light">
                          Meskipun sistem tidak mendeteksi kemiripan biometrik secara otomatis, Anda tetap diperbolehkan mengunduh foto ini dengan mengajukan <strong>Klaim Manual</strong>.
                        </p>
                        <p className="text-[10px] text-neutral-600 dark:text-neutral-400 leading-normal font-light">
                          Foto selfie verifikasi Anda, alamat IP public, dan akun akan direkam secara hukum untuk audit keamanan.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary w-full py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/10 flex items-center justify-center gap-1.5 cursor-pointer bg-primary-700 border-primary-700 hover:bg-primary-800"
                          onClick={handleManualClaimOverride}
                          disabled={isOverridingClaim}
                        >
                          Saya Yakin Ini Saya (Tandai Sebagai Foto Saya)
                        </button>
                      </div>
                    )}
                    
                    <div className="flex gap-3 max-w-sm mx-auto pt-2 border-t border-neutral-200 dark:border-neutral-850/50">
                      <button
                        type="button"
                        className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold"
                        onClick={() => {
                          setModalSearchState('idle');
                          setClaimError(null);
                        }}
                        disabled={isOverridingClaim}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary flex-2 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        onClick={startModalCamera}
                        disabled={isOverridingClaim}
                      >
                        Coba Lagi
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {modalSearchState === 'success' && (
              <div className="flex flex-col items-center py-10 gap-4 text-center max-w-sm mx-auto animate-fadeIn">
                {claimSuccess && (
                  <div className="bg-emerald-50 dark:bg-success-bg border border-emerald-300 dark:border-success-border p-4 rounded-2xl text-emerald-900 dark:text-success-text text-xs flex items-start gap-2 text-left">
                    <Check className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{claimSuccess}</span>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Premium Alert/Error Modal Popup */}
      {errorPopupMessage && (
        <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center px-4 z-200 animate-fadeIn" onClick={() => setErrorPopupMessage(null)}>
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-neutral-50">Informasi & Verifikasi</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-light whitespace-pre-line">
                {errorPopupMessage}
              </p>
            </div>
            <button 
              className="btn btn-primary w-full py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20 cursor-pointer"
              onClick={() => setErrorPopupMessage(null)}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Bulk Download Progress Modal */}
      {bulkDownloadProgress && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center px-4 z-200 animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-850 rounded-3xl p-8 shadow-2xl relative text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              {bulkDownloadProgress.current === bulkDownloadProgress.total ? (
                <Check className="w-8 h-8 text-primary-400" />
              ) : (
                <Download className="w-8 h-8 text-primary-400 animate-bounce" />
              )}
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-neutral-50">
                {bulkDownloadProgress.current === bulkDownloadProgress.total 
                  ? 'Unduhan Selesai!' 
                  : 'Mengunduh Foto...'}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-light">
                {bulkDownloadProgress.status}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-neutral-950 rounded-full h-3 overflow-hidden border border-neutral-850">
                <div 
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500 ease-out flex items-center justify-end pr-1"
                  style={{ width: `${(bulkDownloadProgress.current / bulkDownloadProgress.total) * 100}%` }}
                >
                  {bulkDownloadProgress.current > 0 && (
                    <span className="text-[10px] font-bold text-white drop-shadow">
                      {Math.round((bulkDownloadProgress.current / bulkDownloadProgress.total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-neutral-500 font-medium">
                {bulkDownloadProgress.current} / {bulkDownloadProgress.total} foto
              </p>
            </div>

            {bulkDownloadProgress.current === bulkDownloadProgress.total && (
              <button 
                className="btn btn-primary w-full py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary-500/20 cursor-pointer"
                onClick={() => setBulkDownloadProgress(null)}
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Popup */}
      {flagConfirmPhotoId && (
        <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center px-4 z-220 animate-fadeIn" onClick={() => !isFlaggingPhoto && handleCloseFlagModal()}>
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            
            {flagSuccessMessage ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Check className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-neutral-50 font-display">Berhasil</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-light">
                    {flagSuccessMessage}
                  </p>
                </div>
                <button 
                  className="btn btn-primary w-full py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20 cursor-pointer"
                  onClick={handleCloseFlagModal}
                >
                  Tutup
                </button>
              </div>
            ) : flagErrorMessage ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-neutral-50 font-display">Kesalahan</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-light font-mono text-left bg-neutral-950/30 p-2 border border-neutral-850 rounded-xl">
                    {flagErrorMessage}
                  </p>
                </div>
                <button 
                  className="btn btn-secondary w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                  onClick={handleCloseFlagModal}
                >
                  Tutup
                </button>
              </div>
            ) : isFlaggingPhoto ? (
              <div className="flex flex-col items-center py-6 gap-4 text-center animate-fadeIn">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-primary-500 rounded-full animate-spin" />
                </div>
                <h3 className="font-bold text-sm text-neutral-50 font-display">
                  Memproses...
                </h3>
                <p className="text-[11px] text-neutral-500 font-light">Menandai foto sebagai bukan foto Anda...</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-neutral-50 font-display">Tandai Bukan Foto Saya</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-light">
                    Apakah Anda yakin ingin menandai foto ini sebagai BUKAN foto Anda? Akses unduh dan pembelian untuk foto ini akan dikunci.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    className="btn btn-secondary flex-1 py-2.5 rounded-xl text-xs font-semibold"
                    onClick={() => setFlagConfirmPhotoId(null)}
                  >
                    Batal
                  </button>
                  <button 
                    className="btn btn-danger flex-1 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-rose-500/10 cursor-pointer"
                    onClick={() => executeFlagFalsePositive(flagConfirmPhotoId)}
                  >
                    Ya, Tandai
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
