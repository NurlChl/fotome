'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { ShieldAlert, Users, Eye, X, Fingerprint, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

interface ClaimEntry {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    faceDescriptor?: number[];
    faceImageUrl?: string;
  };
  eventId?: {
    _id: string;
    title: string;
    slug: string;
  };
  photoId?: {
    _id: string;
    thumbnailUrl: string;
    watermarkedUrl: string;
  };
  selfieUrl?: string;
  selfieDescriptor?: number[];
  ipAddress: string;
  isMatched: boolean;
  type?: 'biometric' | 'override' | 'false_positive';
  createdAt: string;
}

export default function ManualClaimsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai-verified' | 'false-positive'>('manual');

  const canManageUsers = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.manageUsers;

  async function fetchClaims() {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/claims');
      const data = await res.json();
      if (res.ok) {
        // Store all claims without filtering (we'll filter by tab)
        setClaims(data.claims || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter claims based on active tab
  const getFilteredClaims = () => {
    if (activeTab === 'manual') {
      // Manual override claims (isMatched: false)
      return claims.filter(c => c.isMatched === false);
    } else if (activeTab === 'ai-verified') {
      // AI-verified claims (isMatched: true)
      return claims.filter(c => c.isMatched === true);
    } else if (activeTab === 'false-positive') {
      // False positive flags (type: 'false_positive')
      return claims.filter(c => c.type === 'false_positive');
    }
    return [];
  };

  const filteredClaims = getFilteredClaims();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !canManageUsers) {
      router.push('/dashboard');
      return;
    }

    if (canManageUsers) {
      fetchClaims();
    }
  }, [status, canManageUsers, router]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDistance = (desc1?: number[], desc2?: number[]) => {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return null;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      sum += Math.pow(desc1[i] - desc2[i], 2);
    }
    return Math.sqrt(sum);
  };

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
            <ShieldAlert className="w-6 h-6 text-primary-500" /> Klaim Manual & Audit AI
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Audit logs of users manually claiming event photos and logs of incorrect AI detections
          </p>
        </div>
        <button
          onClick={fetchClaims}
          className="btn btn-secondary btn-sm rounded-lg text-xs"
        >
          Refresh data
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Manual Claims</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'manual' ? 'bg-white/20' : 'bg-neutral-800'
            }`}>
              {claims.filter(c => c.isMatched === false).length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('ai-verified')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'ai-verified'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>AI-Verified Claims</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'ai-verified' ? 'bg-white/20' : 'bg-neutral-800'
            }`}>
              {claims.filter(c => c.isMatched === true).length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('false-positive')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'false-positive'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>False Positives</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'false-positive' ? 'bg-white/20' : 'bg-neutral-800'
            }`}>
              {claims.filter(c => c.type === 'false_positive').length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Claims Table List */}
        <div className="xl:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 border-b border-neutral-900 pb-4">
            <h2 className="text-lg font-bold text-neutral-50">
              {activeTab === 'manual' && 'Manual Claim Logs'}
              {activeTab === 'ai-verified' && 'AI-Verified Claim Logs'}
              {activeTab === 'false-positive' && 'False Positive Flags'}
            </h2>
            <span className={`badge ${
              activeTab === 'manual' ? 'badge-primary' :
              activeTab === 'ai-verified' ? 'badge-success' :
              'badge-error'
            }`}>
              {filteredClaims.length} {activeTab === 'false-positive' ? 'flags' : 'claims'}
            </span>
          </div>

          {filteredClaims.length > 0 ? (
            <div className="overflow-x-auto border border-neutral-900 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                    <th className="px-6 py-4">Account</th>
                    <th className="px-6 py-4">Target Photo</th>
                    <th className="px-6 py-4">Selfie Verification</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredClaims.map((claim) => (
                    <tr 
                      key={claim._id} 
                      className={`hover:bg-neutral-900/10 text-neutral-300 transition ${
                        selectedClaim?._id === claim._id ? 'bg-primary-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        {claim.userId ? (
                          <>
                            <div className="font-semibold text-neutral-50">{claim.userId.name}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{claim.userId.email}</div>
                          </>
                        ) : (
                          <span className="text-neutral-500 text-xs italic">Unknown User</span>
                        )}
                        <div className="text-[10px] text-neutral-500 mt-1 font-mono">{formatDate(claim.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {claim.photoId ? (
                          <div 
                            className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 relative group cursor-pointer"
                            onClick={() => setPreviewPhotoUrl(claim.photoId?.watermarkedUrl || claim.photoId?.thumbnailUrl || null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={claim.photoId.thumbnailUrl || claim.photoId.watermarkedUrl} 
                              alt="Target Photo" 
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-xs italic">Deleted Photo</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {claim.selfieUrl ? (
                          <div 
                            className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-850 bg-neutral-950 relative group cursor-pointer"
                            onClick={() => setPreviewPhotoUrl(claim.selfieUrl || null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={claim.selfieUrl} 
                              alt="Verification Selfie" 
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-xs italic">No Selfie</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                        {claim.ipAddress}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedClaim(claim)}
                          className="btn btn-secondary btn-xs rounded-lg text-xs"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-500 text-sm">
              {activeTab === 'manual' && 'No manual claim logs found.'}
              {activeTab === 'ai-verified' && 'No AI-verified claim logs found.'}
              {activeTab === 'false-positive' && 'No false positive flags found.'}
            </div>
          )}
        </div>

        {/* Claim Details Sidebar Panel */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 h-fit space-y-6">
          <div className="border-b border-neutral-900 pb-4">
            <h2 className="text-lg font-bold text-neutral-50 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary-400" /> Biometric Analysis
            </h2>
            <p className="text-xs text-neutral-400 mt-1">Select a claim on the left to analyze face details</p>
          </div>

          {selectedClaim ? (
            <div className="space-y-6 animate-fadeIn">
              
              {/* User Account Info */}
              <div className="bg-neutral-950/40 p-4 border border-neutral-850 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Account Information</span>
                <div className="text-sm font-semibold text-neutral-100">{selectedClaim.userId?.name || 'Unknown User'}</div>
                <div className="text-xs text-neutral-400">{selectedClaim.userId?.email || 'No email associated'}</div>
                <div className="text-xs text-neutral-500 font-mono">IP: {selectedClaim.ipAddress}</div>
              </div>

              {/* Side by side preview */}
              <div className={`grid ${selectedClaim.userId?.faceImageUrl ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Target Photo</span>
                  {selectedClaim.photoId ? (
                    <div 
                      className="w-full aspect-square rounded-xl overflow-hidden border border-neutral-850 bg-neutral-950 relative group cursor-pointer"
                      onClick={() => setPreviewPhotoUrl(selectedClaim.photoId?.watermarkedUrl || selectedClaim.photoId?.thumbnailUrl || null)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={selectedClaim.photoId.thumbnailUrl || selectedClaim.photoId.watermarkedUrl} 
                        alt="Target Photo" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-neutral-950 flex items-center justify-center border border-neutral-850">
                      <span className="text-neutral-500 text-xs italic">Deleted</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Selfie Verification</span>
                  {selectedClaim.selfieUrl ? (
                    <div 
                      className="w-full aspect-square rounded-xl overflow-hidden border border-neutral-850 bg-neutral-950 relative group cursor-pointer"
                      onClick={() => setPreviewPhotoUrl(selectedClaim.selfieUrl || null)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={selectedClaim.selfieUrl} 
                        alt="Selfie" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-neutral-950 flex items-center justify-center border border-neutral-850">
                      <span className="text-neutral-500 text-xs italic">No Selfie</span>
                    </div>
                  )}
                </div>

                {selectedClaim.userId?.faceImageUrl && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Registered Face</span>
                    <div 
                      className="w-full aspect-square rounded-xl overflow-hidden border border-neutral-850 bg-neutral-950 relative group cursor-pointer"
                      onClick={() => setPreviewPhotoUrl(selectedClaim.userId?.faceImageUrl || null)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={selectedClaim.userId.faceImageUrl} 
                        alt="Registered Face" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Registered vs Selfie face descriptors */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className="text-neutral-400">Registered Face ID:</span>
                    {selectedClaim.userId?.faceDescriptor ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Registered (128-d)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Not Registered
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className="text-neutral-400">Selfie Descriptor:</span>
                    {selectedClaim.selfieDescriptor ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Extracted (128-d)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Not Extracted
                      </span>
                    )}
                  </div>
                </div>

                {/* Similarity distance calculation */}
                <div className="border-t border-neutral-850 pt-4 mt-2">
                  <span className="block text-[10px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Distance Match Rating</span>
                  
                  {selectedClaim.userId?.faceDescriptor && selectedClaim.selfieDescriptor ? (
                    (() => {
                      const dist = calculateDistance(selectedClaim.userId.faceDescriptor, selectedClaim.selfieDescriptor);
                      if (dist === null) return null;
                      
                      let statusText = '';
                      let badgeColor = '';
                      let alertIcon = null;

                      if (dist < 0.60) {
                        statusText = 'Wajah Cocok Sempurna (Identik)';
                        badgeColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                        alertIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
                      } else if (dist <= 0.65) {
                        statusText = 'Cocok dalam batas toleransi PDP (Kemiripan Cukup)';
                        badgeColor = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                        alertIcon = <Info className="w-4 h-4 text-amber-400 shrink-0" />;
                      } else {
                        statusText = 'Wajah Tidak Cocok (Beda Orang / Deteksi Gagal)';
                        badgeColor = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                        alertIcon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
                      }

                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold font-display text-neutral-50">
                              {dist.toFixed(4)}
                            </span>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-bold ${badgeColor}`}>
                              {dist <= 0.65 ? 'Match' : 'Mismatch'}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-neutral-950/50 border border-neutral-900 rounded-xl text-xs text-neutral-300">
                            {alertIcon}
                            <span>{statusText}</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-3 bg-neutral-950/50 border border-neutral-900 rounded-xl text-xs text-neutral-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Cannot compute Euclidean similarity: Registered Face ID or selfie biometrics are unavailable.
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-neutral-500 text-sm">
              Please click "Details" on a manual claim log entry to run face descriptor checks.
            </div>
          )}
        </div>

      </div>

      {/* Lightbox / Overlay Preview Modal */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 p-3 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-full transition duration-150 border border-neutral-800"
            onClick={() => setPreviewPhotoUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div 
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-neutral-850 shadow-2xl bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhotoUrl}
              alt="Photo Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
