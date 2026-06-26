'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { Activity, ShieldAlert, CheckCircle2, ArrowLeft, Loader2, Database, Cloud, Eye, X } from 'lucide-react';
import Link from 'next/link';

interface LogEntry {
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
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export default function ActivityLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [source, setSource] = useState<string>('mongodb');
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const canManageLogs = session?.user?.role === 'superadmin' || !!session?.user?.permissions?.manageLogs;

  async function fetchLogs() {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/activity-logs');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setSource(data.source || 'mongodb');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !canManageLogs) {
      router.push('/dashboard');
      return;
    }

    if (canManageLogs) {
      fetchLogs();
    }
  }, [status, canManageLogs, router]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionDetails = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return {
          label: 'MASUK (LOGIN)',
          badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
          category: 'Autentikasi'
        };
      case 'REGISTER_FACE_ID':
        return {
          label: 'DAFTAR FACE ID',
          badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
          category: 'Biometrik'
        };
      case 'DELETE_BIOMETRICS':
        return {
          label: 'HAPUS FACE ID',
          badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
          category: 'Biometrik'
        };
      case 'CLAIM_PHOTO_MANUAL':
        return {
          label: 'KLAIM MANUAL',
          badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          category: 'Klaim Foto'
        };
      case 'FLAG_FALSE_POSITIVE':
        return {
          label: 'BUKAN FOTO SAYA',
          badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
          category: 'Salah Deteksi AI'
        };
      case 'DOWNLOAD_PHOTO':
        return {
          label: 'UNDUH FOTO',
          badgeClass: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
          category: 'Unduhan'
        };
      default:
        return {
          label: action,
          badgeClass: 'bg-neutral-900 text-neutral-400 border-neutral-800',
          category: 'Lainnya'
        };
    }
  };

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const filteredLogs = logs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false;
    return true;
  });

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
            <Activity className="w-6 h-6 text-primary-500" /> Activity Logs
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Audit system actions and administrative logs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="btn btn-secondary btn-sm rounded-lg flex items-center gap-1 text-xs"
          >
            Refresh Logs
          </button>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
            source === 'axiom' 
              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' 
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}>
            {source === 'axiom' ? (
              <>
                <Cloud className="w-3.5 h-3.5 animate-pulse" />
                <span>Axiom Cloud</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>MongoDB Cache</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Content */}
      <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 border-b border-neutral-900 pb-4">
          <h2 className="text-lg font-bold text-neutral-50">Audit Trail ({filteredLogs.length} events)</h2>
          <div className="w-full sm:w-64">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-300 text-sm focus:outline-none focus:border-primary-500 transition duration-200"
            >
              <option value="">Semua Aktivitas</option>
              {uniqueActions.map((act) => {
                const details = getActionDetails(act);
                return (
                  <option key={act} value={act}>
                    [{details.category}] {details.label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto border border-neutral-900 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Account</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Public IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {filteredLogs.map((log) => {
                  const details = getActionDetails(log.action);
                  return (
                    <tr key={log._id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap text-neutral-400">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {log.userId ? (
                          <>
                            <div className="font-semibold text-neutral-50">{log.userId.name}</div>
                            <div className="text-xs text-neutral-500">{log.userId.email}</div>
                          </>
                        ) : (
                          <span className="text-neutral-500 text-xs italic">Anonymous / System</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-0.5 font-bold uppercase rounded-full tracking-wider border ${details.badgeClass}`}>
                          {details.label}
                        </span>
                      </td>
                    <td className="px-6 py-4 text-xs font-medium text-neutral-200">
                      <div className="flex items-center gap-3">
                        {log.photoId?.thumbnailUrl && (
                          <div 
                            className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 relative group cursor-pointer shrink-0"
                            onClick={() => setPreviewPhotoUrl(log.photoId?.watermarkedUrl || log.photoId?.thumbnailUrl || null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={log.photoId.thumbnailUrl} 
                              alt="Log Photo" 
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}
                        <span>{log.details}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                      {log.ipAddress}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500 text-sm">
            No activity logs match the selected filter criteria.
          </div>
        )}
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
