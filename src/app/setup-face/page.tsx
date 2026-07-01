'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Loader2, CheckCircle2, ArrowRight, ScanFace, X } from 'lucide-react';
import { getFaceDescriptor } from '@/lib/faceDetector';

type RegisterState = 'idle' | 'starting' | 'capturing' | 'processing' | 'success' | 'error';

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
          <mask id="biometric-mask">
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
        <rect width="400" height="300" fill="black" fillOpacity="0.45" mask="url(#biometric-mask)" />

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

function SetupFaceContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  const [registerState, setRegisterState] = useState<RegisterState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [captureStep, setCaptureStep] = useState<'front' | 'left' | 'right'>('front');
  const [capturedDescriptors, setCapturedDescriptors] = useState<{
    front?: number[];
    left?: number[];
    right?: number[];
  }>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setRegisterState('starting');
    setErrorMessage('');
    setCapturedDescriptors({});
    setCaptureStep('front');

    try {
      // Stop any previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRegisterState('capturing');
    } catch (err) {
      console.error('Webcam access error:', err);
      setErrorMessage('Tidak dapat mengakses kamera. Silakan periksa izin kamera browser Anda, lalu coba kembali.');
      setRegisterState('error');
    }
  }, []);

  // KEY FIX: Whenever register state becomes 'capturing' (including after processing),
  // re-attach the still-running stream to the video element.
  useEffect(() => {
    if (registerState === 'capturing' && streamRef.current && videoRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(console.error);
      }
    }
  }, [registerState]);

  // Auto-start camera on mount once authenticated
  const hasStartedCamera = useRef(false);

  useEffect(() => {
    if (status === 'authenticated' && !hasStartedCamera.current) {
      hasStartedCamera.current = true;
      const t = setTimeout(() => startCamera(), 600);
      return () => clearTimeout(t);
    }
  }, [status, startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Validate dimensions BEFORE changing state (video still in DOM and playing)
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setErrorMessage('Kamera belum siap. Tunggu sebentar lalu coba kembali.');
      setRegisterState('error');
      return;
    }

    // Draw frame to canvas while video is still visible and active
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Now switch to processing — video stays in DOM (just hidden via CSS)
    setRegisterState('processing');

    try {
      const descriptor = await getFaceDescriptor(canvas);
      if (!descriptor) {
        throw new Error('Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan posisikan wajah di dalam lingkaran.');
      }

      const nextDescriptors = { ...capturedDescriptors, [captureStep]: descriptor };
      setCapturedDescriptors(nextDescriptors);

      if (captureStep === 'front') {
        setCaptureStep('left');
        // State goes back to 'capturing' — useEffect above will re-attach stream if needed
        setRegisterState('capturing');
      } else if (captureStep === 'left') {
        setCaptureStep('right');
        setRegisterState('capturing');
      } else {
        // All three captured — stop camera and save
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        stopCamera();

        const res = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faceDescriptor: nextDescriptors.front,
            faceDescriptorLeft: nextDescriptors.left,
            faceDescriptorRight: nextDescriptors.right,
            faceImageUrl: dataUrl,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data wajah.');

        setRegisterState('success');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[SetupFace] captureFace error:', error);
      setErrorMessage(error.message || 'Gagal memproses wajah. Silakan coba kembali.');
      setRegisterState('error');
    }
  }, [captureStep, capturedDescriptors, stopCamera]);

  const handleSkip = useCallback(() => {
    stopCamera();
    router.push(redirectTo);
  }, [stopCamera, router, redirectTo]);

  const handleContinue = useCallback(() => {
    router.push(redirectTo);
  }, [router, redirectTo]);

  const isCameraVisible = registerState === 'capturing' || registerState === 'processing';

  const stepNumber = captureStep === 'front' ? 1 : captureStep === 'left' ? 2 : 3;
  const stepLabel = captureStep === 'front' ? 'Hadap Depan' : captureStep === 'left' ? 'Hadap Kiri' : 'Hadap Kanan';
  const stepDesc =
    captureStep === 'front'
      ? 'Posisikan wajah lurus menghadap kamera.'
      : captureStep === 'left'
      ? 'Palingkan wajah sedikit ke kiri agar profil kiri terlihat.'
      : 'Palingkan wajah sedikit ke kanan agar profil kanan terlihat.';

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center mb-5">
            <ScanFace className="w-7 h-7 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Daftarkan Face ID Anda</h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-sm mx-auto">
            Kami menggunakan AI face recognition agar Anda bisa menemukan foto diri Anda secara otomatis di setiap event.
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl shadow-primary-500/5">

          {/* ── VIDEO ELEMENT: always in DOM to avoid srcObject loss on remount ── */}
          {/* Hidden via CSS when not capturing/processing */}
          <div className={isCameraVisible ? 'block' : 'hidden'}>
            {/* Step indicator — only show during capturing, not processing */}
            {registerState === 'capturing' && (
              <div className="flex flex-col items-center gap-4 animate-fadeIn">
                <div className="flex items-center gap-2 w-full justify-center mb-1">
                  {(['front', 'left', 'right'] as const).map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                        capturedDescriptors[step]
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : captureStep === step
                          ? 'bg-primary-500/20 border-primary-500/40 text-primary-300 ring-2 ring-primary-500/30'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                      }`}>
                        {capturedDescriptors[step] ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      {i < 2 && <div className={`h-px w-8 ${capturedDescriptors[step] ? 'bg-emerald-500/40' : 'bg-neutral-800'}`} />}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full bg-neutral-950/40 border border-neutral-850 p-4 rounded-2xl text-left mt-2">
                  <FaceGuideVisualizer step={captureStep} />
                  <div className="space-y-0.5 text-center sm:text-left">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary-400">
                      Langkah {stepNumber} dari 3
                    </span>
                    <h3 className="font-bold text-sm text-neutral-50">{stepLabel}</h3>
                    <p className="text-[11px] text-neutral-400 leading-normal">{stepDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {registerState === 'processing' && (
              <div className="flex flex-col items-center gap-2 mb-4 animate-fadeIn">
                <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />
                <p className="text-sm text-neutral-300 font-medium">Memproses wajah...</p>
                <p className="text-xs text-neutral-500">Analisis dilakukan di perangkat Anda.</p>
              </div>
            )}

            {/* Camera view — always rendered in DOM when camera is active */}
            <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-neutral-800 bg-black relative mt-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Hidden canvas for frame capture */}
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

            {/* Buttons */}
            {registerState === 'capturing' && (
              <div className="flex gap-2 w-full mt-4">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Lewati
                </button>
                <button
                  onClick={captureFace}
                  className="flex-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {captureStep === 'right' ? 'Capture & Simpan' : 'Ambil Foto & Lanjut'}
                </button>
              </div>
            )}
          </div>

          {/* ── IDLE / STARTING ── */}
          {(registerState === 'idle' || registerState === 'starting') && (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div className="w-full aspect-video rounded-xl border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
              <p className="text-sm text-neutral-400">Membuka kamera...</p>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {registerState === 'success' && (
            <div className="flex flex-col items-center text-center gap-5 py-4 animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-50">Face ID Berhasil Didaftarkan!</h3>
                <p className="text-sm text-neutral-400 mt-2">
                  AI face recognition Anda sudah aktif. Sekarang Anda dapat menemukan foto diri Anda secara otomatis di setiap event.
                </p>
              </div>
              <button
                onClick={handleContinue}
                className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                Mulai Jelajahi Event <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {registerState === 'error' && (
            <div className="flex flex-col items-center text-center gap-5 py-4 animate-fadeIn">
              <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl text-sm text-rose-400">
                {errorMessage}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Lewati
                </button>
                <button
                  onClick={startCamera}
                  className="flex-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Skip hint shown during non-terminal states */}
          {registerState !== 'success' && registerState !== 'error' && registerState !== 'capturing' && (
            <p className="text-center text-[11px] text-neutral-600 mt-4">
              Anda dapat mendaftar Face ID kapan saja di halaman{' '}
              <button
                onClick={handleSkip}
                className="text-neutral-400 underline underline-offset-2 hover:text-neutral-300"
              >
                Pengaturan
              </button>
            </p>
          )}
        </div>

        {/* Bottom info */}
        {session?.user?.name && (
          <p className="text-center text-xs text-neutral-600 mt-5">
            Login sebagai <span className="text-neutral-400">{session.user.name}</span>
          </p>
        )}

        <p className="text-center text-[10px] text-neutral-700 mt-3 flex items-center justify-center gap-1">
          🔒 Data selfie diproses secara lokal di browser Anda untuk perlindungan privasi.
        </p>
      </div>
    </div>
  );
}

export default function SetupFacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <SetupFaceContent />
    </Suspense>
  );
}
