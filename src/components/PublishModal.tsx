import React, { useEffect, useRef, useState } from 'react';
import { ExportDimension, PosterConfig } from '../types';
import { renderPosterToImage } from '../utils/posterRenderer';
import {
  X,
  Send,
  Clock,
  Instagram,
  Facebook,
  Linkedin,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

interface PublishModalProps {
  poster: PosterConfig;
  isOpen: boolean;
  initialMode?: 'now' | 'schedule';
  initialScheduleDate?: string;
  initialCaptions?: { instagram: string; facebook: string; linkedin: string };
  initialSelectedPlatforms?: Array<'instagram' | 'facebook' | 'linkedin'>;
  onClose: () => void;
  onGoToConnections: () => void;
}

type PlatformKey = 'instagram' | 'facebook' | 'linkedin';
type RenderedPlatformMap = Partial<Record<PlatformKey, string>>;

export const PublishModal: React.FC<PublishModalProps> = ({
  poster,
  isOpen,
  initialMode = 'now',
  initialScheduleDate,
  initialCaptions,
  initialSelectedPlatforms,
  onClose,
  onGoToConnections,
}) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([
    'instagram',
    'facebook',
  ]);
  const [mode, setMode] = useState<'now' | 'schedule'>(initialMode);
  const [scheduleDatetime, setScheduleDatetime] = useState<string>(
    initialScheduleDate ? `${initialScheduleDate}T09:00` : ''
  );
  const [explicitApprove, setExplicitApprove] = useState(false);
  const [approvalHighlight, setApprovalHighlight] = useState(false);

  const [igCaption, setIgCaption] = useState('');
  const [fbCaption, setFbCaption] = useState('');
  const [liCaption, setLiCaption] = useState('');

  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [renderedUrls, setRenderedUrls] = useState<RenderedPlatformMap>({});
  const [isRendering, setIsRendering] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string>('Processing...');
  const [report, setReport] = useState<any>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canRetrySubmit, setCanRetrySubmit] = useState(false);

  const submittingRef = useRef(false);
  const pendingRequestIdRef = useRef<string | null>(null);
  const renderPromiseRef = useRef<Promise<RenderedPlatformMap> | null>(null);
  const userToggledPlatformRef = useRef(false);
  const scheduleSectionRef = useRef<HTMLDivElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const renderAllPlatformPreviews = (): Promise<RenderedPlatformMap> => {
    const p = (async () => {
      setIsRendering(true);
      try {
        const dims: Record<PlatformKey, ExportDimension> = {
          instagram: poster.aspectRatio === '1:1' ? '1080x1080' : '1080x1350',
          facebook: '1200x630',
          linkedin: '1200x1350',
        };
        const [igAsset, fbAsset, liAsset] = await Promise.all([
          renderPosterToImage(poster, { format: 'image/jpeg', quality: 0.92, resolution: dims.instagram }),
          renderPosterToImage(poster, { format: 'image/jpeg', quality: 0.92, resolution: dims.facebook }),
          renderPosterToImage(poster, { format: 'image/jpeg', quality: 0.92, resolution: dims.linkedin }),
        ]);
        const nextMap: RenderedPlatformMap = {
          instagram: igAsset.dataUrl,
          facebook: fbAsset.dataUrl,
          linkedin: liAsset.dataUrl,
        };
        setRenderedUrls(nextMap);
        return nextMap;
      } catch (err: any) {
        const msg = err?.message || 'Could not render multi-platform poster exports.';
        setErrorMsg(msg);
        return {};
      } finally {
        setIsRendering(false);
        renderPromiseRef.current = null;
      }
    })();
    renderPromiseRef.current = p;
    return p;
  };

  useEffect(() => {
    if (!isOpen) return;
    userToggledPlatformRef.current = Boolean(initialSelectedPlatforms && initialSelectedPlatforms.length > 0);
    setMode(initialMode);
    if (initialSelectedPlatforms && initialSelectedPlatforms.length > 0) {
      setSelectedPlatforms(initialSelectedPlatforms);
    }
    if (initialScheduleDate) {
      setScheduleDatetime(`${initialScheduleDate}T09:00`);
    } else {
      setScheduleDatetime('');
    }
    setReport(null);
    setScheduleSuccess(null);
    setErrorMsg(null);
    setCanRetrySubmit(false);
    pendingRequestIdRef.current = null;
    setExplicitApprove(false);
    setApprovalHighlight(false);
    setRenderedUrls({});

    if (initialCaptions) {
      setIgCaption(initialCaptions.instagram);
      setFbCaption(initialCaptions.facebook);
      setLiCaption(initialCaptions.linkedin);
    } else {
      const base = [poster.headline?.text, poster.subheading?.text].filter(Boolean).join(' — ') || poster.title || 'Poster Update';
      setIgCaption(base);
      setFbCaption(base);
      setLiCaption(base);
    }

    safeFetchJson('/api/social/status')
      .then((res) => {
        if (res.ok && res.data?.success && res.data?.status) {
          const st = res.data.status;
          setConnectionStatus(st);
          if (!userToggledPlatformRef.current) {
            const ready = (['instagram', 'facebook', 'linkedin'] as PlatformKey[]).filter(
              (p) => Boolean(st?.[p]?.connected)
            );
            if (ready.length > 0) {
              setSelectedPlatforms(ready);
            } else {
              setSelectedPlatforms(['instagram', 'facebook', 'linkedin']);
            }
          }
        }
      })
      .catch(() => {});

    renderAllPlatformPreviews();
  }, [isOpen, poster.id, poster.activeVariationIndex, initialMode, initialScheduleDate]);

  if (!isOpen) return null;

  const togglePlatform = (plat: PlatformKey) => {
    userToggledPlatformRef.current = true;
    pendingRequestIdRef.current = null;
    setCanRetrySubmit(false);
    setErrorMsg(null);
    setSelectedPlatforms((prev) =>
      prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
    );
  };

  const handleGenerateCaptions = async () => {
    setIsGeneratingCaptions(true);
    setErrorMsg(null);
    try {
      const res = await safeFetchJson('/api/social/generate-platform-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: poster.title || poster.headline.text,
          occasion: poster.occasion,
          headline: poster.headline.text,
          offer: poster.offerBadge.visible ? poster.offerBadge.text : '',
          language: poster.language || 'english',
        }),
      });
      const data = res.data;
      if (res.ok && data?.success) {
        setIgCaption(`${data.instagram.caption}\n\n${(data.instagram.hashtags || []).join(' ')}`.trim());
        setFbCaption(`${data.facebook.caption}\n\n${(data.facebook.hashtags || []).join(' ')}`.trim());
        setLiCaption(`${data.linkedin.caption}\n\n${(data.linkedin.hashtags || []).join(' ')}`.trim());
      } else {
        setErrorMsg(res.error || data?.error || 'Could not generate captions.');
      }
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const handleExecute = async (isRetryAttempt = false) => {
    if (submittingRef.current) return;

    setErrorMsg(null);
    setScheduleSuccess(null);
    setCanRetrySubmit(false);
    setApprovalHighlight(false);

    if (selectedPlatforms.length === 0) {
      setErrorMsg('Select at least one social media platform above before posting.');
      return;
    }

    const captions: Record<PlatformKey, string> = {
      instagram: igCaption.trim(),
      facebook: fbCaption.trim(),
      linkedin: liCaption.trim(),
    };

    for (const plat of selectedPlatforms) {
      if (!captions[plat]) {
        setErrorMsg(`Please enter a caption for ${plat.charAt(0).toUpperCase() + plat.slice(1)} before posting.`);
        return;
      }
    }

    if (mode === 'schedule') {
      if (!scheduleDatetime) {
        setErrorMsg('Please select a scheduled date and time.');
        scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const parsedMs = Date.parse(scheduleDatetime);
      if (Number.isNaN(parsedMs) || parsedMs <= Date.now()) {
        setErrorMsg('Scheduled date and time must be in the future.');
        scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!explicitApprove) {
        setApprovalHighlight(true);
        setErrorMsg('Please tick the explicit approval box above before clicking Approve & Schedule Auto-Post.');
        scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // Reuse pending clientRequestId on retries so server-side idempotency prevents duplicate posts
    if (!isRetryAttempt || !pendingRequestIdRef.current) {
      pendingRequestIdRef.current = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
    const clientRequestId = pendingRequestIdRef.current;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Refresh live connection status if not yet loaded
      let latestStatus = connectionStatus;
      if (!latestStatus) {
        setSubmitStage('Checking connected accounts...');
        const stRes = await safeFetchJson('/api/social/status');
        if (stRes.ok && stRes.data?.success) {
          latestStatus = stRes.data.status;
          setConnectionStatus(latestStatus);
        }
      }

      if (latestStatus) {
        const anyConnectedSelected = selectedPlatforms.some((p) => Boolean(latestStatus?.[p]?.connected));
        if (!anyConnectedSelected) {
          throw new Error(
            'None of the selected social accounts are connected yet. Open Social Connections to authorize at least one account.'
          );
        }
      }

      // Ensure poster images are rendered cleanly (wait for active render or render on-demand)
      let assets = renderedUrls;
      const missingRender = selectedPlatforms.some((p) => !assets[p]);
      if (missingRender) {
        setSubmitStage('Preparing poster artwork...');
        assets = renderPromiseRef.current
          ? await renderPromiseRef.current
          : await renderAllPlatformPreviews();
      }

      const primaryAsset = assets.instagram || assets.facebook || assets.linkedin;
      if (!primaryAsset) {
        throw new Error('Poster artwork could not be rendered. Please try again or re-open the modal.');
      }

      const topicTitle = (poster.headline?.text || poster.title || 'PostPilot Campaign').trim();

      if (mode === 'schedule') {
        setSubmitStage(isRetryAttempt ? 'Retrying schedule safely...' : 'Scheduling auto-post via Zernio...');
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const res = await safeFetchJson('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientRequestId,
            topic: topicTitle,
            category: poster.category || 'festival',
            occasionSlug: poster.occasion,
            scheduledFor: new Date(scheduleDatetime).toISOString(),
            timezone: browserTz,
            platforms: selectedPlatforms,
            captions,
            platformDataUrls: assets,
            profileId: latestStatus?.zernio?.activeProfile?._id,
            autoPublishApproved: true,
          }),
        });
        const data = res.data;
        if (data?.report) setReport(data.report);
        if (!res.ok || !data?.success) {
          setCanRetrySubmit(true);
          throw new Error(res.error || data?.error || data?.message || 'Could not schedule post.');
        }

        const scheduledChannels = selectedPlatforms.filter(
          (p) => data.report?.platforms?.[p]?.status === 'SUCCESS'
        );
        if (scheduledChannels.length === 0) {
          setCanRetrySubmit(true);
          throw new Error('Post was not scheduled on any selected platform. Check account connections and retry.');
        }

        pendingRequestIdRef.current = null;
        const zId = data.zernioPost?._id ? ` (ID: ${data.zernioPost._id})` : '';
        setScheduleSuccess(
          `Approved & scheduled on ${scheduledChannels.join(', ')} for ${scheduleDatetime.replace('T', ' ')} (${browserTz})${zId}.`
        );
      } else {
        setSubmitStage(isRetryAttempt ? 'Retrying publish safely...' : 'Uploading & publishing via Zernio...');
        const res = await safeFetchJson('/api/social/publish-workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientRequestId,
            topic: topicTitle,
            dataUrl: primaryAsset,
            platformDataUrls: assets,
            platforms: selectedPlatforms,
            captions,
            profileId: latestStatus?.zernio?.activeProfile?._id,
          }),
        });
        const data = res.data;
        if (data?.report) setReport(data.report);
        if (!res.ok || !data?.success) {
          setCanRetrySubmit(true);
          throw new Error(res.error || data?.message || data?.error || 'Publishing workflow failed.');
        }

        const publishedChannels = selectedPlatforms.filter(
          (p) => data.report?.platforms?.[p]?.status === 'SUCCESS'
        );
        if (publishedChannels.length === 0) {
          setCanRetrySubmit(true);
          throw new Error('Publishing did not succeed on any selected platform. Review the error details below.');
        }

        pendingRequestIdRef.current = null;
        setScheduleSuccess(
          `Published to ${publishedChannels.join(', ')}. Review direct links and status in the report below.`
        );
      }

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Operation failed.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0B0F19] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-white">
              Multi-Platform Social Publishing &amp; Advance Scheduler
            </h2>
            <p className="text-xs text-slate-400">
              Native aspect ratios prepared for Instagram (1080×1350), Facebook (1200×630), and LinkedIn (1200×1350).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-slate-800 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('now');
                  pendingRequestIdRef.current = null;
                  setCanRetrySubmit(false);
                  setErrorMsg(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                  mode === 'now' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('schedule');
                  pendingRequestIdRef.current = null;
                  setCanRetrySubmit(false);
                  setErrorMsg(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                  mode === 'schedule' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Schedule Advance Post</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleGenerateCaptions}
              disabled={isGeneratingCaptions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isGeneratingCaptions ? 'animate-spin' : ''}`} />
              <span>{isGeneratingCaptions ? 'Writing Captions...' : 'AI Write Platform Captions'}</span>
            </button>
          </div>

          {/* Platform Selection & Connection Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'instagram' as const,
                label: 'Instagram',
                dim: poster.aspectRatio === '1:1' ? '1080×1080' : '1080×1350',
                icon: <Instagram className="w-4 h-4 text-pink-400" />,
                connected: connectionStatus?.instagram?.connected,
                detail: connectionStatus?.instagram?.username ? `@${connectionStatus.instagram.username}` : 'Not linked',
              },
              {
                id: 'facebook' as const,
                label: 'Facebook',
                dim: '1200×630',
                icon: <Facebook className="w-4 h-4 text-sky-400" />,
                connected: connectionStatus?.facebook?.connected,
                detail: connectionStatus?.facebook?.pageName || 'Not linked',
              },
              {
                id: 'linkedin' as const,
                label: 'LinkedIn',
                dim: '1200×1350',
                icon: <Linkedin className="w-4 h-4 text-blue-400" />,
                connected: connectionStatus?.linkedin?.connected,
                detail: connectionStatus?.linkedin?.authorName || 'Not linked',
              },
            ].map((p) => {
              const checked = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    checked
                      ? 'bg-[#0B0F19] border-amber-500/70'
                      : 'bg-[#0B0F19]/50 border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-white">
                      {p.icon}
                      {p.label}
                    </span>
                    <span className="text-[10px] font-mono-tabular text-slate-400">{p.dim}</span>
                  </div>
                  <div className="text-[11px] mt-1.5 flex items-center justify-between">
                    <span className="text-slate-400 truncate">{p.detail}</span>
                    <span className={p.connected ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                      {p.connected ? 'Ready' : 'Setup Needed'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!connectionStatus?.instagram?.connected &&
            !connectionStatus?.facebook?.connected &&
            !connectionStatus?.linkedin?.connected && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                <span>Connect your Instagram, Facebook, or LinkedIn account in Social Connections to publish directly.</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToConnections();
                  }}
                  className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold shrink-0"
                >
                  Open Connections
                </button>
              </div>
            )}

          {/* Multi-Platform Rendered Aspect Preview */}
          <div>
            <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
              <span>Platform-Tailored Dimension Previews</span>
              {isRendering && <span className="font-mono-tabular text-amber-400">Rendering JPEGs...</span>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['instagram', 'facebook', 'linkedin'] as const).map((plat) => (
                <div key={plat} className="bg-[#0B0F19] border border-slate-800 rounded-lg p-2 text-center">
                  <div className="h-28 flex items-center justify-center overflow-hidden rounded bg-slate-950">
                    {renderedUrls[plat] ? (
                      <img
                        src={renderedUrls[plat]}
                        alt={`${plat} preview`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
                    )}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-400 mt-1.5 uppercase">{plat}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Captions */}
          <div className="space-y-3">
            {selectedPlatforms.includes('instagram') && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Instagram Caption &amp; Hashtags</label>
                <textarea
                  rows={2}
                  value={igCaption}
                  onChange={(e) => {
                    setIgCaption(e.target.value);
                    pendingRequestIdRef.current = null;
                  }}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
            {selectedPlatforms.includes('facebook') && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Facebook Page Caption</label>
                <textarea
                  rows={2}
                  value={fbCaption}
                  onChange={(e) => {
                    setFbCaption(e.target.value);
                    pendingRequestIdRef.current = null;
                  }}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
            {selectedPlatforms.includes('linkedin') && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">LinkedIn Professional Caption</label>
                <textarea
                  rows={2}
                  value={liCaption}
                  onChange={(e) => {
                    setLiCaption(e.target.value);
                    pendingRequestIdRef.current = null;
                  }}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Schedule Date & Explicit Approval */}
          {mode === 'schedule' && (
            <div
              ref={scheduleSectionRef}
              className={`p-4 rounded-xl bg-[#0B0F19] border space-y-3 transition ${
                approvalHighlight ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-slate-800'
              }`}
            >
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Scheduled Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={scheduleDatetime}
                  onChange={(e) => {
                    setScheduleDatetime(e.target.value);
                    pendingRequestIdRef.current = null;
                    setCanRetrySubmit(false);
                    setErrorMsg(null);
                  }}
                  className="bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono-tabular text-white"
                />
              </div>
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={explicitApprove}
                  onChange={(e) => {
                    setExplicitApprove(e.target.checked);
                    if (e.target.checked) {
                      setApprovalHighlight(false);
                      setErrorMsg(null);
                    }
                  }}
                  className="mt-0.5 w-4 h-4 accent-amber-500"
                />
                <span>
                  I explicitly approve PostPilot to automatically publish this artwork to the selected accounts at the scheduled date and time above.
                </span>
              </label>
            </div>
          )}

          {report && (
            <div ref={reportRef} className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-2.5 text-xs">
              <div className="font-bold text-white">Live API Publishing Report</div>
              {(['instagram', 'facebook', 'linkedin'] as const).map((plat) => {
                const res = report.platforms?.[plat];
                if (!res || res.status === 'SKIPPED') return null;
                return (
                  <div key={plat} className="py-1.5 border-t border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="capitalize font-semibold text-slate-200">
                        {plat}
                        {res.accountLabel ? (
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">({res.accountLabel})</span>
                        ) : null}
                      </span>
                      {res.status === 'SUCCESS' ? (
                        res.postUrl ? (
                          <a
                            href={res.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>Published</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{mode === 'schedule' ? 'Scheduled' : 'Published'}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-rose-400 text-right max-w-md">{res.errorMessage || res.reason}</span>
                      )}
                    </div>
                    {res.status === 'FAILED' && res.requiredAction && (
                      <div className="text-[11px] text-amber-300/90 pl-1">
                        Action: {res.requiredAction}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinned Error / Success Feedback Banner (always visible above footer) */}
        {(errorMsg || scheduleSuccess) && (
          <div className="px-5 pt-3 pb-1 border-t border-slate-800/80 bg-[#0D1322] space-y-2">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
                {canRetrySubmit && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleExecute(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-[11px] font-semibold text-rose-100 shrink-0 disabled:opacity-50 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry Request</span>
                  </button>
                )}
              </div>
            )}
            {scheduleSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-100 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{scheduleSuccess}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0B0F19] flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400">
            {isRendering
              ? 'Rendering platform poster JPEGs...'
              : `${selectedPlatforms.length} channel${selectedPlatforms.length === 1 ? '' : 's'} selected`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleExecute(false)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-60 transition"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : mode === 'schedule' ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {isSubmitting
                  ? submitStage
                  : mode === 'schedule'
                  ? 'Approve & Schedule Auto-Post'
                  : 'Publish to Selected Channels'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
