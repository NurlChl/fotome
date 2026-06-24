'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Upload, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { loadModels, detectAllFacesInImage, FaceData } from '@/lib/faceDetector';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchEvent() {
      const res = await fetch(`/api/events/${slug}`);
      const data = await res.json();
      if (res.ok) setEvent(data.event);
    }
    fetchEvent();
  }, [slug]);

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
        const img = new Image();
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
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
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
    <div className="max-w-4xl bg-neutral-900/30 border border-neutral-900 p-8 rounded-3xl shadow-xl animate-fadeIn space-y-6">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div className="space-y-1">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-extrabold text-neutral-50 leading-tight">{event.title}</h1>
          <p className="text-xs text-neutral-500 font-light">{event.photoCount} photos uploaded</p>
        </div>
        <Link href={`/events/${event.slug}`} className="btn btn-secondary rounded-xl py-2 px-4 text-xs font-semibold" target="_blank">
          View Public Page ↗
        </Link>
      </div>

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
    </div>
  );
}
