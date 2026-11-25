import fs from 'fs';
import path from 'path';
import type { PlatformPublishResult, PublishingReport, SocialPlatform } from './socialPublisher';

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1';
const ZERNIO_STATE_FILE = path.join(process.cwd(), '.zernio_state.json');

export interface ZernioProfile {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  externalId?: string | null;
  timezone?: string | null;
  accountCount?: number;
  createdAt?: string;
}

export interface ZernioAccount {
  _id: string;
  userId?: string;
  platform: string;
  platformUserId?: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileUrl?: string;
  profileId?: string | { _id: string; name?: string; externalId?: string | null };
  isActive?: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
  platformStatus?: string;
  platformStatusReason?: string | null;
  intentionalDisconnectAt?: string | null;
  tokenExpiresAt?: string | null;
  createdAt?: string;
  permissions?: string[];
  accountType?: string;
}

export function extractZernioProfileId(profileId?: ZernioAccount['profileId']): string {
  if (!profileId) return '';
  return typeof profileId === 'string' ? profileId : profileId._id || '';
}

export function extractZernioProfileName(
  profileId: ZernioAccount['profileId'],
  profiles: ZernioProfile[] = []
): string {
  if (profileId && typeof profileId === 'object' && profileId.name) {
    return profileId.name;
  }
  const id = extractZernioProfileId(profileId);
  const found = profiles.find((p) => p._id === id);
  return found?.name || id || 'Default';
}

export interface ZernioUsageStats {
  planName?: string;
  billingPeriod?: string;
  hasAccess?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  limits?: {
    uploads?: number;
    profiles?: number;
  };
  usage?: {
    connectedAccounts?: number;
    uploads?: number;
  };
}

export interface ZernioPostPlatformStatus {
  platform: string;
  accountId?: string;
  status: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  errorMessage?: string;
}

export interface ZernioPostItem {
  _id: string;
  title?: string;
  content?: string;
  status: string;
  scheduledFor?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  mediaItems?: Array<{ type: string; url: string }>;
  platforms?: ZernioPostPlatformStatus[];
}

interface LocalZernioState {
  workspaceOwnerId: string;
  activeProfileId?: string;
  selectedAccountByProfile: Record<string, Partial<Record<SocialPlatform, string>>>;
  ownedProfiles: Record<string, { ownerId: string; name: string; createdAt: string }>;
}

function generateOwnerId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadZernioState(): LocalZernioState {
  try {
    if (fs.existsSync(ZERNIO_STATE_FILE)) {
      const raw = fs.readFileSync(ZERNIO_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        workspaceOwnerId: parsed.workspaceOwnerId || generateOwnerId(),
        activeProfileId: parsed.activeProfileId || undefined,
        selectedAccountByProfile: parsed.selectedAccountByProfile || {},
        ownedProfiles: parsed.ownedProfiles || {},
      };
    }
  } catch (err) {
    console.warn('[Zernio] Could not load .zernio_state.json:', err);
  }
  const initial: LocalZernioState = {
    workspaceOwnerId: generateOwnerId(),
    selectedAccountByProfile: {},
    ownedProfiles: {},
  };
  saveZernioState(initial);
  return initial;
}

function saveZernioState(state: LocalZernioState) {
  try {
    fs.writeFileSync(ZERNIO_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Zernio] Could not persist .zernio_state.json:', err);
  }
}

let zernioState: LocalZernioState = loadZernioState();

function readEnvFileVar(filename: string, varName: string): string {
  try {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = new RegExp(`^${varName}\\s*=\\s*(.+)$`, 'm');
    const match = content.match(regex);
    if (!match) return '';
    const val = match[1].trim().replace(/^["']|["']$/g, '');
    if (!val || val.startsWith('MY_') || val === 'YOUR_ZERNIO_API_KEY') return '';
    return val;
  } catch {
    return '';
  }
}

// Strictly server-side API key resolver (never sent to client)
export function getZernioApiKey(): string {
  const fromEnv = (process.env.ZERNIO_API_KEY || '').trim();
  if (fromEnv && !fromEnv.startsWith('MY_')) return fromEnv;
  const fromDotEnv = readEnvFileVar('.env', 'ZERNIO_API_KEY');
  if (fromDotEnv) return fromDotEnv;
  const fromExample = readEnvFileVar('.env.example', 'ZERNIO_API_KEY');
  if (fromExample) return fromExample;
  return '';
}

export function isZernioConfigured(): boolean {
  return Boolean(getZernioApiKey());
}

export class ZernioApiError extends Error {
  status: number;
  code: string;
  details?: any;

  constructor(message: string, status = 500, code = 'ZERNIO_API_ERROR', details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function zernioFetch<T = any>(
  endpointPath: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    timeoutMs?: number;
    retryTransient?: boolean;
  } = {}
): Promise<T> {
  const apiKey = getZernioApiKey();
  if (!apiKey) {
    throw new ZernioApiError(
      'ZERNIO_API_KEY is missing on the server. Add it to your backend .env or AI Studio Secrets.',
      503,
      'ZERNIO_KEY_MISSING'
    );
  }

  const method = options.method || 'GET';
  const maxAttempts = options.retryTransient || method === 'GET' ? 2 : 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
      };
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const resp = await fetch(`${ZERNIO_BASE_URL}${endpointPath}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
      });

      const rawText = await resp.text();
      let parsed: any = {};
      if (rawText.trim()) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = { message: rawText.slice(0, 300) };
        }
      }

      if (!resp.ok) {
        const errMsg =
          parsed?.error?.message ||
          parsed?.message ||
          (typeof parsed?.error === 'string' ? parsed.error : '') ||
          `Zernio API error (HTTP ${resp.status})`;
        const errCode =
          parsed?.code ||
          parsed?.error?.code ||
          (resp.status === 401
            ? 'ZERNIO_UNAUTHORIZED'
            : resp.status === 402
            ? 'ZERNIO_PLAN_LIMIT'
            : resp.status === 429
            ? 'ZERNIO_RATE_LIMIT'
            : `ZERNIO_HTTP_${resp.status}`);

        const isTransient = resp.status === 429 || resp.status >= 500;
        if (isTransient && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }
        throw new ZernioApiError(errMsg, resp.status, errCode, parsed);
      }

      return parsed as T;
    } catch (err: any) {
      lastError = err;
      if (err instanceof ZernioApiError) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
        continue;
      }
      throw new ZernioApiError(
        err?.name === 'TimeoutError'
          ? 'Zernio API request timed out. Please retry.'
          : err?.message || 'Failed to communicate with Zernio API.',
        502,
        'ZERNIO_NETWORK_ERROR'
      );
    }
  }

  throw lastError || new ZernioApiError('Zernio request failed.', 502, 'ZERNIO_FAILED');
}

export async function verifyZernioAuthentication(): Promise<{
  authenticated: boolean;
  usage: ZernioUsageStats | null;
  error?: string;
  errorCode?: string;
}> {
  if (!isZernioConfigured()) {
    return {
      authenticated: false,
      usage: null,
      error: 'ZERNIO_API_KEY is not set on the server.',
      errorCode: 'ZERNIO_KEY_MISSING',
    };
  }
  try {
    const usage = await zernioFetch<ZernioUsageStats>('/usage-stats', { method: 'GET', timeoutMs: 12000 });
    return {
      authenticated: true,
      usage,
    };
  } catch (err: any) {
    return {
      authenticated: false,
      usage: null,
      error: err?.message || 'Could not authenticate with Zernio API.',
      errorCode: err?.code || 'ZERNIO_AUTH_FAILED',
    };
  }
}

export async function listZernioProfiles(): Promise<ZernioProfile[]> {
  const data = await zernioFetch<{ profiles?: ZernioProfile[] }>('/profiles', { method: 'GET' });
  const list = Array.isArray(data?.profiles) ? data.profiles : [];
  for (const p of list) {
    if (p._id && !zernioState.ownedProfiles[p._id]) {
      zernioState.ownedProfiles[p._id] = {
        ownerId: zernioState.workspaceOwnerId,
        name: p.name,
        createdAt: p.createdAt || new Date().toISOString(),
      };
    }
  }
  saveZernioState(zernioState);
  return list;
}

export async function createZernioProfile(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<ZernioProfile> {
  const cleanName = String(input.name || '').trim();
  if (!cleanName) {
    throw new ZernioApiError('Profile name is required.', 400, 'INVALID_PROFILE_NAME');
  }
  const externalId = `${zernioState.workspaceOwnerId}_${Date.now().toString(36)}`;
  const res = await zernioFetch<{ profile?: ZernioProfile } & ZernioProfile>('/profiles', {
    method: 'POST',
    body: {
      name: cleanName,
      description: input.description?.trim() || `PostPilot Studio Workspace (${zernioState.workspaceOwnerId})`,
      color: input.color || '#F59E0B',
      externalId,
    },
  });
  const created = res.profile || res;
  if (!created?._id) {
    throw new ZernioApiError('Zernio did not return a created profile ID.', 502, 'PROFILE_CREATE_FAILED');
  }
  zernioState.activeProfileId = created._id;
  zernioState.ownedProfiles[created._id] = {
    ownerId: zernioState.workspaceOwnerId,
    name: created.name,
    createdAt: created.createdAt || new Date().toISOString(),
  };
  saveZernioState(zernioState);
  return created;
}

export async function ensureActiveZernioProfile(preferredBrandName?: string): Promise<{
  activeProfile: ZernioProfile;
  profiles: ZernioProfile[];
}> {
  let profiles = await listZernioProfiles();
  if (profiles.length === 0) {
    const created = await createZernioProfile({
      name: preferredBrandName?.trim() || 'PostPilot Workspace',
      description: 'Default PostPilot social publishing profile',
    });
    profiles = [created];
  }

  let active = zernioState.activeProfileId
    ? profiles.find((p) => p._id === zernioState.activeProfileId)
    : undefined;

  if (!active) {
    active = profiles.find((p) => p.isDefault) || profiles[0];
    zernioState.activeProfileId = active._id;
    saveZernioState(zernioState);
  }

  return { activeProfile: active, profiles };
}

export async function selectActiveZernioProfile(profileId: string): Promise<{
  activeProfile: ZernioProfile;
  profiles: ZernioProfile[];
}> {
  const profiles = await listZernioProfiles();
  const target = profiles.find((p) => p._id === profileId);
  if (!target) {
    throw new ZernioApiError(`Zernio profile "${profileId}" was not found or is not owned by this API key.`, 404, 'PROFILE_NOT_FOUND');
  }
  zernioState.activeProfileId = target._id;
  saveZernioState(zernioState);
  return { activeProfile: target, profiles };
}

export async function listZernioAccounts(profileId?: string): Promise<ZernioAccount[]> {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const data = await zernioFetch<{ accounts?: ZernioAccount[] }>(`/accounts${query}`, { method: 'GET' });
  return Array.isArray(data?.accounts) ? data.accounts : [];
}

function getSelectedAccountIdForPlatform(profileId: string, platform: SocialPlatform, accounts: ZernioAccount[]): ZernioAccount | null {
  const matching = accounts.filter(
    (a) => a.platform?.toLowerCase() === platform && a.isActive !== false
  );
  if (matching.length === 0) return null;
  const preferredId = zernioState.selectedAccountByProfile?.[profileId]?.[platform];
  if (preferredId) {
    const found = matching.find((m) => m._id === preferredId);
    if (found) return found;
  }
  return matching[0];
}

export function selectZernioAccountTarget(profileId: string, platform: SocialPlatform, accountId: string, accounts: ZernioAccount[]) {
  const target = accounts.find((a) => a._id === accountId && a.platform?.toLowerCase() === platform);
  if (!target) {
    throw new ZernioApiError(
      `Account "${accountId}" does not belong to active profile "${profileId}" for ${platform}.`,
      403,
      'ACCOUNT_OWNERSHIP_MISMATCH'
    );
  }
  if (!zernioState.selectedAccountByProfile[profileId]) {
    zernioState.selectedAccountByProfile[profileId] = {};
  }
  zernioState.selectedAccountByProfile[profileId][platform] = target._id;
  saveZernioState(zernioState);
  return target;
}

export interface SanitizedZernioAccountSummary {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileId: string;
  profileName: string;
  isActive: boolean;
  needsReconnection: boolean;
  isPending: boolean;
  platformStatus?: string;
  tokenExpiresAt: string | null;
  createdAt?: string;
}

export interface ZernioTeamAccountAudit {
  totalAccountsAcrossTeam: number;
  activeAccountsAcrossTeam: number;
  inactiveOrReconnectCount: number;
  pendingCount: number;
  duplicateCount: number;
  usageReportedConnectedAccounts: number | null;
  profilesCount: number;
  freeAccountLimit: number;
  duplicates: Array<{
    key: string;
    platform: string;
    label: string;
    accountIds: string[];
  }>;
  accountsAcrossTeam: SanitizedZernioAccountSummary[];
}

export function buildZernioTeamAccountAudit(
  allAccounts: ZernioAccount[],
  profiles: ZernioProfile[],
  usage?: ZernioUsageStats | null
): ZernioTeamAccountAudit {
  const summaries: SanitizedZernioAccountSummary[] = allAccounts.map((acc) => {
    const pid = extractZernioProfileId(acc.profileId);
    const pName = extractZernioProfileName(acc.profileId, profiles);
    const isActive =
      acc.isActive !== false &&
      acc.enabled !== false &&
      !acc.intentionalDisconnectAt;
    const needsReconnection = Boolean(
      acc.needsReconnection ||
        (acc.platformStatus && acc.platformStatus.toLowerCase() !== 'active')
    );
    const isPending = !acc.platformUserId && !acc.username && !acc.displayName;
    return {
      _id: acc._id,
      platform: acc.platform,
      username: acc.username,
      displayName: acc.displayName,
      profilePicture: acc.profilePicture,
      profileId: pid,
      profileName: pName,
      isActive,
      needsReconnection,
      isPending,
      platformStatus: acc.platformStatus,
      tokenExpiresAt: acc.tokenExpiresAt || null,
      createdAt: acc.createdAt,
    };
  });

  const groupMap = new Map<string, SanitizedZernioAccountSummary[]>();
  for (let i = 0; i < allAccounts.length; i++) {
    const raw = allAccounts[i];
    const sum = summaries[i];
    const identity = raw.platformUserId || raw.username || raw._id;
    const key = `${(raw.platform || '').toLowerCase()}:${identity}`;
    const list = groupMap.get(key) || [];
    list.push(sum);
    groupMap.set(key, list);
  }

  const duplicates: ZernioTeamAccountAudit['duplicates'] = [];
  for (const [key, list] of groupMap.entries()) {
    if (list.length > 1) {
      duplicates.push({
        key,
        platform: list[0].platform,
        label: list[0].displayName || list[0].username || key,
        accountIds: list.map((x) => x._id),
      });
    }
  }

  const activeCount = summaries.filter((a) => a.isActive && !a.needsReconnection).length;
  const inactiveOrReconnectCount = summaries.filter((a) => !a.isActive || a.needsReconnection).length;
  const pendingCount = summaries.filter((a) => a.isPending).length;

  return {
    totalAccountsAcrossTeam: summaries.length,
    activeAccountsAcrossTeam: activeCount,
    inactiveOrReconnectCount,
    pendingCount,
    duplicateCount: duplicates.reduce((acc, g) => acc + (g.accountIds.length - 1), 0),
    usageReportedConnectedAccounts:
      typeof usage?.usage?.connectedAccounts === 'number' ? usage.usage.connectedAccounts : null,
    profilesCount: profiles.length,
    freeAccountLimit: 2,
    duplicates,
    accountsAcrossTeam: summaries,
  };
}

export async function initiateZernioOAuthConnect(params: {
  platform: SocialPlatform;
  redirectUrl: string;
  profileId?: string;
  reconnectAccountId?: string;
  loginMethod?: 'instagram_login' | 'facebook_login';
}): Promise<{ authUrl: string; state?: string; profileId: string; reconnectedExistingId?: string }> {
  const [{ activeProfile, profiles }, allAccounts, usageAuth] = await Promise.all([
    params.profileId
      ? selectActiveZernioProfile(params.profileId)
      : ensureActiveZernioProfile(),
    listZernioAccounts(),
    verifyZernioAuthentication(),
  ]);

  const activeProfileAccounts = allAccounts.filter(
    (a) => extractZernioProfileId(a.profileId) === activeProfile._id
  );

  // If the client didn't explicitly supply reconnectAccountId, check whether an inactive
  // or needsReconnection slot for this platform already exists under this profile so we reuse
  // the existing slot instead of triggering a spurious new-seat charge.
  let effectiveReconnectId = params.reconnectAccountId;
  if (!effectiveReconnectId) {
    const staleSlot = activeProfileAccounts.find(
      (a) =>
        a.platform?.toLowerCase() === params.platform &&
        (a.isActive === false || a.enabled === false || a.needsReconnection === true)
    );
    if (staleSlot?._id) {
      effectiveReconnectId = staleSlot._id;
    }
  }

  const url = new URL(`${ZERNIO_BASE_URL}/connect/${params.platform}`);
  url.searchParams.set('profileId', activeProfile._id);
  url.searchParams.set('redirect_url', params.redirectUrl);
  if (effectiveReconnectId) {
    url.searchParams.set('reconnectAccountId', effectiveReconnectId);
  }
  if (params.platform === 'instagram' && params.loginMethod) {
    url.searchParams.set('loginMethod', params.loginMethod);
  }

  try {
    const data = await zernioFetch<{ authUrl?: string; state?: string }>(
      `/connect/${params.platform}?${url.searchParams.toString()}`,
      { method: 'GET' }
    );

    if (!data?.authUrl) {
      throw new ZernioApiError('Zernio did not return an authorization URL.', 502, 'MISSING_AUTH_URL', data);
    }

    return {
      authUrl: data.authUrl,
      state: data.state,
      profileId: activeProfile._id,
      reconnectedExistingId: effectiveReconnectId,
    };
  } catch (err: any) {
    if (err instanceof ZernioApiError) {
      const teamAudit = buildZernioTeamAccountAudit(allAccounts, profiles, usageAuth.usage);
      const raw = err.details || {};
      const paymentDetails =
        err.status === 402 || raw?.code === 'PAYMENT_REQUIRED'
          ? {
              code: raw?.code || err.code || 'PAYMENT_REQUIRED',
              reason: raw?.reason || 'free_tier_exceeded',
              message: raw?.error || raw?.message || err.message,
              current_account_count:
                raw?.details?.current_account_count ??
                usageAuth.usage?.usage?.connectedAccounts ??
                teamAudit.totalAccountsAcrossTeam,
              free_tier_account_limit: raw?.details?.free_tier_account_limit ?? 2,
              has_payment_method: raw?.details?.has_payment_method ?? false,
              dashboard_url: typeof raw?.dashboard_url === 'string' ? raw.dashboard_url : undefined,
              documentation_url: typeof raw?.documentation_url === 'string' ? raw.documentation_url : undefined,
            }
          : undefined;

      throw new ZernioApiError(err.message, err.status, err.code, {
        ...raw,
        paymentDetails,
        teamAudit,
        platformAttempted: params.platform,
        activeProfileId: activeProfile._id,
      });
    }
    throw err;
  }
}

export async function verifyZernioConnectedAccountAfterCallback(params: {
  profileId?: string;
  platform: SocialPlatform;
  accountId?: string;
}): Promise<{
  verified: boolean;
  profileId: string;
  account: ZernioAccount | null;
  accounts: ZernioAccount[];
}> {
  const { activeProfile } = params.profileId
    ? await selectActiveZernioProfile(params.profileId)
    : await ensureActiveZernioProfile();

  const accounts = await listZernioAccounts(activeProfile._id);
  let matched: ZernioAccount | null = null;
  if (params.accountId) {
    matched = accounts.find((a) => a._id === params.accountId && a.isActive !== false) || null;
  }
  if (!matched) {
    const candidates = accounts.filter((a) => a.platform?.toLowerCase() === params.platform && a.isActive !== false);
    matched = candidates[candidates.length - 1] || null;
  }

  if (matched) {
    if (!zernioState.selectedAccountByProfile[activeProfile._id]) {
      zernioState.selectedAccountByProfile[activeProfile._id] = {};
    }
    zernioState.selectedAccountByProfile[activeProfile._id][params.platform] = matched._id;
    saveZernioState(zernioState);
  }

  return {
    verified: Boolean(matched),
    profileId: activeProfile._id,
    account: matched,
    accounts,
  };
}

export async function disconnectZernioAccount(params: {
  accountId?: string;
  platform?: SocialPlatform | 'all';
  profileId?: string;
}): Promise<{ disconnectedIds: string[]; profileId: string }> {
  const { activeProfile, profiles } = params.profileId
    ? await selectActiveZernioProfile(params.profileId)
    : await ensureActiveZernioProfile();
  const [profileAccounts, allAccounts] = await Promise.all([
    listZernioAccounts(activeProfile._id),
    listZernioAccounts(),
  ]);

  const targets: ZernioAccount[] = [];
  if (params.accountId) {
    const owned =
      profileAccounts.find((a) => a._id === params.accountId) ||
      allAccounts.find((a) => {
        const pid = extractZernioProfileId(a.profileId);
        return a._id === params.accountId && (!pid || profiles.some((p) => p._id === pid));
      });
    if (!owned) {
      throw new ZernioApiError(
        `Account "${params.accountId}" does not belong to an owned workspace profile.`,
        403,
        'ACCOUNT_OWNERSHIP_MISMATCH'
      );
    }
    targets.push(owned);
  } else if (params.platform && params.platform !== 'all') {
    const selected = getSelectedAccountIdForPlatform(activeProfile._id, params.platform, profileAccounts);
    if (selected) targets.push(selected);
  } else {
    targets.push(...profileAccounts);
  }

  const disconnectedIds: string[] = [];
  for (const acc of targets) {
    await zernioFetch(`/accounts/${encodeURIComponent(acc._id)}`, { method: 'DELETE' });
    disconnectedIds.push(acc._id);
    const plat = acc.platform?.toLowerCase() as SocialPlatform;
    const pid = extractZernioProfileId(acc.profileId) || activeProfile._id;
    if (zernioState.selectedAccountByProfile[pid]?.[plat] === acc._id) {
      delete zernioState.selectedAccountByProfile[pid][plat];
    }
  }
  saveZernioState(zernioState);
  return { disconnectedIds, profileId: activeProfile._id };
}

export async function getZernioDashboardSnapshot(preferredBrandName?: string) {
  const auth = await verifyZernioAuthentication();
  if (!auth.authenticated) {
    return {
      configured: isZernioConfigured(),
      authenticated: false,
      error: auth.error,
      errorCode: auth.errorCode,
      usage: null,
      activeProfile: null as ZernioProfile | null,
      profiles: [] as ZernioProfile[],
      accounts: [] as ZernioAccount[],
      teamAudit: null as ZernioTeamAccountAudit | null,
      activeByPlatform: {
        instagram: null as ZernioAccount | null,
        facebook: null as ZernioAccount | null,
        linkedin: null as ZernioAccount | null,
      },
    };
  }

  const [{ activeProfile, profiles }, allAccounts] = await Promise.all([
    ensureActiveZernioProfile(preferredBrandName),
    listZernioAccounts(),
  ]);

  // Filter active profile accounts strictly from global list (fall back cleanly if profileId missing)
  const accounts = allAccounts.filter((a) => {
    const pid = extractZernioProfileId(a.profileId);
    return !pid || pid === activeProfile._id;
  });
  const teamAudit = buildZernioTeamAccountAudit(allAccounts, profiles, auth.usage);

  return {
    configured: true,
    authenticated: true,
    error: undefined,
    errorCode: undefined,
    usage: auth.usage,
    activeProfile,
    profiles,
    accounts,
    teamAudit,
    activeByPlatform: {
      instagram: getSelectedAccountIdForPlatform(activeProfile._id, 'instagram', accounts),
      facebook: getSelectedAccountIdForPlatform(activeProfile._id, 'facebook', accounts),
      linkedin: getSelectedAccountIdForPlatform(activeProfile._id, 'linkedin', accounts),
    },
  };
}

// ==========================================
// ZERNIO MEDIA UPLOAD (POST /v1/media/presign -> PUT uploadUrl)
// ==========================================
export async function uploadPosterBufferToZernio(params: {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  filename: string;
}): Promise<{ publicUrl: string }> {
  const presigned = await zernioFetch<{
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
  }>('/media/presign', {
    method: 'POST',
    body: {
      filename: params.filename,
      contentType: params.mimeType,
      size: params.buffer.length,
    },
    timeoutMs: 15000,
    retryTransient: true,
  });

  if (!presigned?.uploadUrl || !presigned?.publicUrl) {
    throw new ZernioApiError('Zernio /media/presign did not return uploadUrl and publicUrl.', 502, 'MEDIA_PRESIGN_FAILED');
  }

  // PUT binary directly to R2/storage URL (NO Authorization header per Zernio docs)
  const putResp = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.mimeType,
    },
    body: new Uint8Array(params.buffer),
    signal: AbortSignal.timeout(30000),
  });

  if (!putResp.ok) {
    throw new ZernioApiError(
      `Direct media upload to storage failed (HTTP ${putResp.status}).`,
      502,
      'MEDIA_UPLOAD_PUT_FAILED'
    );
  }

  return { publicUrl: presigned.publicUrl };
}

// ==========================================
// ZERNIO PUBLISHING & SCHEDULING (POST /v1/posts)
// ==========================================
export async function publishOrScheduleViaZernio(params: {
  topic: string;
  platforms: SocialPlatform[];
  captions: { instagram: string; facebook: string; linkedin: string };
  mediaByPlatform: Partial<Record<SocialPlatform, { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: string }>>;
  mode: 'now' | 'schedule';
  scheduledFor?: string;
  timezone?: string;
  profileId?: string;
}): Promise<{
  zernioPost: ZernioPostItem | null;
  report: PublishingReport;
  missingPlatforms: SocialPlatform[];
}> {
  const { activeProfile } = params.profileId
    ? await selectActiveZernioProfile(params.profileId)
    : await ensureActiveZernioProfile();
  const accounts = await listZernioAccounts(activeProfile._id);

  const selectedSet = new Set<SocialPlatform>(
    params.platforms && params.platforms.length > 0 ? params.platforms : ['instagram', 'facebook', 'linkedin']
  );

  const connectedTargets: Array<{ platform: SocialPlatform; account: ZernioAccount }> = [];
  const missingPlatforms: SocialPlatform[] = [];

  for (const plat of ['instagram', 'facebook', 'linkedin'] as SocialPlatform[]) {
    if (!selectedSet.has(plat)) continue;
    const acc = getSelectedAccountIdForPlatform(activeProfile._id, plat, accounts);
    if (!acc) {
      missingPlatforms.push(plat);
    } else {
      connectedTargets.push({ platform: plat, account: acc });
    }
  }

  // Upload media assets once per unique buffer size/content
  const uploadedUrlByBufferHash = new Map<string, string>();
  const uploadedUrlByPlatform: Partial<Record<SocialPlatform, string>> = {};
  let firstSizeBytes = 0;
  let firstMime = 'image/jpeg';

  for (const target of connectedTargets) {
    const media = params.mediaByPlatform[target.platform];
    if (!media) continue;
    if (!firstSizeBytes) {
      firstSizeBytes = media.buffer.length;
      firstMime = media.mimeType;
    }
    const fingerprint = `${media.mimeType}:${media.buffer.length}:${media.buffer.subarray(0, 64).toString('base64')}`;
    let publicUrl = uploadedUrlByBufferHash.get(fingerprint);
    if (!publicUrl) {
      const uploaded = await uploadPosterBufferToZernio({
        buffer: media.buffer,
        mimeType: media.mimeType,
        filename: `postpilot_${target.platform}_${Date.now()}.${media.ext}`,
      });
      publicUrl = uploaded.publicUrl;
      uploadedUrlByBufferHash.set(fingerprint, publicUrl);
    }
    uploadedUrlByPlatform[target.platform] = publicUrl;
  }

  let zernioPost: ZernioPostItem | null = null;
  let apiDispatchError: string | null = null;
  let apiDispatchErrorCode: string | undefined;

  if (connectedTargets.length > 0) {
    const primaryTarget = connectedTargets[0];
    const defaultContent = params.captions[primaryTarget.platform] || params.topic;
    const primaryUrl = uploadedUrlByPlatform[primaryTarget.platform];

    const payload: Record<string, any> = {
      title: params.topic.slice(0, 120),
      content: defaultContent,
      ...(primaryUrl ? { mediaItems: [{ type: 'image', url: primaryUrl }] } : {}),
      platforms: connectedTargets.map((t) => {
        const platUrl = uploadedUrlByPlatform[t.platform];
        return {
          platform: t.platform,
          accountId: t.account._id,
          customContent: params.captions[t.platform] || defaultContent,
          ...(platUrl ? { customMedia: [{ type: 'image', url: platUrl }] } : {}),
        };
      }),
    };

    if (params.mode === 'schedule') {
      if (!params.scheduledFor) {
        throw new ZernioApiError('scheduledFor ISO datetime is required when scheduling a post.', 400, 'MISSING_SCHEDULE_TIME');
      }
      payload.scheduledFor = params.scheduledFor;
      if (params.timezone) {
        payload.timezone = params.timezone;
      }
    } else {
      payload.publishNow = true;
    }

    try {
      const created = await zernioFetch<{ post?: ZernioPostItem; message?: string }>('/posts', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
      zernioPost = created.post || (created as any);

      // If Zernio returned an in-progress status on publishNow, poll briefly once for live outcome
      if (
        params.mode === 'now' &&
        zernioPost?._id &&
        (zernioPost.status === 'publishing' || zernioPost.status === 'processing' || zernioPost.status === 'pending')
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const refreshed = await zernioFetch<{ post?: ZernioPostItem }>(`/posts/${encodeURIComponent(zernioPost._id)}`, {
            method: 'GET',
            timeoutMs: 12000,
          });
          if (refreshed?.post) zernioPost = refreshed.post;
        } catch {
          // keep initial zernioPost
        }
      }
    } catch (err: any) {
      apiDispatchError = err?.message || 'Zernio post dispatch failed.';
      apiDispatchErrorCode = err?.code || 'ZERNIO_POST_FAILED';
      console.error(`[Zernio] POST /v1/posts failed (${apiDispatchErrorCode}): ${apiDispatchError}`);
    }
  }

  const buildPlatformResult = (plat: SocialPlatform): PlatformPublishResult => {
    if (!selectedSet.has(plat)) {
      return { platform: plat, status: 'SKIPPED', attempts: 0 };
    }
    const acc = getSelectedAccountIdForPlatform(activeProfile._id, plat, accounts);
    if (!acc) {
      return {
        platform: plat,
        status: 'FAILED',
        errorCode: 'NOT_CONNECTED',
        errorMessage: `No ${plat} account connected under workspace profile "${activeProfile.name}".`,
        reason: 'OAuth connection missing for this platform.',
        requiredAction: `Open Social Connections and click "Connect ${plat.charAt(0).toUpperCase() + plat.slice(1)}" to authorize via Zernio.`,
        attempts: 0,
        captionUsed: params.captions[plat],
      };
    }

    const label = acc.displayName || (acc.username ? `@${acc.username.replace(/^@/, '')}` : acc._id);

    if (apiDispatchError) {
      return {
        platform: plat,
        status: 'FAILED',
        errorCode: apiDispatchErrorCode,
        errorMessage: apiDispatchError,
        reason: 'Zernio API rejected or failed the post request.',
        requiredAction:
          apiDispatchErrorCode === 'ZERNIO_PLAN_LIMIT' || apiDispatchErrorCode === 'PAYMENT_REQUIRED'
            ? 'Check your Zernio plan connected-account or billing status.'
            : 'Verify account permissions in Social Connections and retry.',
        attempts: 1,
        captionUsed: params.captions[plat],
        accountLabel: label,
      };
    }

    const pEntry = zernioPost?.platforms?.find((p) => p.platform?.toLowerCase() === plat);
    const pStatus = (pEntry?.status || zernioPost?.status || '').toLowerCase();

    if (
      pStatus === 'published' ||
      (params.mode === 'now' && (pStatus === 'publishing' || pStatus === 'processing' || pStatus === 'queued')) ||
      (params.mode === 'schedule' && (pStatus === 'scheduled' || pStatus === 'pending' || pStatus === 'queued'))
    ) {
      return {
        platform: plat,
        status: 'SUCCESS',
        postId: pEntry?.platformPostId || zernioPost?._id,
        postUrl: pEntry?.platformPostUrl,
        attempts: 1,
        captionUsed: params.captions[plat],
        accountLabel: label,
      };
    }

    return {
      platform: plat,
      status: 'FAILED',
      postId: zernioPost?._id,
      errorCode: 'ZERNIO_PLATFORM_FAILED',
      errorMessage: pEntry?.error || pEntry?.errorMessage || `Platform status returned "${pStatus || 'failed'}".`,
      reason: `Zernio reported status "${pStatus || 'unknown'}" for ${plat}.`,
      requiredAction: 'You can safely retry failed platforms from Publishing History or reconnect the account.',
      attempts: 1,
      captionUsed: params.captions[plat],
      accountLabel: label,
    };
  };

  const igRes = buildPlatformResult('instagram');
  const fbRes = buildPlatformResult('facebook');
  const liRes = buildPlatformResult('linkedin');

  const lines: string[] = [
    `ZERNIO PUBLISHING REPORT (${activeProfile.name})`,
    '',
    `Poster Asset: ${firstMime} (${(firstSizeBytes / 1024).toFixed(1)} KB via Zernio Media Storage)`,
    zernioPost?._id ? `Zernio Post ID: ${zernioPost._id} (${zernioPost.status})` : 'Zernio Post: Not created',
    '',
  ];
  for (const [label, r] of [
    ['Instagram', igRes],
    ['Facebook', fbRes],
    ['LinkedIn', liRes],
  ] as const) {
    if (r.status === 'SKIPPED') continue;
    lines.push(`${label}: ${r.status}${r.postUrl ? ` (${r.postUrl})` : r.errorMessage ? ` — ${r.errorMessage}` : ''}`);
  }

  const report: PublishingReport = {
    id: zernioPost?._id ? `z_${zernioPost._id}` : `rep_${Date.now()}`,
    timestamp: new Date().toISOString(),
    topic: params.topic,
    posterGeneration: {
      status: 'SUCCESS',
      detail: `${firstMime} ${(firstSizeBytes / 1024).toFixed(1)} KB (Zernio R2 Media)`,
      sizeBytes: firstSizeBytes,
      format: firstMime,
    },
    platforms: {
      instagram: igRes,
      facebook: fbRes,
      linkedin: liRes,
    },
    formattedReport: lines.join('\n'),
  };

  return { zernioPost, report, missingPlatforms };
}

export async function listZernioPosts(params?: { status?: string; limit?: number; page?: number }): Promise<{
  posts: ZernioPostItem[];
  pagination?: any;
}> {
  const qs = new URLSearchParams();
  qs.set('limit', String(Math.min(Math.max(params?.limit || 25, 1), 50)));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.status) qs.set('status', params.status);

  const data = await zernioFetch<{ posts?: ZernioPostItem[]; pagination?: any }>(
    `/posts?${qs.toString()}`,
    { method: 'GET' }
  );
  return {
    posts: Array.isArray(data?.posts) ? data.posts : [],
    pagination: data?.pagination,
  };
}

export async function retryZernioPost(postId: string): Promise<ZernioPostItem> {
  const data = await zernioFetch<{ post?: ZernioPostItem }>(`/posts/${encodeURIComponent(postId)}/retry`, {
    method: 'POST',
    timeoutMs: 30000,
  });
  return data.post || (data as any);
}

export async function publishZernioScheduledPostNow(postId: string): Promise<ZernioPostItem> {
  const data = await zernioFetch<{ post?: ZernioPostItem }>(`/posts/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    body: { publishNow: true },
    timeoutMs: 30000,
  });
  return data.post || (data as any);
}

export async function deleteZernioPost(postId: string): Promise<void> {
  await zernioFetch(`/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    timeoutMs: 15000,
  });
}
