import React, { useEffect, useState } from 'react';
import { ScheduledPostItem } from '../types';
import {
  Clock,
  Play,
  Trash2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

export const PublishingHistoryView: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduledPostItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [zernioPosts, setZernioPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        safeFetchJson('/api/schedules'),
        safeFetchJson('/api/social/workflow-history'),
      ]);
      if (sRes.data?.success) setSchedules(sRes.data.schedules || []);
      if (hRes.data?.success) setHistory(hRes.data.history || []);
      const zPosts = hRes.data?.zernioPosts || sRes.data?.zernioPosts || [];
      setZernioPosts(Array.isArray(zPosts) ? zPosts : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleDeleteSchedule = async (id: string) => {
    await safeFetchJson(`/api/schedules/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    setActionMsg(null);
    try {
      const res = await safeFetchJson(`/api/schedules/${id}/run-now`, { method: 'POST' });
      if (res.data?.success) {
        setActionMsg('Scheduled post executed cleanly. Review publishing status below.');
      } else {
        setActionMsg(res.error || res.data?.error || 'Execution error.');
      }
      await fetchAll();
    } finally {
      setRunningId(null);
    }
  };

  const handleZernioRetry = async (postId: string) => {
    setRunningId(postId);
    setActionMsg(null);
    try {
      const res = await safeFetchJson(`/api/zernio/posts/${postId}/retry`, { method: 'POST' });
      if (res.ok && res.data?.success) {
        setActionMsg('Retried failed Zernio platform deliveries.');
      } else {
        setActionMsg(res.error || res.data?.error || 'Retry failed.');
      }
      await fetchAll();
    } finally {
      setRunningId(null);
    }
  };

  const handleZernioPublishNow = async (postId: string) => {
    setRunningId(postId);
    setActionMsg(null);
    try {
      const res = await safeFetchJson(`/api/zernio/posts/${postId}/publish-now`, { method: 'POST' });
      if (res.ok && res.data?.success) {
        setActionMsg('Scheduled Zernio post triggered for immediate publishing.');
      } else {
        setActionMsg(res.error || res.data?.error || 'Could not trigger immediate publish.');
      }
      await fetchAll();
    } finally {
      setRunningId(null);
    }
  };

  const handleZernioDelete = async (postId: string) => {
    setActionMsg(null);
    const res = await safeFetchJson(`/api/zernio/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) {
      setActionMsg(res.error || res.data?.error || 'Could not remove Zernio post.');
    }
    await fetchAll();
  };

  const zernioScheduled = zernioPosts.filter((p) => p.status === 'scheduled' || p.status === 'pending');
  const zernioExecuted = zernioPosts.filter((p) => p.status !== 'scheduled' && p.status !== 'pending');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">
            Publishing History &amp; Scheduled Queue
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Live Zernio post statuses, scheduled queue, direct post URLs, and safe retry controls across Instagram, Facebook, and LinkedIn.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Refresh</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200">
          {actionMsg}
        </div>
      )}

      {/* Scheduled Queue (Zernio + Local) */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scheduled Queue ({zernioScheduled.length + schedules.length})
        </div>

        {zernioScheduled.length === 0 && schedules.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 text-xs text-slate-500">
            No scheduled future posts in queue. Use &ldquo;Publish &amp; Schedule&rdquo; on any poster to queue a festival or corporate post.
          </div>
        ) : (
          <div className="bg-[#111827] border border-slate-800 rounded-xl divide-y divide-slate-800">
            {zernioScheduled.map((zp) => (
              <div key={zp._id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {zp.title || zp.content?.slice(0, 60) || 'Scheduled Post'}
                    </span>
                    <span className="text-[11px] font-mono-tabular text-amber-400 uppercase">
                      · {zp.status} (Zernio)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono-tabular mt-1 flex items-center gap-2 flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Scheduled: {(zp.scheduledFor || '').replace('T', ' ').slice(0, 16)}</span>
                    <span>
                      · Platforms: {(zp.platforms || []).map((pl: any) => pl.platform).join(', ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleZernioPublishNow(zp._id)}
                    disabled={runningId === zp._id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>{runningId === zp._id ? 'Publishing...' : 'Publish Now'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZernioDelete(zp._id)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                    title="Cancel Schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {schedules.map((item) => (
              <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.topic}</span>
                    <span className="text-[11px] font-mono-tabular text-amber-400 uppercase">
                      · {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono-tabular mt-1 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Scheduled: {item.scheduledFor.replace('T', ' ').slice(0, 16)}</span>
                    <span>· Platforms: {item.platforms.join(', ')}</span>
                  </div>
                  {item.lastError && <div className="text-xs text-rose-400 mt-1">{item.lastError}</div>}
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => handleRunNow(item.id)}
                      disabled={runningId === item.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                    >
                      <Play className="w-3 h-3" />
                      <span>{runningId === item.id ? 'Publishing...' : 'Publish Now'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteSchedule(item.id)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                    title="Remove Schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Zernio Executed Posts (with Retry for failed / partial) */}
      {zernioExecuted.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Zernio Live Post History ({zernioExecuted.length})
          </div>
          <div className="space-y-3">
            {zernioExecuted.map((zp) => (
              <div key={zp._id} className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {zp.title || zp.content?.slice(0, 80) || 'Zernio Post'}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-slate-500">
                      {(zp.createdAt || '').slice(0, 19).replace('T', ' ')} · Status: {zp.status?.toUpperCase()} · ID: {zp._id}
                    </div>
                  </div>
                  {(zp.status === 'failed' || zp.status === 'partial') && (
                    <button
                      type="button"
                      onClick={() => handleZernioRetry(zp._id)}
                      disabled={runningId === zp._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{runningId === zp._id ? 'Retrying...' : 'Safe Retry Failed'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {(zp.platforms || []).map((pl: any, idx: number) => (
                    <div key={`${zp._id}_${pl.platform}_${idx}`} className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 capitalize">{pl.platform}</span>
                        <span
                          className={`font-mono-tabular font-semibold uppercase ${
                            pl.status === 'published'
                              ? 'text-emerald-400'
                              : pl.status === 'failed'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {pl.status}
                        </span>
                      </div>
                      {pl.platformPostUrl && (
                        <a
                          href={pl.platformPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-amber-400 hover:underline font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>View Live Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {(pl.error || pl.errorMessage) && (
                        <div className="text-[11px] text-rose-300 leading-snug flex items-start gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                          <span>{pl.error || pl.errorMessage}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Audit Reports */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Executed Publishing Audit Reports ({history.length})
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 text-xs text-slate-500">
            No social posts have been dispatched yet.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((rep) => (
              <div key={rep.id} className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{rep.topic}</div>
                    <div className="text-[11px] font-mono-tabular text-slate-500">
                      {rep.timestamp?.slice(0, 19).replace('T', ' ')} · {rep.posterGeneration?.detail}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {(['instagram', 'facebook', 'linkedin'] as const).map((plat) => {
                    const res = rep.platforms?.[plat];
                    if (!res) return null;
                    return (
                      <div key={plat} className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 capitalize">{plat}</span>
                          <span
                            className={`font-mono-tabular font-semibold ${
                              res.status === 'SUCCESS'
                                ? 'text-emerald-400'
                                : res.status === 'FAILED'
                                ? 'text-rose-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>

                        {res.status === 'SUCCESS' && res.postUrl && (
                          <a
                            href={res.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:underline font-medium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>View Live Post</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {res.status === 'FAILED' && (
                          <div className="text-[11px] text-rose-300 leading-snug flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                            <span>{res.errorMessage || res.reason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
