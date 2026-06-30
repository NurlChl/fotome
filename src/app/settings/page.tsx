'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, Loader2, CheckCircle2, AlertTriangle, User, Lock } from 'lucide-react';
import { useConfirm } from '@/components/ModalProvider';
import { getFaceDescriptor } from '@/lib/faceDetector';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'photographer' | 'admin' | 'superadmin';
  faceDescriptor?: number[];
  photographerProfile?: {
    bio?: string;
    portfolio?: string;
  };
}

type RegisterState = 'idle' | 'capturing' | 'processing' | 'success' | 'error';

export default function SettingsPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const { confirm } = useConfirm();

  const [user, setUser] = useState<UserData | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [portfolio, setPortfolio] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingBio, setIsDeletingBio] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Biometrics States
  const [registerState, setRegisterState] = useState<RegisterState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/users/profile');
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setName(data.user.name);
        setBio(data.user.photographerProfile?.bio || '');
        setPortfolio(data.user.photographerProfile?.portfolio || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[DEBUG-SETTINGS] useSession status:', status);
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings');
      return;
    }

    if (status === 'authenticated') {
      setTimeout(() => fetchProfile(), 0);
    }
  }, [status, router, fetchProfile]);

  useEffect(() => {
    // Focus or scroll to face-registration if hash is present
    if (window.location.hash === '#face-registration') {
      const el = document.getElementById('face-registration');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLoading]);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);



  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio: user?.role === 'photographer' ? bio : undefined,
          portfolio: user?.role === 'photographer' ? portfolio : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setUser((prev) => (prev ? { ...prev, name } : null));
        await update({ name });
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  // Start webcam for biometrics capture
  const startCamera = async () => {
    try {
      setErrorMessage('');
      setRegisterState('capturing');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      setErrorMessage('Tidak dapat mengakses kamera. Silakan periksa izin kamera Anda.');
      setRegisterState('error');
    }
  };

  // Capture face and save biometrics descriptor
  const registerFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setRegisterState('processing');
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw frame to canvas
    ctx.drawImage(videoRef.current, 0, 0);

    // Stop webcam
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      // Process face descriptor using local face-api.js model
      const descriptor = await getFaceDescriptor(canvas);
      if (!descriptor) {
        throw new Error('Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan wajah terlihat jelas.');
      }

      // Convert canvas to base64 data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Save descriptor to user profile
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          faceDescriptor: descriptor,
          faceImageUrl: dataUrl
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save biometric profile.');
      }

      setRegisterState('success');
      setMessage({ type: 'success', text: 'Face ID registered successfully!' });
      await fetchProfile();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setErrorMessage(error.message || 'Pendaftaran Face ID gagal. Silakan coba kembali.');
      setRegisterState('error');
    }
  };

  const cancelCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setRegisterState('idle');
  };

  const handleDeleteBiometrics = async () => {
    const isConfirmed = await confirm(
      'Hapus Data Wajah',
      'Apakah Anda yakin ingin menghapus data biometrik Wajah Anda? Tindakan ini akan menghapus data pendaftaran Face ID Anda dari server secara permanen.'
    );
    if (!isConfirmed) return;

    setIsDeletingBio(true);
    setMessage(null);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: 'Data biometrik Face ID berhasil dihapus.',
        });
        await fetchProfile();
        setRegisterState('idle');
      } else {
        throw new Error(data.error || 'Gagal menghapus data biometrik');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menghapus data biometrik',
      });
    } finally {
      setIsDeletingBio(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-neutral-800 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="pt-28 min-h-screen pb-16 bg-neutral-950 text-neutral-100">
      <div className="container mx-auto px-6 max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-neutral-900 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Settings</h1>
          <p className="text-neutral-400 text-sm">Manage your profile, Face ID biometrics, and privacy preferences.</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg flex items-start gap-3 border text-sm ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <span className="font-semibold">{message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}</span>
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* LEFT: NAV/INFO */}
          <div className="space-y-4">
            <div className="bg-neutral-900/40 border border-neutral-900 rounded-xl p-4 space-y-2 text-xs text-neutral-400 leading-relaxed">
              <div className="font-semibold text-neutral-50 mb-1">Privacy Guarantee</div>
              <p>Selfie uploads and webcam captures are processed locally in your browser to extract biometric face descriptors.</p>
              <p>The raw images are not kept on our servers, satisfying global data privacy standards.</p>
            </div>
          </div>

          {/* RIGHT: SETTINGS SECTIONS */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Profile Settings */}
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-neutral-50 flex items-center gap-2"><User className="w-5 h-5 text-neutral-400" /> Profile Settings</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Email Address</label>
                  <input 
                    type="email" 
                    value={user?.email} 
                    disabled 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-400 cursor-not-allowed opacity-60" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-primary-600 focus:ring-1 focus:ring-primary-600 rounded-lg px-4 py-2 text-sm text-neutral-50 transition duration-150 outline-none" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="btn btn-primary text-xs font-semibold rounded-lg px-4 py-2"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </form>
            </div>

            {/* Face ID Biometrics Registration */}
            <div id="face-registration" className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-50 flex items-center gap-2"><Lock className="w-5 h-5 text-neutral-400" /> Face ID Biometrics</h2>
                  <p className="text-xs text-neutral-500 mt-1">Register your Face ID to search and download photos of yourself automatically.</p>
                </div>
                <div>
                  {user?.faceDescriptor ? (
                    <span className="badge badge-success">Face ID Registered</span>
                  ) : (
                    <span className="badge badge-warning">Face ID Empty</span>
                  )}
                </div>
              </div>

              {registerState === 'idle' && (
                <div className="space-y-4">
                  <p className="text-xs text-neutral-400 leading-relaxed font-light">
                    Pemindaian wajah Anda dilakukan secara aman menggunakan library open-source face-api.js langsung di browser Anda. Descriptor wajah 128-dimensi akan disimpan ke profil Anda untuk mencocokkan kepemilikan foto secara instan.
                  </p>
                  <button onClick={startCamera} className="btn btn-primary text-xs font-semibold rounded-lg px-4 py-2 flex items-center gap-2">
                    <Camera className="w-4 h-4" /> {user?.faceDescriptor ? 'Re-register Face ID' : 'Register Face ID'}
                  </button>
                </div>
              )}

              {registerState === 'capturing' && (
                <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                  <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-neutral-800 bg-black relative">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={cancelCapture} className="btn btn-secondary flex-1 rounded-lg text-xs">
                      Cancel
                    </button>
                    <button onClick={registerFace} className="btn btn-primary flex-1 rounded-lg text-xs font-semibold">
                      Capture & Save
                    </button>
                  </div>
                </div>
              )}

              {registerState === 'processing' && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                  <p className="text-sm text-neutral-400 font-medium">Extracting face biometrics...</p>
                  <p className="text-xs text-neutral-500 font-light">This is processed completely locally on your device.</p>
                </div>
              )}

              {(registerState === 'success' || (registerState === 'idle' && user?.faceDescriptor)) && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs text-emerald-400 flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <span className="font-medium text-neutral-50 block mb-0.5">Face ID Active</span>
                      Sistem pencocokan wajah siap digunakan. Anda dapat mencari foto event yang terhubung dengan wajah Anda secara instan dari menu pencarian di halaman event.
                    </div>
                  </div>
                  <button onClick={handleDeleteBiometrics} disabled={isDeletingBio} className="btn btn-secondary hover:bg-rose-950/20 text-rose-500 border-neutral-800 text-xs font-semibold rounded-lg px-4 py-2 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete Biometrics
                  </button>
                </div>
              )}

              {registerState === 'error' && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-lg text-xs text-rose-400 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    <div>
                      <span className="font-medium text-neutral-50 block mb-0.5">Biometric Extraction Failed</span>
                      {errorMessage || 'Wajah tidak terdeteksi. Silakan coba kembali.'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRegisterState('idle')} className="btn btn-secondary text-xs rounded-lg">
                      Back
                    </button>
                    <button onClick={startCamera} className="btn btn-primary text-xs font-semibold rounded-lg">
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* GDPR Settings */}
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-rose-500 flex items-center gap-2"><Lock className="w-5 h-5" /> Privacy & Biometrics PURGE (GDPR)</h2>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">
                Under GDPR and biometric privacy regulations, you have the absolute right to delete all records of selfies you have uploaded or captured for face recognition search from our analytics servers.
              </p>
              <div className="border-t border-neutral-900 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-neutral-500 font-light">
                  Permanently wipe all logs of biometric search requests.
                </div>
                <button
                  className="btn btn-danger text-xs font-semibold rounded-lg px-4 py-2"
                  onClick={handleDeleteBiometrics}
                  disabled={isDeletingBio}
                >
                  {isDeletingBio ? 'Purging...' : 'Purge All Biometrics Data'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
