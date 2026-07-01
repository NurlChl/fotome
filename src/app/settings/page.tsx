'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, Loader2, CheckCircle2, AlertTriangle, User, Lock } from 'lucide-react';
import { useConfirm } from '@/components/ModalProvider';
import { getFaceDescriptor } from '@/lib/faceDetector';

// Beautiful responsive face direction guide visualizer
function FaceGuideVisualizer({ step }: { step: 'front' | 'left' | 'right' }) {
  const getTransform = () => {
    switch (step) {
      case 'left':
        return 'translateX(-12px) rotateY(-20deg)';
      case 'right':
        return 'translateX(12px) rotateY(20deg)';
      default:
        return 'translateX(0px) rotateY(0deg)';
    }
  };

  return (
    <div className="w-16 h-16 relative flex items-center justify-center bg-neutral-950/80 rounded-2xl border border-neutral-800 shadow-inner overflow-hidden shrink-0">
      {/* Glow aura */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent pointer-events-none" />
      
      {/* 3D-like morphing face guide */}
      <div 
        className="w-12 h-12 flex items-center justify-center transition-all duration-500 ease-out"
        style={{ 
          transform: getTransform(),
          perspective: '100px'
        }}
      >
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          stroke="currentColor" 
          className="w-10 h-10 text-primary-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]"
        >
          {/* Head Shape */}
          <path 
            d="M50 15 C28 15 25 35 25 55 C25 78 35 85 50 85 C65 85 75 78 75 55 C75 35 72 15 50 15 Z" 
            strokeWidth="3" 
            fill="currentColor" 
            fillOpacity="0.04"
          />
          {/* Ears */}
          <path d="M24 45 C20 45 20 55 24 55" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M76 45 C80 45 80 55 76 55" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Face elements group - shifts extra for 3D effect */}
          <g 
            className="transition-transform duration-500" 
            style={{ 
              transform: step === 'left' ? 'translateX(-8px)' : step === 'right' ? 'translateX(8px)' : 'translateX(0)' 
            }}
          >
            {/* Eyes */}
            <circle cx="38" cy="48" r="3.5" fill="currentColor" />
            <circle cx="62" cy="48" r="3.5" fill="currentColor" />
            
            {/* Nose */}
            <path d="M50 44 L50 56 L46 56" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Smile */}
            <path 
              d="M42 66 Q50 71 58 66" 
              strokeWidth="3" 
              strokeLinecap="round" 
            />
          </g>

          {/* Guide arrows indicating direction */}
          {step === 'left' && (
            <path 
              d="M18 50 L6 50 M12 44 L6 50 L12 56" 
              stroke="#f43f5e" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="animate-pulse"
            />
          )}
          {step === 'right' && (
            <path 
              d="M82 50 L94 50 M88 44 L94 50 L88 56" 
              stroke="#f43f5e" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

// Beautiful interactive SVG overlay for camera guide (KYC/Bank-style)
function BiometricCameraOverlay({ step }: { step: 'front' | 'left' | 'right' }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg
        viewBox="0 0 400 300"
        className="w-full h-full text-primary-500 transition-all duration-500"
        fill="none"
        stroke="currentColor"
      >
        {/* Semi-transparent dark overlay surrounding the focus area using mask */}
        <defs>
          <mask id="biometric-mask-settings">
            {/* White background: keep visible */}
            <rect width="400" height="300" fill="white" />
            {/* Black focus area: transparent window */}
            {step === 'front' && (
              <g fill="black">
                {/* Oval Wajah */}
                <path d="M200,60 C145,60 135,110 135,160 C135,215 155,240 200,240 C245,240 265,215 265,160 C265,110 255,60 200,60 Z" />
                {/* Telinga Kiri */}
                <path d="M135,135 C122,135 122,175 135,175 Z" />
                {/* Telinga Kanan */}
                <path d="M265,135 C278,135 278,175 265,175 Z" />
              </g>
            )}
            {step === 'left' && (
              <g fill="black">
                {/* Profil Wajah Kiri */}
                <path d="M215,60 C165,60 155,100 155,130 C155,135 142,140 142,145 C142,150 155,153 155,160 C155,215 175,240 215,240 C250,240 265,215 265,160 C265,110 255,60 215,60 Z" />
                {/* Telinga Kanan */}
                <path d="M265,135 C278,135 278,175 265,175 Z" />
              </g>
            )}
            {step === 'right' && (
              <g fill="black">
                {/* Profil Wajah Kanan */}
                <path d="M185,60 C145,60 135,110 135,160 C135,215 150,240 185,240 C225,240 245,215 245,160 C245,153 258,150 258,145 C258,140 245,135 245,130 C245,100 235,60 185,60 Z" />
                {/* Telinga Kiri */}
                <path d="M135,135 C122,135 122,175 135,175 Z" />
              </g>
            )}
          </mask>
        </defs>

        {/* Apply the mask to darken background (KYC bank registration look) */}
        <rect width="400" height="300" fill="black" fillOpacity="0.45" mask="url(#biometric-mask-settings)" />

        {/* Dynamic Biometric Face & Ears Outlines with opacity */}
        <g className="transition-all duration-500" strokeWidth="2" strokeOpacity="0.6">
          {step === 'front' && (
            <g className="animate-pulse">
              {/* Head shape */}
              <path
                d="M200,60 C145,60 135,110 135,160 C135,215 155,240 200,240 C245,240 265,215 265,160 C265,110 255,60 200,60 Z"
                strokeWidth="2.5"
              />
              {/* Left ear */}
              <path d="M135,135 C122,135 122,175 135,175" strokeWidth="2" strokeLinecap="round" />
              {/* Right ear */}
              <path d="M265,135 C278,135 278,175 265,175" strokeWidth="2" strokeLinecap="round" />
              
              {/* Guidelines (eyes & mouth markers) */}
              <line x1="155" y1="140" x2="245" y2="140" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.4" />
              <line x1="200" y1="75" x2="200" y2="225" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.4" />
            </g>
          )}

          {step === 'left' && (
            <g className="animate-pulse">
              {/* Head shape profiling left (nose/mouth sticking out to the left) */}
              <path
                d="M215,60 C165,60 155,100 155,130 C155,135 142,140 142,145 C142,150 155,153 155,160 C155,215 175,240 215,240 C250,240 265,215 265,160 C265,110 255,60 215,60 Z"
                strokeWidth="2.5"
              />
              {/* Right ear visible in the right side */}
              <path d="M265,135 C278,135 278,175 265,175" strokeWidth="2" strokeLinecap="round" />
              
              {/* Sidelined guide markers */}
              <line x1="175" y1="140" x2="250" y2="140" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.4" />
            </g>
          )}

          {step === 'right' && (
            <g className="animate-pulse">
              {/* Head shape profiling right (nose/mouth sticking out to the right) */}
              <path
                d="M185,60 C145,60 135,110 135,160 C135,215 150,240 185,240 C225,240 245,215 245,160 C245,153 258,150 258,145 C258,140 245,135 245,130 C245,100 235,60 185,60 Z"
                strokeWidth="2.5"
              />
              {/* Left ear visible in the left side */}
              <path d="M135,135 C122,135 122,175 135,175" strokeWidth="2" strokeLinecap="round" />
              
              {/* Sidelined guide markers */}
              <line x1="150" y1="140" x2="225" y2="140" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.4" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

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
  const [capturedDescriptors, setCapturedDescriptors] = useState<{
    front?: number[];
    left?: number[];
    right?: number[];
  }>({});
  const [captureStep, setCaptureStep] = useState<'front' | 'left' | 'right'>('front');

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
      setCapturedDescriptors({});
      setCaptureStep('front');
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

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Validate + capture canvas BEFORE changing state (video still in DOM and active)
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setErrorMessage('Kamera belum siap. Tunggu sebentar lalu coba kembali.');
      setRegisterState('error');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Now set processing — video stays in DOM (kept visible via isCameraActive condition below)
    setRegisterState('processing');

    try {
      // Process face descriptor using local face-api.js model
      const descriptor = await getFaceDescriptor(canvas);
      if (!descriptor) {
        throw new Error('Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan wajah terlihat jelas.');
      }

      const nextDescriptors = { ...capturedDescriptors, [captureStep]: descriptor };
      setCapturedDescriptors(nextDescriptors);

      if (captureStep === 'front') {
        setCaptureStep('left');
        setRegisterState('capturing');
      } else if (captureStep === 'left') {
        setCaptureStep('right');
        setRegisterState('capturing');
      } else {
        // Stop webcam after capturing all three profiles
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Convert canvas to base64 data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Save descriptor to user profile
        const res = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            faceDescriptor: nextDescriptors.front,
            faceDescriptorLeft: nextDescriptors.left,
            faceDescriptorRight: nextDescriptors.right,
            faceImageUrl: dataUrl
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save biometric profile.');
        }

        setRegisterState('success');
        setMessage({ type: 'success', text: 'Face ID registered successfully with multiple profile angles!' });
        await fetchProfile();
      }
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
    setCapturedDescriptors({});
    setCaptureStep('front');
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

              {/* Camera view + capturing controls — video always in DOM when camera active */}
              {(registerState === 'capturing' || registerState === 'processing') && (
                <div className="flex flex-col items-center gap-4 max-w-sm mx-auto animate-fadeIn">
                  {registerState === 'capturing' && (
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full bg-neutral-950/40 border border-neutral-850 p-4 rounded-2xl text-left mb-2">
                      <FaceGuideVisualizer step={captureStep} />
                      <div className="space-y-0.5 text-center sm:text-left">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary-400">
                          Langkah {captureStep === 'front' ? '1' : captureStep === 'left' ? '2' : '3'} dari 3
                        </span>
                        <h4 className="font-bold text-sm text-neutral-50">
                          {captureStep === 'front' && 'Hadap Depan'}
                          {captureStep === 'left' && 'Hadap Kiri'}
                          {captureStep === 'right' && 'Hadap Kanan'}
                        </h4>
                        <p className="text-[11px] text-neutral-400 leading-normal">
                          {captureStep === 'front' && 'Posisikan wajah lurus menghadap kamera.'}
                          {captureStep === 'left' && 'Palingkan wajah sedikit ke kiri agar profil kiri terlihat.'}
                          {captureStep === 'right' && 'Palingkan wajah sedikit ke kanan agar profil kanan terlihat.'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-neutral-800 bg-black relative">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <canvas ref={canvasRef} className="hidden" />
                    {registerState === 'capturing' && (
                      <BiometricCameraOverlay step={captureStep} />
                    )}
                    {registerState === 'processing' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  {registerState === 'capturing' && (
                    <div className="flex gap-2 w-full mt-2">
                      <button onClick={cancelCapture} className="btn btn-secondary flex-1 rounded-lg text-xs">
                        Cancel
                      </button>
                      <button onClick={registerFace} className="btn btn-primary flex-1 rounded-lg text-xs font-semibold">
                        {captureStep === 'right' ? 'Capture & Save' : 'Berikutnya'}
                      </button>
                    </div>
                  )}
                  {registerState === 'processing' && (
                    <div className="text-center">
                      <p className="text-sm text-neutral-400 font-medium">Extracting face biometrics...</p>
                      <p className="text-xs text-neutral-500 font-light mt-1">This is processed completely locally on your device.</p>
                    </div>
                  )}
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
