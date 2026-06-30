'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, Upload, Trash2, CheckCircle2, XCircle, Clock, ImageIcon, AlertCircle, X } from 'lucide-react';
import { loadModels, detectAllFacesInImage, FaceData } from '@/lib/faceDetector';

import SearchableSelect from '@/components/SearchableSelect';

const CATEGORIES = [
  { value: 'marathon', label: 'Marathon' },
  { value: 'concert', label: 'Concert' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
];

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  progress?: number;
  faceCount?: number;
  error?: string;
}

interface EventData {
  _id: string;
  title: string;
  slug: string;
  photoCount: number;
  status: 'draft' | 'published' | 'archived';
  coverImage?: string;
  pricePerPhoto: number;
  eventDate: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
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

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  
  // Event details editing state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPricePerPhoto, setEditPricePerPhoto] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Voucher management state
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherData | null>(null);
  const [voucherForm, setVoucherForm] = useState({
    name: '',
    description: '',
    usageLimitPerUser: '',
    useAllowedUsers: false,
    allowedUsers: [] as { _id: string; name: string; email: string }[],
    minPhotos: '1',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    status: 'draft' as 'draft' | 'published',
  });
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [voucherFormErrors, setVoucherFormErrors] = useState<Record<string, string>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<{
    _id: string;
    watermarkedUrl: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    faceCount: number;
    createdAt: string;
  }[]>([]);
  const [photosPage, setPhotosPage] = useState(1);
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const userSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchUploadedPhotos = useCallback(async (page = 1, append = false) => {
    setIsLoadingPhotos(true);
    try {
      const res = await fetch(`/api/events/${slug}/photos?page=${page}&limit=12`);
      const data = await res.json();
      if (res.ok) {
        if (append) {
          setUploadedPhotos((prev) => [...prev, ...(data.photos || [])]);
        } else {
          setUploadedPhotos(data.photos || []);
        }
        setHasMorePhotos(data.pagination?.hasMore || false);
        setPhotosPage(page);
      }
    } catch (error) {
      console.error('Error fetching uploaded photos:', error);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [slug]);

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    setDeletingPhotoId(photoId);

    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete photo');
      }

      // Remove from state
      setUploadedPhotos((prev) => prev.filter((p) => p._id !== photoId));
      
      // Update local event photo count
      if (event) {
        setEvent({ ...event, photoCount: Math.max(0, event.photoCount - 1) });
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error deleting photo');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  useEffect(() => {
    async function fetchEvent() {
      const res = await fetch(`/api/events/${slug}`);
      const data = await res.json();
      if (res.ok) {
        setEvent(data.event);
        if (data.event.coverImage) {
          setThumbnailPreview(data.event.coverImage);
        }
        // Initialize edit form state
        setEditTitle(data.event.title);
        setEditPricePerPhoto(data.event.pricePerPhoto.toString());
        setEditCategory(data.event.category || 'other');
        // Format date for input
        const eventDate = new Date(data.event.eventDate);
        const formattedDate = eventDate.toISOString().split('T')[0];
        setEditEventDate(formattedDate);
      }
    }
    fetchEvent();
    const timer = setTimeout(() => {
      fetchUploadedPhotos(1, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [slug, fetchUploadedPhotos]);

  // Fetch vouchers
  const fetchVouchers = useCallback(async () => {
    const res = await fetch(`/api/events/${slug}/vouchers`);
    const data = await res.json();
    if (res.ok) {
      setVouchers(data.vouchers || []);
    }
  }, [slug]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVouchers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVouchers]);

  // Search users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.users || []);
        setShowUserDropdown(true);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  // Toggle user selection
  const toggleUserSelection = useCallback((user: { _id: string; name: string; email: string }) => {
    setVoucherForm(prev => {
      const isSelected = prev.allowedUsers.some(u => u._id === user._id);
      return {
        ...prev,
        allowedUsers: isSelected
          ? prev.allowedUsers.filter(u => u._id !== user._id)
          : [...prev.allowedUsers, user]
      };
    });
  }, []);

  // Remove selected user
  const removeUser = useCallback((userId: string) => {
    setVoucherForm(prev => ({
      ...prev,
      allowedUsers: prev.allowedUsers.filter(u => u._id !== userId)
    }));
  }, []);

  // Open voucher modal for create/edit
  const openVoucherModal = useCallback(async (voucher?: VoucherData) => {
    setVoucherError('');
    setVoucherFormErrors({});
    
    if (voucher) {
      setEditingVoucher(voucher);
      
      // Fetch user details if there are allowedUserIds
      let allowedUsers: { _id: string; name: string; email: string }[] = [];
      if (voucher.allowedUserIds && voucher.allowedUserIds.length > 0) {
        try {
          const res = await fetch('/api/users/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: voucher.allowedUserIds })
          });
          if (res.ok) {
            const data = await res.json();
            allowedUsers = data.users || [];
          }
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      }
      
      setVoucherForm({
        name: voucher.name,
        description: voucher.description || '',
        usageLimitPerUser: voucher.usageLimitPerUser ? voucher.usageLimitPerUser.toString() : '',
        useAllowedUsers: !!(voucher.allowedUserIds && voucher.allowedUserIds.length > 0),
        allowedUsers,
        minPhotos: voucher.minPhotos.toString(),
        discountType: voucher.discountType,
        discountValue: voucher.discountValue.toString(),
        status: voucher.status,
      });
    } else {
      setEditingVoucher(null);
      setVoucherForm({
        name: '',
        description: '',
        usageLimitPerUser: '',
        useAllowedUsers: false,
        allowedUsers: [],
        minPhotos: '1',
        discountType: 'percentage',
        discountValue: '',
        status: 'draft',
      });
    }
    setIsVoucherModalOpen(true);
  }, []);

  // Validate voucher form
  const validateVoucherForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!voucherForm.name.trim()) {
      errors.name = 'Nama voucher wajib diisi';
    }
    
    // Validate minPhotos
    const minPhotosVal = Number(voucherForm.minPhotos);
    if (!voucherForm.minPhotos || isNaN(minPhotosVal) || minPhotosVal < 1) {
      errors.minPhotos = 'Minimal foto minimal 1';
    }
    
    // Validate discountValue
    const discountVal = Number(voucherForm.discountValue);
    if (!voucherForm.discountValue || isNaN(discountVal)) {
      errors.discountValue = 'Nilai diskon wajib diisi';
    } else if (discountVal < 1) {
      errors.discountValue = 'Nilai diskon minimal 1';
    } else if (voucherForm.discountType === 'percentage' && discountVal > 100) {
      errors.discountValue = 'Persentase diskon maksimal 100';
    }
    
    // Validate usageLimitPerUser
    if (voucherForm.usageLimitPerUser) {
      const usageLimitVal = Number(voucherForm.usageLimitPerUser);
      if (isNaN(usageLimitVal) || usageLimitVal < 1) {
        errors.usageLimitPerUser = 'Batas penggunaan minimal 1';
      }
    }
    
    setVoucherFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [voucherForm]);

  // Save voucher
  const saveVoucher = useCallback(async () => {
    if (!validateVoucherForm()) {
      return;
    }
    
    setIsSavingVoucher(true);
    setVoucherError('');
    try {
      const body = {
        name: voucherForm.name,
        description: voucherForm.description,
        usageLimitPerUser: voucherForm.usageLimitPerUser ? Number(voucherForm.usageLimitPerUser) : null,
        allowedUserIds: voucherForm.useAllowedUsers ? voucherForm.allowedUsers.map(u => u._id) : [],
        minPhotos: Number(voucherForm.minPhotos),
        discountType: voucherForm.discountType,
        discountValue: Number(voucherForm.discountValue),
        status: voucherForm.status,
      };

      let res;
      if (editingVoucher) {
        res = await fetch(`/api/events/${slug}/vouchers/${editingVoucher._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/events/${slug}/vouchers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save voucher');
      }

      await fetchVouchers();
      setIsVoucherModalOpen(false);
    } catch (err) {
      setVoucherError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSavingVoucher(false);
    }
  }, [voucherForm, editingVoucher, slug, validateVoucherForm, fetchVouchers]);

  // Delete voucher
  const deleteVoucher = useCallback(async (voucherId: string) => {
    if (!confirm('Are you sure you want to delete this voucher?')) {
      return;
    }

    try {
      const res = await fetch(`/api/events/${slug}/vouchers/${voucherId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete voucher');
      }

      await fetchVouchers();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [slug, fetchVouchers]);

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  const uploadPhotos = async () => {
    if (!event || files.length === 0) return;
    setIsUploading(true);
    setTimeRemaining(null);
    setUploadSpeed(null);

    // Pre-load face detection models (non-blocking — upload proceeds regardless)
    await loadModels();

    const pendingFiles = files.filter((f) => f.status === 'pending');

    // Helper to detect faces client-side for a file
    const detectFacesInFile = async (file: File) => {
      return new Promise<FaceData[]>((resolve) => {
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const faces = await detectAllFacesInImage(img);
            resolve(faces);
          } catch (err) {
            console.error('Error detecting faces:', err);
            resolve([]);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve([]);
        };
        img.src = objectUrl;
      });
    };

    const totalBytes = pendingFiles.reduce((acc, f) => acc + f.file.size, 0);
    let completedBytes = 0;
    const startTime = Date.now();

    for (const uf of pendingFiles) {
      // 1. Update status to uploading and start face detection
      setFiles((prev) =>
        prev.map((f) =>
          f.file === uf.file ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      const faces = await detectFacesInFile(uf.file);
      const facesData = { [uf.file.name]: faces };

      // 2. Upload via XMLHttpRequest to track upload progress
      try {
        const result = await new Promise<{ status: string; faceCount?: number; error?: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/events/${slug}/photos`);

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const fileProgress = Math.round((evt.loaded / evt.total) * 100);
              
              setFiles((prev) =>
                prev.map((f) =>
                  f.file === uf.file ? { ...f, progress: fileProgress } : f
                )
              );

              // Calculate metrics
              const loadedSoFar = completedBytes + evt.loaded;
              const elapsedMs = Date.now() - startTime;
              if (elapsedMs > 500) {
                const speedBytesPerSec = (loadedSoFar / elapsedMs) * 1000;
                
                // Format upload speed
                let speedText = '';
                if (speedBytesPerSec > 1024 * 1024) {
                  speedText = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
                } else {
                  speedText = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`;
                }
                setUploadSpeed(speedText);

                // Format time remaining
                const remainingBytes = totalBytes - loadedSoFar;
                if (speedBytesPerSec > 0 && remainingBytes > 0) {
                  const secondsRemaining = Math.ceil(remainingBytes / speedBytesPerSec);
                  if (secondsRemaining > 60) {
                    const mins = Math.floor(secondsRemaining / 60);
                    const secs = secondsRemaining % 60;
                    setTimeRemaining(`sekitar ${mins}m ${secs}s lagi`);
                  } else {
                    setTimeRemaining(`sekitar ${secondsRemaining}s lagi`);
                  }
                } else {
                  setTimeRemaining('sebentar lagi...');
                }
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resData = JSON.parse(xhr.responseText);
                const itemResult = resData.results?.find(
                  (r: { filename: string }) => r.filename === uf.file.name
                );
                if (itemResult) {
                  resolve({
                    status: itemResult.status === 'success' ? 'success' : 'failed',
                    faceCount: itemResult.faceCount,
                    error: itemResult.error,
                  });
                } else {
                  resolve({ status: 'success' });
                }
              } catch {
                resolve({ status: 'success' });
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));

          const formData = new FormData();
          formData.append('photos', uf.file);
          formData.append('facesData', JSON.stringify(facesData));
          xhr.send(formData);
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.file === uf.file
              ? {
                  ...f,
                  status: result.status === 'success' ? 'success' : 'failed',
                  faceCount: result.faceCount,
                  error: result.error,
                  progress: 100,
                }
              : f
          )
        );
      } catch (err) {
        console.error('Error during upload:', err);
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uf.file ? { ...f, status: 'failed', error: 'Network error', progress: 0 } : f
          )
        );
      }

      completedBytes += uf.file.size;
    }

    setIsUploading(false);
    setTimeRemaining(null);
    setUploadSpeed(null);

    // Refresh the uploaded photos list and event details (to update photo count)
    fetchUploadedPhotos(1, false);
    
    // Refetch event details to get updated photo count
    try {
      const res = await fetch(`/api/events/${slug}`);
      const data = await res.json();
      if (res.ok) {
        setEvent(data.event);
      }
    } catch (err) {
      console.error('Error refreshing event stats:', err);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
  };

  const handlePublish = async () => {
    if (!event) return;
    
    setIsPublishing(true);
    setPublishError('');

    try {
      const res = await fetch(`/api/events/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish event');
      }

      setEvent({ ...event, status: 'published' });
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!event) return;
    
    setIsPublishing(true);
    setPublishError('');

    try {
      const res = await fetch(`/api/events/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to unpublish event');
      }

      setEvent({ ...event, status: 'draft' });
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPublishError('Please select an image file');
      return;
    }

    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadThumbnail = async () => {
    if (!thumbnailFile || !event) return;

    setIsUploadingThumbnail(true);
    setPublishError('');

    try {
      const formData = new FormData();
      formData.append('coverImage', thumbnailFile);

      const res = await fetch(`/api/events/${slug}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload thumbnail');
      }

      setEvent({ ...event, coverImage: data.event.coverImage });
      setThumbnailFile(null);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!event) return;
    setIsSavingDetails(true);
    setPublishError('');
    try {
      const updateData = {
        title: editTitle,
        pricePerPhoto: Number(editPricePerPhoto),
        eventDate: editEventDate,
        category: editCategory,
      };
      const res = await fetch(`/api/events/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update event details');
      }
      setEvent(data.event);
      setIsEditingDetails(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const successCount = files.filter((f) => f.status === 'success').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading event...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl bg-neutral-900/30 border border-neutral-900 p-5 sm:p-8 rounded-3xl shadow-xl animate-fadeIn space-y-6">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div className="space-y-1">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-neutral-50 leading-tight">{event.title}</h1>
            <span className={`text-[10px] px-2.5 py-1 font-bold uppercase rounded-full tracking-wider border ${
              event.status === 'published' 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                : event.status === 'draft'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800'
            }`}>
              {event.status}
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-light">{event.photoCount} photos uploaded</p>
        </div>
        <div className="flex gap-2">
          {event.status === 'draft' ? (
            <button
              onClick={handlePublish}
              disabled={isPublishing || event.photoCount === 0}
              className="btn btn-primary rounded-xl py-2 px-5 text-xs font-semibold shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title={event.photoCount === 0 ? 'Upload at least 1 photo before publishing' : 'Publish event'}
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Event'}
            </button>
          ) : event.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              disabled={isPublishing}
              className="btn btn-ghost rounded-xl py-2 px-5 text-xs font-semibold border border-neutral-800"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unpublish'}
            </button>
          ) : null}
          <Link href={`/events/${event.slug}`} className="btn btn-secondary rounded-xl py-2 px-4 text-xs font-semibold" target="_blank">
            View Public Page ↗
          </Link>
        </div>
      </div>

      {/* Status Messages */}
      {publishError && (
        <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm flex items-start gap-2 animate-fadeIn">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      {/* Thumbnail Upload Section */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-50 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Event Thumbnail
            </h3>
            <p className="text-xs text-neutral-500 mt-1 font-light">
              Cover image for your event. If not set, the latest uploaded photo will be used automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Thumbnail Preview */}
          <div className="relative w-full sm:w-48 h-48 bg-neutral-950/40 border-2 border-dashed border-neutral-850 rounded-xl overflow-hidden flex items-center justify-center group">
            {thumbnailPreview ? (
              <Image
                src={thumbnailPreview}
                alt="Event thumbnail"
                fill
                sizes="(max-width: 640px) 100vw, 192px"
                priority
                className="object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-600 font-light">No thumbnail yet</p>
              </div>
            )}
            {thumbnailPreview && (
              <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="btn btn-sm btn-secondary rounded-lg text-xs"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1 flex flex-col justify-center gap-3">
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleThumbnailSelect}
              className="hidden"
            />
            
            {!thumbnailFile ? (
              <button
                onClick={() => thumbnailInputRef.current?.click()}
                className="btn btn-secondary rounded-xl py-2 px-4 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> {thumbnailPreview ? 'Change Thumbnail' : 'Upload Thumbnail'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={uploadThumbnail}
                  disabled={isUploadingThumbnail}
                  className="btn btn-primary rounded-xl py-2 px-4 text-sm font-semibold flex items-center justify-center gap-2 flex-1"
                >
                  {isUploadingThumbnail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Save Thumbnail
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setThumbnailFile(null);
                    if (event?.coverImage) {
                      setThumbnailPreview(event.coverImage);
                    } else {
                      setThumbnailPreview(null);
                    }
                  }}
                  className="btn btn-ghost rounded-xl py-2 px-4 text-sm"
                  disabled={isUploadingThumbnail}
                >
                  Cancel
                </button>
              </div>
            )}
            
            <p className="text-[10px] text-neutral-600 font-light">
              Recommended: 1200x630px • Max 5MB • JPEG, PNG, or WebP
            </p>
          </div>
        </div>
      </div>

      {/* Event Details Section */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-50 flex items-center gap-2">
              Event Details
            </h3>
            <p className="text-xs text-neutral-500 mt-1 font-light">
              Edit your event&apos;s title and pricing.
            </p>
          </div>
          {!isEditingDetails ? (
            <button
              onClick={() => setIsEditingDetails(true)}
              className="btn btn-secondary rounded-xl py-2 px-4 text-xs font-semibold"
            >
              Edit Details
            </button>
          ) : null}
        </div>

        {isEditingDetails ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 block">Event Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 block">Event Date</label>
              <input
                type="date"
                value={editEventDate}
                onChange={(e) => setEditEventDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 block">Price per Photo (Rp)</label>
              <input
                type="number"
                value={editPricePerPhoto}
                onChange={(e) => setEditPricePerPhoto(e.target.value)}
                min="0"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 block">Category</label>
              <SearchableSelect
                options={CATEGORIES}
                value={editCategory}
                onChange={(value) => setEditCategory(value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveDetails}
                disabled={isSavingDetails}
                className="btn btn-primary rounded-xl py-2 px-5 text-xs font-semibold flex items-center gap-2"
              >
                {isSavingDetails ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button
                onClick={() => {
                  setIsEditingDetails(false);
                  if (event) {
                    setEditTitle(event.title);
                    setEditPricePerPhoto(event.pricePerPhoto.toString());
                    setEditCategory(event.category || 'other');
                    const eventDate = new Date(event.eventDate);
                    const formattedDate = eventDate.toISOString().split('T')[0];
                    setEditEventDate(formattedDate);
                  }
                }}
                disabled={isSavingDetails}
                className="btn btn-ghost rounded-xl py-2 px-5 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">Event Title</span>
              <span className="text-sm font-medium text-neutral-100">{event.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">Event Date</span>
              <span className="text-sm font-medium text-neutral-100">{new Date(event.eventDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">Price per Photo</span>
              <span className="text-sm font-medium text-neutral-100">Rp {event.pricePerPhoto.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">Category</span>
              <span className="text-sm font-medium text-neutral-100 capitalize">
                {CATEGORIES.find((c) => c.value === event.category)?.label || event.category || '-'}
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-800">
              <div className="flex justify-between items-center text-[10px] text-neutral-500">
                <span>Created at: {new Date(event.createdAt).toLocaleString('id-ID')}</span>
                <span>Updated at: {new Date(event.updatedAt).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vouchers Section */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-50 flex items-center gap-2">
              Vouchers
            </h3>
            <p className="text-xs text-neutral-500 mt-1 font-light">
              Manage vouchers for your event. Only available for paid events.
            </p>
          </div>
          {event.pricePerPhoto > 0 && (
            <button
              onClick={() => openVoucherModal()}
              className="btn btn-primary rounded-xl py-2 px-4 text-xs font-semibold"
            >
              + Add Voucher
            </button>
          )}
        </div>

        {event.pricePerPhoto <= 0 ? (
          <div className="text-center py-4 text-xs text-neutral-500">
            Vouchers can only be created for events with paid photos.
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-4 text-xs text-neutral-500">
            No vouchers created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((voucher) => (
              <div
                key={voucher._id}
                className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-neutral-50">{voucher.name}</h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                          voucher.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {voucher.status}
                      </span>
                    </div>
                    {voucher.description && (
                      <p className="text-xs text-neutral-500 mt-1">{voucher.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openVoucherModal(voucher)}
                      className="text-xs text-neutral-400 hover:text-neutral-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteVoucher(voucher._id)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-neutral-400">
                  <div>
                    <span className="block text-neutral-500">Discount</span>
                    <span className="font-semibold">
                      {voucher.discountType === 'percentage'
                        ? `${voucher.discountValue}%`
                        : `Rp ${voucher.discountValue.toLocaleString('id-ID')}`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-neutral-500">Min Photos</span>
                    <span className="font-semibold">{voucher.minPhotos}</span>
                  </div>
                  {voucher.usageLimitPerUser && (
                    <div>
                      <span className="block text-neutral-500">Usage/ User</span>
                      <span className="font-semibold">{voucher.usageLimitPerUser}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voucher Modal */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-50 mb-4">
              {editingVoucher ? 'Edit Voucher' : 'Add Voucher'}
            </h3>
            
            {voucherError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{voucherError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 mb-1 block">Voucher Name *</label>
                <input
                  type="text"
                  value={voucherForm.name}
                  onChange={(e) => {
                    setVoucherForm({ ...voucherForm, name: e.target.value });
                    if (voucherFormErrors.name) {
                      setVoucherFormErrors({ ...voucherFormErrors, name: '' });
                    }
                  }}
                  className={`w-full bg-neutral-950 border rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 ${voucherFormErrors.name ? 'border-rose-500' : 'border-neutral-800'}`}
                  placeholder="Voucher Name"
                />
                {voucherFormErrors.name && (
                  <p className="text-rose-400 text-xs mt-1">{voucherFormErrors.name}</p>
                )}
              </div>
              
              <div>
                <label className="text-xs font-semibold text-neutral-300 mb-1 block">Description (Optional)</label>
                <textarea
                  value={voucherForm.description}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, description: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  placeholder="Terms and conditions"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 mb-1 block">Discount Type *</label>
                  <select
                    value={voucherForm.discountType}
                    onChange={(e) => {
                      setVoucherForm({ ...voucherForm, discountType: e.target.value as 'percentage' | 'fixed' });
                      if (voucherFormErrors.discountValue) {
                        setVoucherFormErrors({ ...voucherFormErrors, discountValue: '' });
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 mb-1 block">
                    Discount Value *
                    {voucherForm.discountType === 'percentage' && ' (1-100)'}
                  </label>
                  <input
                    type="number"
                    value={voucherForm.discountValue}
                    onChange={(e) => {
                      setVoucherForm({ ...voucherForm, discountValue: e.target.value });
                      if (voucherFormErrors.discountValue) {
                        setVoucherFormErrors({ ...voucherFormErrors, discountValue: '' });
                      }
                    }}
                    min="1"
                    max={voucherForm.discountType === 'percentage' ? 100 : undefined}
                    className={`w-full bg-neutral-950 border rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 ${voucherFormErrors.discountValue ? 'border-rose-500' : 'border-neutral-800'}`}
                    placeholder={voucherForm.discountType === 'percentage' ? '10' : '10000'}
                  />
                  {voucherFormErrors.discountValue && (
                    <p className="text-rose-400 text-xs mt-1">{voucherFormErrors.discountValue}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 mb-1 block">
                    Min Photos to Purchase *
                  </label>
                  <input
                    type="number"
                    value={voucherForm.minPhotos}
                    onChange={(e) => {
                      setVoucherForm({ ...voucherForm, minPhotos: e.target.value });
                      if (voucherFormErrors.minPhotos) {
                        setVoucherFormErrors({ ...voucherFormErrors, minPhotos: '' });
                      }
                    }}
                    min="1"
                    className={`w-full bg-neutral-950 border rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 ${voucherFormErrors.minPhotos ? 'border-rose-500' : 'border-neutral-800'}`}
                  />
                  {voucherFormErrors.minPhotos && (
                    <p className="text-rose-400 text-xs mt-1">{voucherFormErrors.minPhotos}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 mb-1 block">
                    Usage Limit per User (Optional)
                  </label>
                  <input
                    type="number"
                    value={voucherForm.usageLimitPerUser}
                    onChange={(e) => {
                      setVoucherForm({ ...voucherForm, usageLimitPerUser: e.target.value });
                      if (voucherFormErrors.usageLimitPerUser) {
                        setVoucherFormErrors({ ...voucherFormErrors, usageLimitPerUser: '' });
                      }
                    }}
                    min="1"
                    placeholder="No limit"
                    className={`w-full bg-neutral-950 border rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 ${voucherFormErrors.usageLimitPerUser ? 'border-rose-500' : 'border-neutral-800'}`}
                  />
                  {voucherFormErrors.usageLimitPerUser && (
                    <p className="text-rose-400 text-xs mt-1">{voucherFormErrors.usageLimitPerUser}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="useAllowedUsers"
                    checked={voucherForm.useAllowedUsers}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, useAllowedUsers: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-950 text-primary-600 focus:ring-primary-500/50 focus:ring-2"
                  />
                  <label htmlFor="useAllowedUsers" className="text-xs font-semibold text-neutral-300">
                    Restrict to specific users
                  </label>
                </div>

                {voucherForm.useAllowedUsers && (
                  <div className="space-y-2" ref={userSearchRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        onFocus={() => setShowUserDropdown(true)}
                        placeholder="Search users by name or email..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      />
                      {isSearchingUsers && (
                        <div className="absolute right-3 top-3">
                          <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                        </div>
                      )}

                      {showUserDropdown && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {searchResults.map((user) => {
                            const isSelected = voucherForm.allowedUsers.some(u => u._id === user._id);
                            return (
                              <div
                                key={user._id}
                                onClick={() => toggleUserSelection(user)}
                                className={`px-4 py-3 cursor-pointer transition ${
                                  isSelected
                                    ? 'bg-primary-500/10 text-primary-300'
                                    : 'hover:bg-neutral-900/50'
                                }`}
                              >
                                <div className="text-sm font-medium">{user.name}</div>
                                <div className="text-xs text-neutral-500">{user.email}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {voucherForm.allowedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {voucherForm.allowedUsers.map((user) => (
                          <div
                            key={user._id}
                            className="bg-neutral-800 text-neutral-200 px-3 py-1 rounded-full text-xs flex items-center gap-2"
                          >
                            {user.name}
                            <button
                              onClick={() => removeUser(user._id)}
                              className="hover:text-rose-400 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-xs font-semibold text-neutral-300 mb-1 block">Status *</label>
                <select
                  value={voucherForm.status}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, status: e.target.value as 'draft' | 'published' })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveVoucher}
                disabled={isSavingVoucher}
                className="btn btn-primary rounded-xl py-2 px-5 text-xs font-semibold flex-1 flex items-center justify-center gap-2"
              >
                {isSavingVoucher ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Voucher'
                )}
              </button>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                disabled={isSavingVoucher}
                className="btn btn-ghost rounded-xl py-2 px-5 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {event.status === 'draft' && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 p-4 rounded-xl text-sm flex items-start gap-3 animate-fadeIn">
          <Clock className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Event is in Draft Mode</p>
            <p className="text-xs text-amber-800 dark:text-amber-300/80 font-light leading-relaxed">
              This event is not visible to the public yet. Upload your photos and click <strong>&quot;Publish Event&quot;</strong> when you&apos;re ready to make it live.
            </p>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition duration-200 bg-neutral-950/20 flex flex-col items-center justify-center gap-3 ${
          isDragging 
            ? 'border-primary-500 bg-primary-500/5' 
            : 'border-neutral-850 hover:border-neutral-800'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="photo-upload-input"
        />
        <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
          <Upload className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-neutral-50">Drag & Drop Photos Here</h3>
        <p className="text-xs text-neutral-500 leading-relaxed font-light max-w-sm">
          or click to browse files • JPEG, PNG, WebP • Max 20MB each • Up to 20 per batch
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-neutral-900 animate-fadeIn">
          
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-neutral-400">
                {successCount} uploaded • {pendingCount} pending
                {failedCount > 0 && ` • ${failedCount} failed`}
              </p>
              {isUploading && (timeRemaining || uploadSpeed) && (
                <p className="text-[11px] text-primary-400 font-medium flex items-center gap-2">
                  <span className="animate-pulse">●</span> Uploading... {uploadSpeed && `(${uploadSpeed})`} {timeRemaining && `• ${timeRemaining}`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {successCount > 0 && (
                <button className="btn btn-ghost btn-sm text-xs rounded-lg" onClick={clearCompleted}>
                  Clear Completed
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  className="btn btn-primary btn-sm text-xs font-semibold rounded-lg px-4 py-2"
                  onClick={uploadPhotos}
                  disabled={isUploading}
                  id="btn-upload-all"
                >
                  {isUploading ? 'Uploading...' : `Upload ${pendingCount} Photos`}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 border border-neutral-900 bg-neutral-950/40 p-4 rounded-2xl">
            {files.map((uf, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-neutral-950/60 border border-neutral-900 rounded-xl hover:border-neutral-850 transition duration-150">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">
                      {uf.status === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                       uf.status === 'failed' ? <XCircle className="w-5 h-5 text-rose-500" /> : 
                       uf.status === 'uploading' ? <Loader2 className="w-5 h-5 text-primary-400 animate-spin" /> : 
                       <Clock className="w-5 h-5 text-neutral-500" />}
                    </span>
                    <span className="text-sm text-neutral-300 font-medium truncate max-w-[200px] sm:max-w-[350px]">{uf.file.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {uf.faceCount !== undefined && (
                      <span className="text-xs text-neutral-500 font-light">
                        {uf.faceCount} faces detected
                      </span>
                    )}

                    {uf.status === 'uploading' && uf.progress !== undefined && (
                      <span className="text-xs text-primary-400 font-bold">
                        {uf.progress}%
                      </span>
                    )}

                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full tracking-wider border ${
                      uf.status === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                      uf.status === 'failed' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                      uf.status === 'uploading' ? 'bg-primary-500/10 text-primary-300 border-primary-500/20' :
                      'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}>
                      {uf.status === 'uploading' && uf.progress !== undefined ? 'uploading' : uf.status}
                    </span>
                    {uf.status !== 'uploading' && (
                      <button
                        className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-md transition"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {uf.status === 'uploading' && uf.progress !== undefined && (
                  <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden mt-1 border border-neutral-900">
                    <div 
                      className="bg-primary-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Photos Section */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-50 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Uploaded Photos
            </h3>
            <p className="text-xs text-neutral-500 mt-1 font-light">
              View and manage the photos in this event.
            </p>
          </div>
          <span className="badge badge-primary">{event.photoCount} photos</span>
        </div>

        {uploadedPhotos.length === 0 ? (
          <div className="text-center py-12 border border-neutral-900 rounded-2xl bg-neutral-950/20">
            <ImageIcon className="w-12 h-12 text-neutral-800 mx-auto mb-3" />
            <p className="text-sm text-neutral-400 font-medium">No photos uploaded yet</p>
            <p className="text-xs text-neutral-600 mt-1">Upload some photos using the zone above.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {uploadedPhotos.map((photo) => (
                <div key={photo._id} className="relative group aspect-square bg-neutral-950 border border-neutral-900 rounded-xl overflow-hidden shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-neutral-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-between items-start">
                      <span className="bg-neutral-900/90 border border-neutral-800 text-[10px] text-neutral-400 px-2 py-0.5 rounded-full font-medium">
                        {photo.faceCount} {photo.faceCount === 1 ? 'face' : 'faces'}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleDeletePhoto(photo._id)}
                        disabled={deletingPhotoId === photo._id}
                        className="p-2 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/20 hover:border-rose-500/50 text-rose-300 rounded-lg transition duration-150 disabled:opacity-50"
                        title="Delete photo"
                      >
                        {deletingPhotoId === photo._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMorePhotos && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchUploadedPhotos(photosPage + 1, true)}
                  disabled={isLoadingPhotos}
                  className="btn btn-secondary text-xs rounded-xl px-6 py-2 flex items-center gap-2"
                >
                  {isLoadingPhotos ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                    </>
                  ) : (
                    'Load More Photos'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
