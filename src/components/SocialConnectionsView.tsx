import React, { useEffect, useState } from 'react';
import {
  Instagram,
  Facebook,
  Linkedin,
  RefreshCw,
  Unlink,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Plus,
  Users,
} from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

interface SocialConnectionsViewProps {
  onStatusChange?: () => void;
}

interface VerificationState {
  ok: boolean;
  state: 'CONNECTED' | 'EXPIRED' | 'MISSING_PERMISSIONS' | 'NOT_CONNECTED' | 'ERROR';
  errorCode?: string;
  message: string;
  requiredAction?: string;
}

export const SocialConnectionsView: React.FC<SocialConnectionsViewProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [verifyingTarget, setVerifyingTarget] = useState<string | null>(null);
  const [verificationMap, setVerificationMap] = useState<
    Partial<Record<'instagram' | 'facebook' | 'linkedin', VerificationState>>
  >({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<{
    platform?: string;
    code?: string;
    reason?: string;
    message?: string;
    current_account_count?: number;
    free_tier_account_limit?: number;
    has_payment_method?: boolean;
    dashboard_url?: string;
    documentation_url?: string;
    teamAudit?: any;
  } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);
  const [igLoginMethod, setIgLoginMethod] = useState<'instagram_login' | 'facebook_login'>('instagram_login');

  // Workspace / User-specific Profile creator
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await safeFetchJson('/api/social/status');
      const data = res.data;
      if (res.ok && data?.success) {
        setStatus(data.status);
        onStatusChange?.();
      } else if (!res.ok && res.error) {
        setErrorBanner(res.error);
      }
    } catch {
      // keep existing status
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const handler = (event: MessageEvent) => {
      const isTrustedOrigin =
        event.origin === window.location.origin ||
        event.origin.endsWith('.run.app') ||
        event.origin.startsWith('http://localhost') ||
        event.origin.startsWith('http://127.0.0.1');
      if (!isTrustedOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setSuccessBanner(`${event.data.platform?.toUpperCase()}: ${event.data.message || 'Connected & verified.'}`);
        setErrorBanner(null);
        setPaymentError(null);
        loadStatus();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setErrorBanner(event.data.message || 'OAuth authorization failed.');
        loadStatus();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleStartOAuth = async (
    platform: 'instagram' | 'facebook' | 'linkedin',
    reconnectAccountId?: string | null
  ) => {
    setConnectingPlatform(platform);
    setErrorBanner(null);
    setPaymentError(null);
    setSuccessBanner(null);
    try {
      const qs = new URLSearchParams({ platform });
      const activeProfileId = status?.zernio?.activeProfile?._id;
      if (activeProfileId) qs.set('profileId', activeProfileId);
      if (reconnectAccountId) qs.set('reconnectAccountId', reconnectAccountId);
      if (platform === 'instagram') qs.set('loginMethod', igLoginMethod);

      const res = await safeFetchJson(`/api/auth/social/url?${qs.toString()}`);
      const data = res.data;
      if (!res.ok || !data?.url) {
        // Sync latest live status immediately so any newly connected or cross-profile accounts reflect truthfully
        await loadStatus();
        if (res.status === 402 || data?.error === 'PAYMENT_REQUIRED' || data?.paymentDetails) {
          setPaymentError({
            platform,
            ...(data?.paymentDetails || {}),
            code: data?.paymentDetails?.code || data?.error || 'PAYMENT_REQUIRED',
            message: data?.paymentDetails?.message || data?.message || res.error,
            teamAudit: data?.teamAudit || null,
          });
        } else {
          setErrorBanner(data?.message || res.error || 'Could not initiate OAuth connection.');
        }
        return;
      }

      const popup = window.open(data.url, `oauth_${platform}`, 'width=640,height=760');
      if (!popup) {
        setErrorBanner('Popup was blocked by your browser. Allow popups for this site and click Connect again.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to initiate OAuth flow.');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleVerify = async (platform: 'instagram' | 'facebook' | 'linkedin' | 'all') => {
    setVerifyingTarget(platform);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await safeFetchJson('/api/social/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = res.data;
      if (data?.status) {
        setStatus(data.status);
        onStatusChange?.();
      }
      if (data?.results) {
        setVerificationMap((prev) => ({ ...prev, ...data.results }));
        const checkedEntries = Object.entries(data.results) as Array<
          ['instagram' | 'facebook' | 'linkedin', VerificationState]
        >;
        if (platform !== 'all') {
          const single = data.results[platform] as VerificationState | undefined;
          if (single?.ok) {
            setSuccessBanner(single.message);
          } else if (single) {
            setErrorBanner(
              `${single.message}${single.requiredAction ? ` Next step: ${single.requiredAction}` : ''}`
            );
          }
        } else {
          const okCount = checkedEntries.filter(([, r]) => r.ok).length;
          if (okCount === checkedEntries.length) {
            setSuccessBanner('Zernio authentication and all 3 social channels verified live.');
          } else {
            const firstErr = checkedEntries.find(([, r]) => !r.ok)?.[1];
            setErrorBanner(
              `Verified ${okCount}/${checkedEntries.length} platforms connected. ${firstErr ? firstErr.message : ''}`
            );
          }
        }
      } else if (!res.ok) {
        setErrorBanner(data?.message || res.error || 'Verification failed.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Live verification request failed.');
    } finally {
      setVerifyingTarget(null);
    }
  };

  const handleDisconnect = async (platform: 'instagram' | 'facebook' | 'linkedin', accountId?: string | null) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const res = await safeFetchJson('/api/social/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        accountId: accountId || undefined,
        profileId: status?.zernio?.activeProfile?._id,
      }),
    });
    const data = res.data;
    if (res.ok && data?.success) {
      setStatus(data.status);
      setVerificationMap((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setSuccessBanner(`${platform.toUpperCase()} disconnected from workspace profile.`);
      onStatusChange?.();
    } else {
      setErrorBanner(data?.message || res.error || 'Could not disconnect platform.');
    }
  };

  const handleSelectTarget = async (platform: 'instagram' | 'facebook' | 'linkedin', targetId: string) => {
    const res = await safeFetchJson('/api/social/select-target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        targetId,
        profileId: status?.zernio?.activeProfile?._id,
      }),
    });
    const data = res.data;
    if (res.ok && data?.success) {
      setStatus(data.status);
      onStatusChange?.();
      setSuccessBanner(`Active ${platform} account updated.`);
    } else {
      setErrorBanner(data?.message || res.error || 'Could not switch target.');
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    setErrorBanner(null);
    const res = await safeFetchJson('/api/zernio/profiles/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    });
    if (res.ok && res.data?.success) {
      setStatus(res.data.status);
      setVerificationMap({});
      onStatusChange?.();
      setSuccessBanner('Switched workspace profile.');
    } else {
      setErrorBanner(res.data?.error || res.error || 'Could not switch profile.');
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    setCreatingProfile(true);
    setErrorBanner(null);
    try {
      const res = await safeFetchJson('/api/zernio/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProfileName.trim() }),
      });
      if (res.ok && res.data?.success) {
        setStatus(res.data.status);
        setNewProfileName('');
        setShowNewProfile(false);
        setVerificationMap({});
        onStatusChange?.();
        setSuccessBanner(`Created profile "${res.data.profile?.name}". Connect social accounts inside this workspace.`);
      } else {
        setErrorBanner(res.data?.error || res.error || 'Could not create profile.');
      }
    } finally {
      setCreatingProfile(false);
    }
  };

  const copyUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedUri(uri);
    setTimeout(() => setCopiedUri(null), 1800);
  };

  if (loading || !status) {
    return <div className="py-12 text-center text-sm text-slate-500">Checking live social account status...</div>;
  }

  const zernio = status.zernio || {};
  const zernioAuthOk = Boolean(zernio.configured && zernio.authenticated);
  const teamAudit = zernio.teamAudit || null;
  const connectedCountTotal = Number(
    teamAudit?.totalAccountsAcrossTeam ?? zernio.connectedAccountsCount ?? 0
  );
  const freeLimit = Number(teamAudit?.freeAccountLimit ?? zernio.freeAccountLimit ?? 2);
  const teamAccountsList: any[] = Array.isArray(teamAudit?.accountsAcrossTeam)
    ? teamAudit.accountsAcrossTeam
    : Array.isArray(zernio.accounts)
    ? zernio.accounts
    : [];

  const callbackUris: string[] = Array.from(
    new Set(
      [
        status?.redirectUris?.dev,
        status?.redirectUris?.shared,
        `${window.location.origin}/auth/callback`,
      ].filter(Boolean)
    )
  );

  const renderStatusPill = (connected: boolean, expired?: boolean) => {
    if (expired) {
      return <span className="text-[11px] font-mono-tabular font-semibold text-rose-400">TOKEN EXPIRED</span>;
    }
    if (connected) {
      return <span className="text-[11px] font-mono-tabular font-semibold text-emerald-400">CONNECTED</span>;
    }
    return <span className="text-[11px] font-mono-tabular font-semibold text-slate-500">NOT CONNECTED</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">
            Social Media Connections
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Official hosted OAuth 2.0 via Zernio API. API keys and OAuth tokens remain strictly on the backend server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVerify('all')}
            disabled={verifyingTarget !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-semibold text-amber-300 disabled:opacity-50 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{verifyingTarget === 'all' ? 'Verifying...' : 'Verify Live'}</span>
          </button>
          <button
            type="button"
            onClick={loadStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Zernio Backend Verification & User Profile Ownership Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                zernioAuthOk ? 'bg-emerald-400' : zernio.configured ? 'bg-rose-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-white">
              {zernioAuthOk
                ? `Zernio API Authenticated (${zernio.planName || 'Usage-Based'})`
                : zernio.configured
                ? `Zernio Auth Issue: ${zernio.error || 'Verification failed'}`
                : 'ZERNIO_API_KEY Missing in Backend Environment'}
            </span>
            {zernioAuthOk && (
              <span className="text-[11px] font-mono-tabular text-slate-400">
                · {connectedCountTotal} / {freeLimit} free accounts used
                {teamAudit?.inactiveOrReconnectCount > 0
                  ? ` (${teamAudit.inactiveOrReconnectCount} inactive/reconnect needed)`
                  : ''}
                {teamAudit?.duplicateCount > 0 ? ` (${teamAudit.duplicateCount} duplicate)` : ''}
              </span>
            )}
          </div>

          {zernioAuthOk && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Workspace Profile:</span>
              </div>
              <select
                value={zernio.activeProfile?._id || ''}
                onChange={(e) => handleSwitchProfile(e.target.value)}
                className="bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
              >
                {(zernio.profiles || []).map((p: any) => (
                  <option key={p._id} value={p._id}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewProfile((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
              >
                <Plus className="w-3 h-3" />
                <span>New Profile</span>
              </button>
            </div>
          )}
        </div>

        {showNewProfile && (
          <form onSubmit={handleCreateProfile} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Brand or user workspace name (e.g., Acme Corp)"
              className="flex-1 min-w-[220px] bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button
              type="submit"
              disabled={creatingProfile || !newProfileName.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-50"
            >
              {creatingProfile ? 'Creating...' : 'Create Owned Profile'}
            </button>
          </form>
        )}
      </div>

      {paymentError && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-100 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-200">
                  Zernio Account Limit Reached ({paymentError.code || 'PAYMENT_REQUIRED'})
                </div>
                <p className="text-amber-100/90 leading-relaxed">
                  {paymentError.message || 'Zernio requires a payment method to add another account.'}
                </p>
              </div>
            </div>
            {paymentError.dashboard_url && (
              <a
                href={paymentError.dashboard_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition"
              >
                <span>Zernio Billing</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono-tabular text-amber-200/90">
            <div className="bg-[#0B0F19]/80 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
              Reason: {paymentError.reason || 'free_tier_exceeded'}
            </div>
            <div className="bg-[#0B0F19]/80 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
              Connected Accounts: {paymentError.current_account_count ?? connectedCountTotal} /{' '}
              {paymentError.free_tier_account_limit ?? freeLimit} free
            </div>
            <div className="bg-[#0B0F19]/80 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
              Payment Method: {paymentError.has_payment_method ? 'On File' : 'Not Added'}
            </div>
          </div>
          <div className="text-[11px] text-amber-200/80">
            Zernio counts all connected accounts across your team profiles below. To add a new{' '}
            <span className="capitalize font-semibold">{paymentError.platform || 'social'}</span> account free, disconnect one of the existing accounts below, or use <span className="font-semibold">Reconnect</span> if the platform is already connected.
          </div>
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successBanner}</span>
        </div>
      )}

      {/* Three Platform Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* INSTAGRAM */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Instagram className="w-5 h-5 text-pink-400" />
                <span className="font-bold text-white text-sm">Instagram</span>
              </div>
              {renderStatusPill(status.instagram?.connected, status.instagram?.tokenExpired)}
            </div>

            {status.instagram?.connected ? (
              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Account: </span>
                  <span className="font-semibold text-white">@{status.instagram.username}</span>
                </div>
                <div className="font-mono-tabular text-[11px] text-slate-400 truncate">
                  Account ID: {status.instagram.accountId || status.instagram.igId}
                </div>
                {status.instagram.pageName && (
                  <div className="text-[11px] text-slate-400">
                    Profile: {status.instagram.pageName}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect an Instagram Business or Creator account via official hosted OAuth.
                </p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Login via:</span>
                  <select
                    value={igLoginMethod}
                    onChange={(e) => setIgLoginMethod(e.target.value as 'instagram_login' | 'facebook_login')}
                    className="bg-[#0B0F19] border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-200"
                  >
                    <option value="instagram_login">Instagram Login (Direct)</option>
                    <option value="facebook_login">Facebook Page Login</option>
                  </select>
                </div>
              </div>
            )}

            {verificationMap.instagram && (
              <div
                className={`p-2 rounded-lg text-[11px] border ${
                  verificationMap.instagram.ok
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                }`}
              >
                {verificationMap.instagram.message}
              </div>
            )}

            {Array.isArray(status.instagram?.availableAccounts) && status.instagram.availableAccounts.length > 1 && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Active Instagram Account</label>
                <select
                  value={status.instagram?.accountId || status.instagram?.igId || ''}
                  onChange={(e) => handleSelectTarget('instagram', e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {status.instagram.availableAccounts.map((p: any) => (
                    <option key={p.accountId || p.igId} value={p.accountId || p.igId}>
                      @{p.igUsername || p.igId}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleStartOAuth(
                    'instagram',
                    status.instagram?.connected ? status.instagram.accountId : undefined
                  )
                }
                disabled={connectingPlatform === 'instagram'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {connectingPlatform === 'instagram'
                    ? 'Opening...'
                    : status.instagram?.connected
                    ? 'Reconnect'
                    : 'Connect Instagram'}
                </span>
              </button>
              {status.instagram?.connected && (
                <button
                  type="button"
                  onClick={() => handleDisconnect('instagram', status.instagram?.accountId)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 transition"
                  title="Disconnect Instagram"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleVerify('instagram')}
              disabled={verifyingTarget !== null}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{verifyingTarget === 'instagram' ? 'Checking...' : 'Verify Account'}</span>
            </button>
          </div>
        </div>

        {/* FACEBOOK */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Facebook className="w-5 h-5 text-sky-400" />
                <span className="font-bold text-white text-sm">Facebook</span>
              </div>
              {renderStatusPill(status.facebook?.connected, status.facebook?.tokenExpired)}
            </div>

            {status.facebook?.connected ? (
              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Page: </span>
                  <span className="font-semibold text-white">{status.facebook.pageName}</span>
                </div>
                <div className="font-mono-tabular text-[11px] text-slate-400 truncate">
                  Account ID: {status.facebook.accountId || status.facebook.pageId}
                </div>
                {status.facebook.profileId && (
                  <div className="text-[11px] text-slate-400">
                    Profile: {zernio.activeProfile?.name || status.facebook.profileId}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your Facebook Page via official hosted OAuth to publish and schedule posters.
              </p>
            )}

            {verificationMap.facebook && (
              <div
                className={`p-2 rounded-lg text-[11px] border ${
                  verificationMap.facebook.ok
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                }`}
              >
                {verificationMap.facebook.message}
              </div>
            )}

            {Array.isArray(status.facebook?.availablePages) && status.facebook.availablePages.length > 1 && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Active Facebook Page</label>
                <select
                  value={status.facebook?.accountId || status.facebook?.pageId || ''}
                  onChange={(e) => handleSelectTarget('facebook', e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {status.facebook.availablePages.map((p: any) => (
                    <option key={p.accountId || p.pageId} value={p.accountId || p.pageId}>
                      {p.pageName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleStartOAuth(
                    'facebook',
                    status.facebook?.connected ? status.facebook.accountId : undefined
                  )
                }
                disabled={connectingPlatform === 'facebook'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {connectingPlatform === 'facebook'
                    ? 'Opening...'
                    : status.facebook?.connected
                    ? 'Reconnect'
                    : 'Connect Facebook'}
                </span>
              </button>
              {status.facebook?.connected && (
                <button
                  type="button"
                  onClick={() => handleDisconnect('facebook', status.facebook?.accountId)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 transition"
                  title="Disconnect Facebook"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleVerify('facebook')}
              disabled={verifyingTarget !== null}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{verifyingTarget === 'facebook' ? 'Checking...' : 'Verify Account'}</span>
            </button>
          </div>
        </div>

        {/* LINKEDIN */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Linkedin className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-white text-sm">LinkedIn</span>
              </div>
              {renderStatusPill(status.linkedin?.connected, status.linkedin?.tokenExpired)}
            </div>

            {status.linkedin?.connected ? (
              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Profile / Page: </span>
                  <span className="font-semibold text-white">{status.linkedin.authorName}</span>
                </div>
                <div className="font-mono-tabular text-[11px] text-slate-400 truncate">
                  Account ID: {status.linkedin.accountId || status.linkedin.authorUrn}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your LinkedIn Personal Profile or Company Page via official hosted OAuth 2.0.
              </p>
            )}

            {verificationMap.linkedin && (
              <div
                className={`p-2 rounded-lg text-[11px] border ${
                  verificationMap.linkedin.ok
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                }`}
              >
                {verificationMap.linkedin.message}
              </div>
            )}

            {Array.isArray(status.linkedin?.availableTargets) && status.linkedin.availableTargets.length > 1 && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Active LinkedIn Target</label>
                <select
                  value={status.linkedin?.accountId || status.linkedin?.authorUrn || ''}
                  onChange={(e) => handleSelectTarget('linkedin', e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {status.linkedin.availableTargets.map((t: any) => (
                    <option key={t.urn} value={t.urn}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleStartOAuth(
                    'linkedin',
                    status.linkedin?.connected ? status.linkedin.accountId : undefined
                  )
                }
                disabled={connectingPlatform === 'linkedin'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {connectingPlatform === 'linkedin'
                    ? 'Opening...'
                    : status.linkedin?.connected
                    ? 'Reconnect'
                    : 'Connect LinkedIn'}
                </span>
              </button>
              {status.linkedin?.connected && (
                <button
                  type="button"
                  onClick={() => handleDisconnect('linkedin', status.linkedin?.accountId)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 transition"
                  title="Disconnect LinkedIn"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleVerify('linkedin')}
              disabled={verifyingTarget !== null}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{verifyingTarget === 'linkedin' ? 'Checking...' : 'Verify Account'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Team-Wide Connected Accounts List (Active, Inactive, and Cross-Profile) */}
      {teamAccountsList.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-300">
              All Connected Zernio Accounts Across Team ({teamAccountsList.length} / {freeLimit} free slots used)
            </span>
            {teamAudit && (
              <span className="text-[11px] font-mono-tabular text-slate-400">
                Active: {teamAudit.activeAccountsAcrossTeam} · Inactive/Reconnect: {teamAudit.inactiveOrReconnectCount} · Duplicates: {teamAudit.duplicateCount}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-800">
            {teamAccountsList.map((acc: any) => (
              <div key={acc._id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold uppercase text-[10px]">
                    {acc.platform}
                  </span>
                  <span className="font-semibold text-white">{acc.displayName || acc.username}</span>
                  {acc.username && <span className="text-slate-400">@{acc.username.replace(/^@/, '')}</span>}
                  {acc.profileName && (
                    <span className="text-[11px] text-slate-400">Profile: {acc.profileName}</span>
                  )}
                  <span className="font-mono-tabular text-[11px] text-slate-500">ID: {acc._id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {acc.needsReconnection ? (
                    <span className="text-amber-400 font-semibold">Needs Reconnect</span>
                  ) : acc.isActive !== false ? (
                    <span className="text-emerald-400 font-semibold">Active</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">Inactive</span>
                  )}
                  {(acc.needsReconnection || acc.isActive === false) && (
                    <button
                      type="button"
                      onClick={() => handleStartOAuth(acc.platform, acc._id)}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] transition"
                    >
                      Reconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDisconnect(acc.platform, acc._id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-[11px] transition"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorized OAuth Redirect URIs */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-300">OAuth Callback Endpoints</div>
          <div className="text-[11px] font-mono-tabular text-slate-400">
            Provider: {zernio.configured ? 'Zernio Hosted OAuth' : 'Direct OAuth Fallback'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {callbackUris.map((uri) => (
            <button
              key={uri}
              type="button"
              onClick={() => copyUri(uri)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-[11px] font-mono-tabular text-slate-300 hover:border-slate-700"
            >
              <span>{uri}</span>
              {copiedUri === uri ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
