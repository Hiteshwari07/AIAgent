import fs from 'fs';
import path from 'path';

const GRAPH_VERSION = 'v21.0';
const CREDENTIALS_FILE = path.join(process.cwd(), '.social_credentials.json');
const HISTORY_FILE = path.join(process.cwd(), '.social_publish_history.json');

function getRecentLinkedInVersions(): string[] {
  const now = new Date();
  const versions: string[] = [];
  for (let offset = 1; offset <= 6; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!versions.includes(ym)) versions.push(ym);
  }
  if (!versions.includes('202601')) versions.push('202601');
  if (!versions.includes('202511')) versions.push('202511');
  if (!versions.includes('202501')) versions.push('202501');
  return versions;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';

export interface DiscoveredMetaPage {
  pageId: string;
  pageName: string;
  pageAccessToken?: string;
  igId?: string;
  igUsername?: string;
  igName?: string;
}

export interface DiscoveredLinkedInOrg {
  urn: string;
  name: string;
  type: 'person' | 'organization';
}

export interface StoredSocialCredentials {
  meta?: {
    userAccessToken: string;
    expiresAt?: number;
    grantedPermissions?: string[];
    declinedPermissions?: string[];
    availablePages?: DiscoveredMetaPage[];
    updatedAt: string;
  };
  instagram?: {
    igId: string;
    username: string;
    name?: string;
    pageId?: string;
    pageName?: string;
    eligibleForPublishing?: boolean;
    publishingQuota?: {
      quotaUsage?: number;
      quotaTotal?: number;
    };
  };
  facebook?: {
    pageId: string;
    pageName: string;
    pageAccessToken: string;
  };
  linkedin?: {
    accessToken: string;
    expiresAt?: number;
    authorUrn: string;
    authorName: string;
    handle?: string;
    scopes?: string[];
    availableTargets?: DiscoveredLinkedInOrg[];
    updatedAt: string;
  };
  metaOAuthApp?: {
    clientId: string;
    clientSecret: string;
  };
  linkedinOAuthApp?: {
    clientId: string;
    clientSecret: string;
  };
}

export interface PlatformPublishResult {
  platform: SocialPlatform;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  postId?: string;
  postUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  reason?: string;
  requiredAction?: string;
  attempts: number;
  captionUsed?: string;
  accountLabel?: string;
}

export interface PublishingReport {
  id: string;
  timestamp: string;
  topic: string;
  posterGeneration: {
    status: 'SUCCESS' | 'FAILED';
    detail: string;
    imageHost?: string;
    sizeBytes?: number;
    format?: string;
  };
  platforms: {
    instagram: PlatformPublishResult;
    facebook: PlatformPublishResult;
    linkedin: PlatformPublishResult;
  };
  formattedReport: string;
}

// ==========================================
// SERVER-SIDE CREDENTIAL STORE (NEVER EXPOSED TO CLIENT)
// ==========================================
let credentialsStore: StoredSocialCredentials = {};
let publishHistory: PublishingReport[] = [];

function isNumericId(val?: string | null): boolean {
  return Boolean(val && /^\d+$/.test(val.trim()));
}

function loadFromDisk() {
  let dirty = false;
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      credentialsStore = JSON.parse(raw) || {};
      // Strictly strip any invalid non-numeric Instagram ID (such as a @username handle)
      if (credentialsStore.instagram?.igId && !isNumericId(credentialsStore.instagram.igId)) {
        console.warn(
          `[SocialPublisher] Removing invalid non-numeric stored Instagram ID "${credentialsStore.instagram.igId}" (usernames cannot be used as Graph API Account IDs).`
        );
        delete credentialsStore.instagram;
        dirty = true;
      }
    }
  } catch (err) {
    console.warn('[SocialPublisher] Could not load credentials file:', err);
  }

  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        publishHistory = parsed.slice(0, 50);
      }
    }
  } catch (err) {
    console.warn('[SocialPublisher] Could not load history file:', err);
  }

  // Merge environment variables if present and not overridden
  if (process.env.META_ACCESS_TOKEN && !credentialsStore.meta?.userAccessToken) {
    credentialsStore.meta = {
      userAccessToken: process.env.META_ACCESS_TOKEN,
      updatedAt: new Date().toISOString(),
    };
  }
  // Never adopt a non-numeric env INSTAGRAM_ACCOUNT_ID (e.g. a username like "hiteshwariofficial")
  const envIgId = process.env.INSTAGRAM_ACCOUNT_ID?.trim();
  if (envIgId) {
    if (isNumericId(envIgId) && !credentialsStore.instagram?.igId) {
      credentialsStore.instagram = {
        igId: envIgId,
        username: process.env.INSTAGRAM_USERNAME || 'Instagram Business',
      };
    } else if (!isNumericId(envIgId)) {
      console.warn(
        `[SocialPublisher] Ignoring non-numeric INSTAGRAM_ACCOUNT_ID env value "${envIgId}". Numeric ID will be auto-detected from connected Facebook Page.`
      );
    }
  }
  if (process.env.FACEBOOK_PAGE_ID && (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN)) {
    if (!credentialsStore.facebook?.pageId) {
      credentialsStore.facebook = {
        pageId: process.env.FACEBOOK_PAGE_ID.trim(),
        pageName: process.env.FACEBOOK_PAGE_NAME || 'Facebook Page',
        pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '',
      };
    }
  }
  if (process.env.LINKEDIN_ACCESS_TOKEN && !credentialsStore.linkedin?.accessToken) {
    credentialsStore.linkedin = {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
      authorUrn: process.env.LINKEDIN_AUTHOR_URN || '',
      authorName: process.env.LINKEDIN_AUTHOR_NAME || 'LinkedIn Profile',
      updatedAt: new Date().toISOString(),
    };
  }

  if (dirty) {
    saveCredentialsToDisk();
  }
}

loadFromDisk();

function saveCredentialsToDisk() {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentialsStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SocialPublisher] Failed to persist credentials:', err);
  }
}

function saveHistoryToDisk() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(publishHistory.slice(0, 50), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SocialPublisher] Failed to persist history:', err);
  }
}

export function getSanitizedConnectionStatus() {
  const nowSec = Math.floor(Date.now() / 1000);
  const metaExpired = credentialsStore.meta?.expiresAt ? credentialsStore.meta.expiresAt < nowSec : false;
  const liExpired = credentialsStore.linkedin?.expiresAt ? credentialsStore.linkedin.expiresAt < nowSec : false;

  const granted = credentialsStore.meta?.grantedPermissions || [];

  const igMissingPerms: string[] = [];
  if (granted.length > 0) {
    if (!granted.includes('instagram_basic')) igMissingPerms.push('instagram_basic');
    if (!granted.includes('instagram_content_publish')) igMissingPerms.push('instagram_content_publish');
  }

  const fbMissingPerms: string[] = [];
  if (granted.length > 0) {
    if (!granted.includes('pages_show_list')) fbMissingPerms.push('pages_show_list');
    if (!granted.includes('pages_manage_posts')) fbMissingPerms.push('pages_manage_posts');
  }

  const sanitizedMetaPages = (credentialsStore.meta?.availablePages || []).map((p) => ({
    pageId: p.pageId,
    pageName: p.pageName,
    igId: p.igId || null,
    igUsername: p.igUsername || null,
    igName: p.igName || null,
  }));

  const devUrl = process.env.APP_URL || 'https://ais-dev-npoqrverfcqcjlu2tp2k2n-840734708977.asia-east1.run.app';
  const sharedUrl = 'https://ais-pre-npoqrverfcqcjlu2tp2k2n-840734708977.asia-east1.run.app';

  const validNumericIgId = isNumericId(credentialsStore.instagram?.igId)
    ? credentialsStore.instagram!.igId.trim()
    : null;

  return {
    instagram: {
      connected: Boolean(
        validNumericIgId &&
          (credentialsStore.meta?.userAccessToken || credentialsStore.facebook?.pageAccessToken) &&
          !metaExpired
      ),
      igId: validNumericIgId,
      username: validNumericIgId ? credentialsStore.instagram?.username || null : null,
      name: validNumericIgId ? credentialsStore.instagram?.name || null : null,
      pageId: validNumericIgId ? credentialsStore.instagram?.pageId || null : null,
      pageName: validNumericIgId ? credentialsStore.instagram?.pageName || null : null,
      eligibleForPublishing: validNumericIgId ? Boolean(credentialsStore.instagram?.eligibleForPublishing) : false,
      publishingQuota: validNumericIgId ? credentialsStore.instagram?.publishingQuota || null : null,
      tokenExpired: metaExpired,
      expiresAt: credentialsStore.meta?.expiresAt || null,
      missingPermissions: igMissingPerms,
      grantedPermissions: granted,
      availableAccounts: sanitizedMetaPages.filter((p) => p.igId && isNumericId(p.igId)),
    },
    facebook: {
      connected: Boolean(
        credentialsStore.facebook?.pageId &&
          (credentialsStore.facebook?.pageAccessToken || credentialsStore.meta?.userAccessToken) &&
          !metaExpired
      ),
      pageId: credentialsStore.facebook?.pageId || null,
      pageName: credentialsStore.facebook?.pageName || null,
      tokenExpired: metaExpired,
      expiresAt: credentialsStore.meta?.expiresAt || null,
      missingPermissions: fbMissingPerms,
      grantedPermissions: granted,
      availablePages: sanitizedMetaPages,
    },
    linkedin: {
      connected: Boolean(credentialsStore.linkedin?.accessToken && credentialsStore.linkedin?.authorUrn && !liExpired),
      authorUrn: credentialsStore.linkedin?.authorUrn || null,
      authorName: credentialsStore.linkedin?.authorName || null,
      handle: credentialsStore.linkedin?.handle || null,
      tokenExpired: liExpired,
      expiresAt: credentialsStore.linkedin?.expiresAt || null,
      scopes: credentialsStore.linkedin?.scopes || [],
      availableTargets: credentialsStore.linkedin?.availableTargets || [],
    },
    oauthConfigured: {
      meta: Boolean(
        (process.env.META_CLIENT_ID || credentialsStore.metaOAuthApp?.clientId) &&
          (process.env.META_CLIENT_SECRET || credentialsStore.metaOAuthApp?.clientSecret)
      ),
      metaSource:
        process.env.META_CLIENT_ID && process.env.META_CLIENT_SECRET
          ? 'env'
          : credentialsStore.metaOAuthApp?.clientId && credentialsStore.metaOAuthApp?.clientSecret
          ? 'server_store'
          : 'none',
      linkedin: Boolean(
        (process.env.LINKEDIN_CLIENT_ID || credentialsStore.linkedinOAuthApp?.clientId) &&
          (process.env.LINKEDIN_CLIENT_SECRET || credentialsStore.linkedinOAuthApp?.clientSecret)
      ),
      linkedinSource:
        process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
          ? 'env'
          : credentialsStore.linkedinOAuthApp?.clientId && credentialsStore.linkedinOAuthApp?.clientSecret
          ? 'server_store'
          : 'none',
    },
    redirectUris: {
      dev: `${devUrl}/auth/callback`,
      shared: `${sharedUrl}/auth/callback`,
    },
  };
}

export function getPublishHistory(): PublishingReport[] {
  return publishHistory;
}

export function recordPublishReport(report: PublishingReport) {
  publishHistory.unshift(report);
  if (publishHistory.length > 50) {
    publishHistory = publishHistory.slice(0, 50);
  }
  saveHistoryToDisk();
}

export function clearPlatformCredentials(platform: 'instagram' | 'facebook' | 'linkedin' | 'meta' | 'all') {
  if (platform === 'all' || platform === 'meta') {
    delete credentialsStore.meta;
    delete credentialsStore.instagram;
    delete credentialsStore.facebook;
  }
  if (platform === 'instagram') {
    delete credentialsStore.instagram;
    if (!credentialsStore.facebook?.pageId) {
      delete credentialsStore.meta;
    }
  }
  if (platform === 'facebook') {
    delete credentialsStore.facebook;
    if (!credentialsStore.instagram?.igId) {
      delete credentialsStore.meta;
    }
  }
  if (platform === 'all' || platform === 'linkedin') {
    delete credentialsStore.linkedin;
  }
  saveCredentialsToDisk();
}

export function selectTargetAccount(platform: SocialPlatform, targetId: string) {
  if (platform === 'facebook') {
    const page = (credentialsStore.meta?.availablePages || []).find((p) => p.pageId === targetId);
    if (!page) {
      throw new Error(`Facebook Page ID "${targetId}" was not found in your authorized pages.`);
    }
    credentialsStore.facebook = {
      pageId: page.pageId,
      pageName: page.pageName,
      pageAccessToken: page.pageAccessToken || credentialsStore.meta?.userAccessToken || '',
    };
  } else if (platform === 'instagram') {
    const page = (credentialsStore.meta?.availablePages || []).find((p) => p.igId === targetId);
    if (!page || !page.igId) {
      throw new Error(`Instagram Business Account "${targetId}" was not found in your authorized accounts.`);
    }
    credentialsStore.instagram = {
      igId: page.igId,
      username: page.igUsername || page.igName || 'Instagram Business',
      name: page.igName,
      pageId: page.pageId,
      pageName: page.pageName,
    };
  } else if (platform === 'linkedin') {
    if (!credentialsStore.linkedin?.accessToken) {
      throw new Error('LinkedIn account is not connected yet.');
    }
    const found = (credentialsStore.linkedin.availableTargets || []).find((t) => t.urn === targetId);
    credentialsStore.linkedin.authorUrn = targetId.trim();
    if (found) {
      credentialsStore.linkedin.authorName = found.name;
    }
  }
  saveCredentialsToDisk();
  return getSanitizedConnectionStatus();
}

export function getOAuthConfig(platform: 'instagram' | 'facebook' | 'linkedin') {
  if (platform === 'linkedin') {
    return {
      clientId: process.env.LINKEDIN_CLIENT_ID || credentialsStore.linkedinOAuthApp?.clientId || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || credentialsStore.linkedinOAuthApp?.clientSecret || '',
    };
  }
  return {
    clientId: process.env.META_CLIENT_ID || credentialsStore.metaOAuthApp?.clientId || '',
    clientSecret: process.env.META_CLIENT_SECRET || credentialsStore.metaOAuthApp?.clientSecret || '',
  };
}

export function saveOAuthAppCredentials(platform: 'meta' | 'linkedin', clientId: string, clientSecret: string) {
  if (platform === 'meta') {
    credentialsStore.metaOAuthApp = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  } else {
    credentialsStore.linkedinOAuthApp = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  }
  saveCredentialsToDisk();
}

// ==========================================
// TRANSIENT ERROR RETRY UTILITY (SAFE LIMITS)
// ==========================================
interface ClassifiedError {
  isTransient: boolean;
  errorCode: string;
  errorMessage: string;
  reason: string;
  requiredAction: string;
}

function classifyHttpOrNetworkError(platform: SocialPlatform, err: any): ClassifiedError {
  const msg = err?.message || String(err);
  const code = String(err?.code || err?.errorCode || '');

  // Network / Timeout
  if (
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    msg.includes('fetch failed') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('timeout')
  ) {
    return {
      isTransient: true,
      errorCode: 'NETWORK_TIMEOUT',
      errorMessage: msg,
      reason: `Temporary network timeout while contacting ${platform} API.`,
      requiredAction: 'Check internet connectivity and try again if not already posted.',
    };
  }

  return {
    isTransient: false,
    errorCode: code || 'UNKNOWN_ERROR',
    errorMessage: msg,
    reason: err?.reason || `Unexpected error during ${platform} publishing.`,
    requiredAction: err?.requiredAction || `Verify your ${platform} account connection and permissions.`,
  };
}

function classifyMetaGraphError(platform: 'instagram' | 'facebook', metaError: any, httpStatus?: number): ClassifiedError {
  const code = Number(metaError?.code || 0);
  const subcode = Number(metaError?.error_subcode || 0);
  const msg = metaError?.message || `Meta Graph API returned HTTP ${httpStatus || 400}`;

  // Token expired / invalid (Code 190 or HTTP 401)
  if (code === 190 || httpStatus === 401) {
    return {
      isTransient: false,
      errorCode: `META_190_${subcode || 0}`,
      errorMessage: msg,
      reason: 'Meta Access Token is invalid or has expired.',
      requiredAction: `Reconnect ${platform === 'instagram' ? 'Instagram' : 'Facebook'} via OAuth or enter a fresh valid Access Token with publishing permissions.`,
    };
  }

  // Missing Permissions (Codes 10, 200, 230 or HTTP 403)
  if (code === 10 || code === 200 || code === 230 || httpStatus === 403) {
    const needed =
      platform === 'instagram'
        ? 'instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement'
        : 'pages_manage_posts, pages_read_engagement, pages_show_list';
    return {
      isTransient: false,
      errorCode: `META_PERM_${code}`,
      errorMessage: msg,
      reason: `Missing required ${platform} API permissions or Page role access.`,
      requiredAction: `Grant permissions (${needed}) in Meta OAuth / Graph API Explorer and ensure you are an Admin of the connected Facebook Page.`,
    };
  }

  // Image fetch / format issue on Instagram
  if (code === 36000 || code === 36001 || code === 36003 || code === 9004 || msg.toLowerCase().includes('image') || msg.toLowerCase().includes('media')) {
    return {
      isTransient: false,
      errorCode: `META_MEDIA_${code || 400}`,
      errorMessage: msg,
      reason: 'Meta servers could not fetch or decode the poster image URL (Instagram requires a publicly accessible JPEG without login).',
      requiredAction: 'Ensure the poster renders as JPEG (< 8 MB) and the public image host is reachable by Meta crawlers.',
    };
  }

  // Transient Meta API server / rate-limit errors (Codes 1, 2, 4, 17, 341, 613 or HTTP 429/5xx)
  if ([1, 2, 4, 17, 341, 613].includes(code) || httpStatus === 429 || (httpStatus && httpStatus >= 500)) {
    return {
      isTransient: true,
      errorCode: `META_TRANSIENT_${code || httpStatus}`,
      errorMessage: msg,
      reason: 'Temporary Meta API rate limit or upstream service interruption.',
      requiredAction: 'Wait a minute and retry publishing.',
    };
  }

  return {
    isTransient: false,
    errorCode: `META_${code || httpStatus || 'ERR'}`,
    errorMessage: msg,
    reason: metaError?.error_user_msg || msg,
    requiredAction: `Check ${platform} account setup and Meta Graph API error details.`,
  };
}

function classifyLinkedInError(httpStatus: number, body: any): ClassifiedError {
  const msg = body?.message || body?.error_description || `LinkedIn API returned HTTP ${httpStatus}`;

  if (httpStatus === 401) {
    return {
      isTransient: false,
      errorCode: 'LINKEDIN_401',
      errorMessage: msg,
      reason: 'LinkedIn OAuth Access Token is invalid or expired.',
      requiredAction: 'Reconnect your LinkedIn account or update LINKEDIN_ACCESS_TOKEN.',
    };
  }

  if (httpStatus === 403) {
    return {
      isTransient: false,
      errorCode: 'LINKEDIN_403',
      errorMessage: msg,
      reason: 'LinkedIn token lacks required posting permission (w_member_social or w_organization_social).',
      requiredAction: 'Authorize the app with "openid profile w_member_social" ("Share on LinkedIn" product enabled in LinkedIn Developer Portal).',
    };
  }

  if (httpStatus === 429 || httpStatus >= 500) {
    return {
      isTransient: true,
      errorCode: `LINKEDIN_${httpStatus}`,
      errorMessage: msg,
      reason: 'Temporary LinkedIn API rate limit or server error.',
      requiredAction: 'Wait briefly and retry publishing.',
    };
  }

  return {
    isTransient: false,
    errorCode: `LINKEDIN_${httpStatus}`,
    errorMessage: msg,
    reason: msg,
    requiredAction: 'Verify LinkedIn author URN (urn:li:person:... or urn:li:organization:...) and image format.',
  };
}

async function withTransientRetry<T>(
  platform: SocialPlatform,
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<{ result?: T; error?: ClassifiedError; attempts: number }> {
  let attempts = 0;
  while (attempts <= maxRetries) {
    attempts++;
    try {
      const result = await operation();
      return { result, attempts };
    } catch (err: any) {
      const classified: ClassifiedError = err?.isClassified
        ? err
        : classifyHttpOrNetworkError(platform, err);

      if (!classified.isTransient || attempts > maxRetries) {
        return { error: classified, attempts };
      }

      const delayMs = attempts === 1 ? 1200 : 2500;
      console.warn(`[SocialPublisher] Transient error on ${platform} (attempt ${attempts}/${maxRetries + 1}), retrying in ${delayMs}ms: ${classified.errorMessage}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return {
    error: {
      isTransient: false,
      errorCode: 'RETRY_EXHAUSTED',
      errorMessage: 'Maximum retry attempts exceeded.',
      reason: 'Service remained unavailable.',
      requiredAction: 'Retry later.',
    },
    attempts,
  };
}

const IG_LINK_REQUIRED_STEPS =
  '1) Open Instagram app -> Profile -> Settings and privacy -> Account type and tools -> Switch to Professional account (Business or Creator). 2) Open your Facebook Page -> Settings -> Linked Accounts -> Instagram -> Connect your Instagram Professional account. 3) Re-authorize Meta OAuth with instagram_basic, instagram_content_publish, pages_show_list, and pages_read_engagement permissions, then click Auto-Detect Numeric IG ID.';

export async function verifyInstagramPublishingEligibility(igId: string, token: string): Promise<{
  id: string;
  username: string;
  name?: string;
  eligibleForPublishing: boolean;
  publishingQuota?: { quotaUsage?: number; quotaTotal?: number };
}> {
  if (!isNumericId(igId)) {
    throw Object.assign(new Error(`"${igId}" is not a valid numeric Instagram Account ID.`), {
      isClassified: true,
      isTransient: false,
      errorCode: 'INVALID_IG_ACCOUNT_ID',
      reason: 'Instagram Graph API requires a numeric IG User ID, never a username.',
      requiredAction: IG_LINK_REQUIRED_STEPS,
    });
  }

  const profileResp = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igId}?fields=id,username,name&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const profileData = await profileResp.json();
  if (!profileResp.ok || profileData.error) {
    const classified = classifyMetaGraphError('instagram', profileData.error || { message: `HTTP ${profileResp.status}` }, profileResp.status);
    throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
  }

  if (!isNumericId(profileData.id)) {
    throw Object.assign(new Error('Meta Graph API returned a non-numeric Instagram ID.'), {
      isClassified: true,
      isTransient: false,
      errorCode: 'INVALID_IG_ACCOUNT_ID',
      reason: 'Resolved instagram_business_account ID failed numeric validation.',
      requiredAction: IG_LINK_REQUIRED_STEPS,
    });
  }

  // Verify official content_publishing_limit endpoint to prove account & token are eligible for Content Publishing
  const limitResp = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${profileData.id}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const limitData = await limitResp.json();
  if (!limitResp.ok || limitData.error) {
    const classified = classifyMetaGraphError('instagram', limitData.error || { message: `HTTP ${limitResp.status}` }, limitResp.status);
    throw Object.assign(new Error(classified.errorMessage), {
      isClassified: true,
      ...classified,
      reason: `Instagram account @${profileData.username || profileData.id} failed content publishing eligibility check: ${classified.errorMessage}`,
      requiredAction:
        'Ensure your Instagram account is a Business/Creator account linked to the Facebook Page and the Meta token has instagram_basic + instagram_content_publish permissions.',
    });
  }

  const quotaEntry = Array.isArray(limitData?.data) ? limitData.data[0] : limitData;
  return {
    id: String(profileData.id),
    username: profileData.username || profileData.name || 'Instagram Business',
    name: profileData.name,
    eligibleForPublishing: true,
    publishingQuota: {
      quotaUsage: typeof quotaEntry?.quota_usage === 'number' ? quotaEntry.quota_usage : undefined,
      quotaTotal: typeof quotaEntry?.config?.quota_total === 'number' ? quotaEntry.config.quota_total : undefined,
    },
  };
}

export async function resolveAndVerifyInstagramAccount(options?: {
  explicitPageId?: string;
  explicitIgId?: string;
}) {
  const token =
    credentialsStore.meta?.userAccessToken ||
    credentialsStore.facebook?.pageAccessToken ||
    process.env.META_ACCESS_TOKEN ||
    '';

  if (!token) {
    throw Object.assign(new Error('No authorized Meta Access Token is stored on the server.'), {
      isClassified: true,
      isTransient: false,
      errorCode: 'MISSING_CREDENTIALS',
      reason: 'A valid Meta Access Token is required to query your connected Facebook Page and linked Instagram Business account.',
      requiredAction: 'Click "Connect Instagram" (or paste a Meta Graph API token) to authorize access.',
    });
  }

  // Ensure any stale non-numeric IG ID is removed immediately
  if (credentialsStore.instagram?.igId && !isNumericId(credentialsStore.instagram.igId)) {
    delete credentialsStore.instagram;
    saveCredentialsToDisk();
  }

  const targetPageId =
    options?.explicitPageId?.trim() ||
    credentialsStore.facebook?.pageId ||
    process.env.FACEBOOK_PAGE_ID?.trim() ||
    '';

  return verifyAndSaveMetaToken({
    accessToken: token,
    explicitPageId: targetPageId || undefined,
    explicitIgId: options?.explicitIgId?.trim() || undefined,
    targetPlatform: 'instagram',
    strictRequireLinkedIg: true,
  });
}

export async function verifyAndSaveMetaToken(params: {
  accessToken: string;
  explicitIgId?: string;
  explicitPageId?: string;
  expiresAt?: number;
  targetPlatform?: 'instagram' | 'facebook' | 'both';
  strictRequireLinkedIg?: boolean;
}) {
  const token = params.accessToken.trim();
  if (!token) {
    throw new Error('Meta Access Token is required.');
  }

  // Clear invalid non-numeric stored IG ID up front
  if (credentialsStore.instagram?.igId && !isNumericId(credentialsStore.instagram.igId)) {
    delete credentialsStore.instagram;
  }

  let detectedExpiresAt = params.expiresAt;
  const metaApp = getOAuthConfig('facebook');

  // Optional debug_token call when App ID & Secret are known to detect exact expiration
  if (!detectedExpiresAt && metaApp.clientId && metaApp.clientSecret) {
    try {
      const dbgResp = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${metaApp.clientId}|${metaApp.clientSecret}`)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const dbgData = await dbgResp.json();
      if (dbgData?.data?.expires_at && Number(dbgData.data.expires_at) > 0) {
        detectedExpiresAt = Number(dbgData.data.expires_at);
      }
      if (dbgData?.data && dbgData.data.is_valid === false) {
        const classified = classifyMetaGraphError('facebook', { code: 190, message: 'Token debug confirmed token is invalid or expired.' }, 401);
        throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
      }
    } catch (e: any) {
      if (e?.isClassified) throw e;
    }
  }

  // 1. Check granted & declined permissions (User tokens support /me/permissions; Page tokens may return code 100/2500)
  const grantedPermissions: string[] = [];
  const declinedPermissions: string[] = [];
  const permResp = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const permData = await permResp.json();
  if (permData.error) {
    const code = Number(permData.error?.code || 0);
    // Reject immediately on invalid/expired token (190 / 401), but allow direct Page tokens that don't expose /me/permissions
    if (code === 190 || permResp.status === 401) {
      const classified = classifyMetaGraphError('facebook', permData.error, permResp.status);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
  } else if (Array.isArray(permData.data)) {
    for (const p of permData.data) {
      if (p.status === 'granted') grantedPermissions.push(p.permission);
      else declinedPermissions.push(p.permission);
    }
  }

  // 2. Discover Facebook Pages (+ Page Access Tokens) and linked instagram_business_account numeric IDs
  const rawPagesList: any[] = [];
  const accountsResp = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const accountsData = await accountsResp.json();
  if (accountsData.error) {
    const code = Number(accountsData.error?.code || 0);
    if (code === 190 || accountsResp.status === 401) {
      const classified = classifyMetaGraphError('facebook', accountsData.error, accountsResp.status);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
  } else if (Array.isArray(accountsData.data)) {
    rawPagesList.push(...accountsData.data);
  }

  // Fallback A: Query explicit/connected Facebook Page directly for instagram_business_account
  const knownPageId = params.explicitPageId?.trim() || credentialsStore.facebook?.pageId || process.env.FACEBOOK_PAGE_ID?.trim();
  if (knownPageId && !rawPagesList.some((p) => p.id === knownPageId)) {
    try {
      const pageResp = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(knownPageId)}?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const pageData = await pageResp.json();
      if (pageResp.ok && !pageData.error && pageData.id) {
        rawPagesList.push(pageData);
      }
    } catch {
      // continue
    }
  }

  // Fallback B: If token is a direct Page Access Token, /me?fields=id,name,instagram_business_account returns the Page!
  if (rawPagesList.length === 0) {
    try {
      const mePageResp = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const mePageData = await mePageResp.json();
      if (mePageResp.ok && !mePageData.error && mePageData.id && mePageData.instagram_business_account) {
        rawPagesList.push({ ...mePageData, access_token: token });
      }
    } catch {
      // continue
    }
  }

  const pages: DiscoveredMetaPage[] = [];
  let chosenPage: any = null;
  let chosenIg: any = null;
  const normalizedExplicitIg = params.explicitIgId ? params.explicitIgId.trim().replace(/^@/, '') : '';

  for (const page of rawPagesList) {
    const igAcc = page.instagram_business_account;
    const validIgId = isNumericId(igAcc?.id) ? String(igAcc.id).trim() : undefined;

    pages.push({
      pageId: String(page.id),
      pageName: page.name || 'Facebook Page',
      pageAccessToken: page.access_token || undefined,
      igId: validIgId,
      igUsername: igAcc?.username || igAcc?.name,
      igName: igAcc?.name,
    });

    if (params.explicitPageId && page.id === params.explicitPageId) {
      chosenPage = page;
    } else if (!chosenPage) {
      chosenPage = page;
    }

    const matchesExplicitIg =
      normalizedExplicitIg &&
      validIgId &&
      (validIgId === normalizedExplicitIg ||
        (igAcc?.username && igAcc.username.toLowerCase() === normalizedExplicitIg.toLowerCase()));

    if (matchesExplicitIg) {
      chosenIg = { ...igAcc, id: validIgId, pageId: page.id, pageName: page.name };
    } else if (!chosenIg && validIgId) {
      chosenIg = { ...igAcc, id: validIgId, pageId: page.id, pageName: page.name };
    }
  }

  // Store Meta token & discovered Pages strictly on server
  credentialsStore.meta = {
    userAccessToken: token,
    expiresAt: detectedExpiresAt,
    grantedPermissions,
    declinedPermissions,
    availablePages: pages,
    updatedAt: new Date().toISOString(),
  };

  const target = params.targetPlatform || 'both';

  if (target === 'facebook' || target === 'both' || !credentialsStore.facebook?.pageId) {
    if (chosenPage) {
      credentialsStore.facebook = {
        pageId: String(chosenPage.id),
        pageName: chosenPage.name || 'Facebook Page',
        pageAccessToken: chosenPage.access_token || token,
      };
    } else if (params.explicitPageId && isNumericId(params.explicitPageId)) {
      credentialsStore.facebook = {
        pageId: params.explicitPageId.trim(),
        pageName: 'Connected Facebook Page',
        pageAccessToken: token,
      };
    }
  }

  let eligibilityError: any = null;
  if (target === 'instagram' || target === 'both' || !isNumericId(credentialsStore.instagram?.igId)) {
    let candidateIgId = chosenIg?.id ? String(chosenIg.id) : '';
    let candidatePageId = chosenIg?.pageId ? String(chosenIg.pageId) : undefined;
    let candidatePageName = chosenIg?.pageName ? String(chosenIg.pageName) : undefined;

    if (!candidateIgId && normalizedExplicitIg) {
      if (!isNumericId(normalizedExplicitIg)) {
        eligibilityError = Object.assign(
          new Error(
            `"${params.explicitIgId}" is an Instagram username, not a numeric Graph API Account ID, and no Facebook Page linked to that Instagram account was found.`
          ),
          {
            isClassified: true,
            isTransient: false,
            errorCode: 'INVALID_IG_ACCOUNT_ID',
            reason: 'Instagram Graph API requires a numeric Instagram Business/Creator Account ID retrieved from your Facebook Page\'s instagram_business_account field.',
            requiredAction: IG_LINK_REQUIRED_STEPS,
          }
        );
      } else {
        candidateIgId = normalizedExplicitIg;
      }
    }

    if (candidateIgId && isNumericId(candidateIgId)) {
      try {
        const igTokenForCheck = chosenIg?.pageId
          ? pages.find((p) => p.pageId === chosenIg.pageId)?.pageAccessToken || token
          : token;
        const verifiedIg = await verifyInstagramPublishingEligibility(candidateIgId, igTokenForCheck);
        credentialsStore.instagram = {
          igId: verifiedIg.id,
          username: verifiedIg.username,
          name: verifiedIg.name || chosenIg?.name,
          pageId: candidatePageId,
          pageName: candidatePageName,
          eligibleForPublishing: verifiedIg.eligibleForPublishing,
          publishingQuota: verifiedIg.publishingQuota,
        };
      } catch (err: any) {
        delete credentialsStore.instagram;
        eligibilityError = err;
      }
    } else if (!eligibilityError && (target === 'instagram' || params.strictRequireLinkedIg)) {
      delete credentialsStore.instagram;
      const requiredIgScopes = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'];
      const missingScopes =
        grantedPermissions.length > 0
          ? requiredIgScopes.filter((s) => !grantedPermissions.includes(s))
          : [];

      const hasPermissionGap = missingScopes.length > 0;
      const errMessage = hasPermissionGap
        ? `Meta Access Token is missing required permissions (${missingScopes.join(', ')}). Granted scopes: [${grantedPermissions.join(', ')}]. Cannot read Facebook Pages or instagram_business_account.`
        : rawPagesList.length > 0
        ? `Connected Facebook Page (${rawPagesList.map((p) => p.name || p.id).join(', ')}) does not have an Instagram Business or Creator account linked in its instagram_business_account field.`
        : 'No Facebook Pages with a linked Instagram Business/Creator account were returned by Meta Graph API.';

      eligibilityError = Object.assign(new Error(errMessage), {
        isClassified: true,
        isTransient: false,
        errorCode: hasPermissionGap ? 'MISSING_PERMISSIONS' : 'NO_LINKED_IG_ACCOUNT',
        reason: hasPermissionGap
          ? 'The stored Meta token only includes basic profile access and lacks Page + Instagram Graph API publishing scopes.'
          : 'Instagram Graph API content publishing is only available to Instagram Business or Creator accounts linked to a Facebook Page.',
        requiredAction: IG_LINK_REQUIRED_STEPS,
      });
    }
  }

  saveCredentialsToDisk();

  if (eligibilityError && (params.strictRequireLinkedIg || normalizedExplicitIg || target === 'instagram')) {
    throw eligibilityError;
  }

  return {
    pages: pages.map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      hasPageToken: Boolean(p.pageAccessToken),
      igId: p.igId,
      igUsername: p.igUsername,
    })),
    grantedPermissions,
    declinedPermissions,
    status: getSanitizedConnectionStatus(),
  };
}

export async function verifyAndSaveLinkedInToken(params: {
  accessToken: string;
  explicitAuthorUrn?: string;
  expiresAt?: number;
  scopes?: string[];
}) {
  const token = params.accessToken.trim();
  if (!token) {
    throw new Error('LinkedIn Access Token is required.');
  }

  let authorUrn = (params.explicitAuthorUrn || '').trim();
  let authorName = 'LinkedIn Profile';
  let handle = '';
  const availableTargets: DiscoveredLinkedInOrg[] = [];

  // Try OpenID Connect userinfo first (standard modern LinkedIn OAuth scope: openid profile email w_member_social)
  const userInfoResp = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (userInfoResp.ok) {
    const info = await userInfoResp.json();
    const personUrn = info.sub ? `urn:li:person:${info.sub}` : '';
    const displayName = info.name || `${info.given_name || ''} ${info.family_name || ''}`.trim() || authorName;
    if (personUrn) {
      availableTargets.push({ urn: personUrn, name: `${displayName} (Personal Profile)`, type: 'person' });
      if (!authorUrn) authorUrn = personUrn;
    }
    authorName = displayName;
    handle = info.email || info.sub || '';
  } else if (userInfoResp.status === 401) {
    const errBody = await userInfoResp.json().catch(() => ({}));
    const classified = classifyLinkedInError(401, errBody);
    throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
  } else {
    // Fallback to /v2/me for legacy r_liteprofile tokens
    const meResp = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!meResp.ok) {
      const errBody = await meResp.json().catch(() => ({}));
      const classified = classifyLinkedInError(meResp.status, errBody);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
    const meData = await meResp.json();
    const personUrn = meData.id ? `urn:li:person:${meData.id}` : '';
    const displayName = `${meData.localizedFirstName || ''} ${meData.localizedLastName || ''}`.trim() || authorName;
    if (personUrn) {
      availableTargets.push({ urn: personUrn, name: `${displayName} (Personal Profile)`, type: 'person' });
      if (!authorUrn) authorUrn = personUrn;
    }
    authorName = displayName;
  }

  // Optionally discover Admin Organizations if organization permission was granted
  try {
    const orgResp = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName)))',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (orgResp.ok) {
      const orgData = await orgResp.json();
      if (Array.isArray(orgData.elements)) {
        for (const el of orgData.elements) {
          const org = el['organization~'];
          const orgUrn = el.organization || (org?.id ? `urn:li:organization:${org.id}` : '');
          if (orgUrn) {
            availableTargets.push({
              urn: orgUrn,
              name: org?.localizedName ? `${org.localizedName} (Company Page)` : orgUrn,
              type: 'organization',
            });
          }
        }
      }
    }
  } catch {
    // Optional org discovery; personal posting works without w_organization_social
  }

  if (authorUrn && !availableTargets.some((t) => t.urn === authorUrn)) {
    availableTargets.unshift({
      urn: authorUrn,
      name: authorUrn.includes(':organization:') ? 'LinkedIn Organization' : authorName,
      type: authorUrn.includes(':organization:') ? 'organization' : 'person',
    });
  }

  if (!authorUrn) {
    throw Object.assign(
      new Error('Could not determine LinkedIn Author URN (urn:li:person:... or urn:li:organization:...).'),
      {
        isClassified: true,
        isTransient: false,
        errorCode: 'LINKEDIN_NO_URN',
        reason: 'Token lacks "profile"/"openid" scope or no organization URN was supplied.',
        requiredAction: 'Include "openid profile w_member_social" scopes or enter your Author URN manually.',
      }
    );
  }

  credentialsStore.linkedin = {
    accessToken: token,
    expiresAt: params.expiresAt,
    authorUrn,
    authorName,
    handle,
    scopes: params.scopes,
    availableTargets,
    updatedAt: new Date().toISOString(),
  };

  saveCredentialsToDisk();

  return {
    authorUrn,
    authorName,
    handle,
    availableTargets,
    status: getSanitizedConnectionStatus(),
  };
}

export interface PlatformVerificationResult {
  ok: boolean;
  state: 'CONNECTED' | 'EXPIRED' | 'MISSING_PERMISSIONS' | 'NOT_CONNECTED' | 'ERROR';
  errorCode?: string;
  message: string;
  requiredAction?: string;
  accountLabel?: string;
}

export async function verifyPlatformConnection(
  target: SocialPlatform | 'all'
): Promise<{
  results: Partial<Record<SocialPlatform, PlatformVerificationResult>>;
  status: ReturnType<typeof getSanitizedConnectionStatus>;
}> {
  const platformsToCheck: SocialPlatform[] =
    target === 'all' ? ['instagram', 'facebook', 'linkedin'] : [target];
  const results: Partial<Record<SocialPlatform, PlatformVerificationResult>> = {};

  for (const plat of platformsToCheck) {
    if (plat === 'instagram') {
      const token =
        credentialsStore.meta?.userAccessToken ||
        credentialsStore.facebook?.pageAccessToken ||
        process.env.META_ACCESS_TOKEN ||
        '';
      if (!token) {
        results.instagram = {
          ok: false,
          state: 'NOT_CONNECTED',
          errorCode: 'MISSING_CREDENTIALS',
          message: 'No Meta OAuth token is connected for Instagram.',
          requiredAction: 'Click "Connect Instagram" to authorize Meta OAuth.',
        };
        continue;
      }

      try {
        const res = await resolveAndVerifyInstagramAccount({
          explicitPageId: credentialsStore.facebook?.pageId,
          explicitIgId: credentialsStore.instagram?.igId,
        });
        results.instagram = {
          ok: Boolean(res.status.instagram.connected),
          state: res.status.instagram.connected ? 'CONNECTED' : 'NOT_CONNECTED',
          message: res.status.instagram.connected
            ? `Verified @${res.status.instagram.username} (Numeric IG ID: ${res.status.instagram.igId}) is active and eligible for Graph API publishing.`
            : 'Meta token verified, but no eligible Instagram Business/Creator account is linked.',
          accountLabel: res.status.instagram.username ? `@${res.status.instagram.username}` : undefined,
        };
      } catch (err: any) {
        const code = err?.errorCode || 'IG_VERIFY_FAILED';
        const isExpired = String(code).includes('190') || String(code).includes('EXPIRED');
        const isPerms = String(code).includes('PERM');
        if (isExpired && credentialsStore.meta) {
          credentialsStore.meta.expiresAt = Math.floor(Date.now() / 1000) - 60;
          saveCredentialsToDisk();
        }
        results.instagram = {
          ok: false,
          state: isExpired ? 'EXPIRED' : isPerms ? 'MISSING_PERMISSIONS' : 'ERROR',
          errorCode: code,
          message: err?.errorMessage || err?.message || 'Instagram live verification failed.',
          requiredAction: err?.requiredAction,
        };
      }
    } else if (plat === 'facebook') {
      const userToken = credentialsStore.meta?.userAccessToken || process.env.META_ACCESS_TOKEN || '';
      const pageId = credentialsStore.facebook?.pageId || '';
      const pageToken = credentialsStore.facebook?.pageAccessToken || userToken;

      if (!userToken && (!pageId || !pageToken)) {
        results.facebook = {
          ok: false,
          state: 'NOT_CONNECTED',
          errorCode: 'MISSING_CREDENTIALS',
          message: 'No Facebook Page or Meta OAuth token is connected.',
          requiredAction: 'Click "Connect Facebook" to authorize your Facebook Page via Meta OAuth.',
        };
        continue;
      }

      try {
        if (userToken) {
          await verifyAndSaveMetaToken({
            accessToken: userToken,
            explicitPageId: pageId || undefined,
            targetPlatform: 'facebook',
          });
        }

        const activeFb = credentialsStore.facebook;
        if (!activeFb?.pageId || !activeFb?.pageAccessToken) {
          const granted = credentialsStore.meta?.grantedPermissions || [];
          const missingFbPerms = ['pages_show_list', 'pages_manage_posts'].filter(
            (p) => granted.length > 0 && !granted.includes(p)
          );
          results.facebook = {
            ok: false,
            state: missingFbPerms.length > 0 ? 'MISSING_PERMISSIONS' : 'NOT_CONNECTED',
            errorCode: missingFbPerms.length > 0 ? 'MISSING_PERMISSIONS' : 'NO_FACEBOOK_PAGE',
            message:
              missingFbPerms.length > 0
                ? `Meta token is missing required Facebook permissions: ${missingFbPerms.join(', ')}.`
                : 'No managed Facebook Page was returned by Meta Graph API.',
            requiredAction:
              'Reconnect Facebook via OAuth and approve pages_show_list, pages_read_engagement, and pages_manage_posts.',
          };
          continue;
        }

        // Live Page check
        const pageCheckResp = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(activeFb.pageId)}?fields=id,name&access_token=${encodeURIComponent(activeFb.pageAccessToken)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const pageCheckData = await pageCheckResp.json();
        if (!pageCheckResp.ok || pageCheckData.error) {
          const classified = classifyMetaGraphError(
            'facebook',
            pageCheckData.error || { message: `HTTP ${pageCheckResp.status}` },
            pageCheckResp.status
          );
          results.facebook = {
            ok: false,
            state: classified.errorCode.includes('190') ? 'EXPIRED' : 'ERROR',
            errorCode: classified.errorCode,
            message: classified.errorMessage,
            requiredAction: classified.requiredAction,
          };
        } else {
          const granted = credentialsStore.meta?.grantedPermissions || [];
          const missingFb = ['pages_show_list', 'pages_manage_posts'].filter(
            (p) => granted.length > 0 && !granted.includes(p)
          );
          if (missingFb.length > 0) {
            results.facebook = {
              ok: false,
              state: 'MISSING_PERMISSIONS',
              errorCode: 'MISSING_PERMISSIONS',
              message: `Page "${pageCheckData.name || activeFb.pageName}" reachable, but missing permissions: ${missingFb.join(', ')}.`,
              requiredAction: 'Reconnect Facebook and grant pages_manage_posts + pages_show_list permissions.',
              accountLabel: pageCheckData.name || activeFb.pageName,
            };
          } else {
            results.facebook = {
              ok: true,
              state: 'CONNECTED',
              message: `Verified Facebook Page "${pageCheckData.name || activeFb.pageName}" (${pageCheckData.id}) is active and ready to publish.`,
              accountLabel: pageCheckData.name || activeFb.pageName,
            };
          }
        }
      } catch (err: any) {
        const code = err?.errorCode || 'FB_VERIFY_FAILED';
        const isExpired = String(code).includes('190');
        if (isExpired && credentialsStore.meta) {
          credentialsStore.meta.expiresAt = Math.floor(Date.now() / 1000) - 60;
          saveCredentialsToDisk();
        }
        results.facebook = {
          ok: false,
          state: isExpired ? 'EXPIRED' : 'ERROR',
          errorCode: code,
          message: err?.errorMessage || err?.message || 'Facebook live verification failed.',
          requiredAction: err?.requiredAction,
        };
      }
    } else if (plat === 'linkedin') {
      const li = credentialsStore.linkedin;
      if (!li?.accessToken) {
        results.linkedin = {
          ok: false,
          state: 'NOT_CONNECTED',
          errorCode: 'MISSING_CREDENTIALS',
          message: 'No LinkedIn OAuth token is connected.',
          requiredAction: 'Click "Connect LinkedIn" to authorize LinkedIn OAuth 2.0.',
        };
        continue;
      }

      try {
        const res = await verifyAndSaveLinkedInToken({
          accessToken: li.accessToken,
          explicitAuthorUrn: li.authorUrn || undefined,
          expiresAt: li.expiresAt,
          scopes: li.scopes,
        });
        const hasMemberScope =
          !li.scopes || li.scopes.length === 0 || li.scopes.includes('w_member_social') || li.scopes.includes('w_organization_social');
        if (!hasMemberScope) {
          results.linkedin = {
            ok: false,
            state: 'MISSING_PERMISSIONS',
            errorCode: 'LINKEDIN_MISSING_SCOPE',
            message: `LinkedIn profile "${res.authorName}" verified, but missing posting scope (w_member_social).`,
            requiredAction: 'Reconnect LinkedIn with openid, profile, email, and w_member_social scopes.',
            accountLabel: res.authorName,
          };
        } else {
          results.linkedin = {
            ok: true,
            state: 'CONNECTED',
            message: `Verified LinkedIn account "${res.authorName}" (${res.authorUrn}) is active.`,
            accountLabel: res.authorName,
          };
        }
      } catch (err: any) {
        const code = err?.errorCode || 'LINKEDIN_VERIFY_FAILED';
        const isExpired = code === 'LINKEDIN_401';
        if (isExpired && credentialsStore.linkedin) {
          credentialsStore.linkedin.expiresAt = Math.floor(Date.now() / 1000) - 60;
          saveCredentialsToDisk();
        }
        results.linkedin = {
          ok: false,
          state: isExpired ? 'EXPIRED' : code === 'LINKEDIN_403' ? 'MISSING_PERMISSIONS' : 'ERROR',
          errorCode: code,
          message: err?.errorMessage || err?.message || 'LinkedIn live verification failed.',
          requiredAction: err?.requiredAction,
        };
      }
    }
  }

  return {
    results,
    status: getSanitizedConnectionStatus(),
  };
}

// ==========================================
// IMAGE PREPARATION & ACCESSIBILITY VERIFICATION
// ==========================================
export interface PreparedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  ext: 'jpg' | 'png';
  sizeBytes: number;
  publicUrl?: string;
  publicHost?: string;
}

function detectImageMagic(buffer: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  return null;
}

export async function prepareImageBuffer(input: {
  dataUrl?: string;
  imageUrl?: string;
}): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: 'jpg' | 'png'; sizeBytes: number }> {
  let buffer: Buffer;
  let declaredMime = '';

  if (input.dataUrl && input.dataUrl.startsWith('data:')) {
    const matches = input.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 poster dataUrl format.');
    }
    declaredMime = matches[1].toLowerCase();
    buffer = Buffer.from(matches[2], 'base64');
  } else if (input.imageUrl && input.imageUrl.startsWith('http')) {
    const resp = await fetch(input.imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) {
      throw new Error(`Failed to fetch poster image URL (HTTP ${resp.status}).`);
    }
    declaredMime = (resp.headers.get('content-type') || '').toLowerCase();
    buffer = Buffer.from(await resp.arrayBuffer());
  } else {
    throw new Error('No rendered poster image (dataUrl or imageUrl) was provided.');
  }

  const sizeBytes = buffer.length;
  if (sizeBytes < 1000) {
    throw new Error(`Poster image buffer is too small or empty (${sizeBytes} bytes).`);
  }
  if (sizeBytes > 8 * 1024 * 1024) {
    throw new Error(`Poster image size ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB exceeds Instagram's 8 MB limit.`);
  }

  const detectedMime = detectImageMagic(buffer);
  if (!detectedMime) {
    throw new Error(
      `Invalid binary image format (detected content-type: ${declaredMime || 'unknown'}). Platforms require valid JPEG or PNG binary image data, not SVG or HTML.`
    );
  }

  return {
    buffer,
    mimeType: detectedMime,
    ext: detectedMime === 'image/jpeg' ? 'jpg' : 'png',
    sizeBytes,
  };
}

export async function hostAndVerifyPublicImage(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png',
  ext: 'jpg' | 'png',
  localCacheCallback?: (buf: Buffer, mime: string) => string
): Promise<{ publicUrl: string; source: string }> {
  const verifyDirectImageUrl = async (url: string): Promise<boolean> => {
    const verifyRes = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      signal: AbortSignal.timeout(10000),
    });
    const ct = (verifyRes.headers.get('content-type') || '').toLowerCase();
    return verifyRes.ok && ct.startsWith('image/');
  };

  // 1. Primary: uguu.se (free public HTTPS CDN, 3h retention, max 128 MB, raw image/* verified)
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('files[]', blob, `postpilot_${Date.now()}.${ext}`);

    const uploadRes = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });

    if (uploadRes.ok) {
      const json = await uploadRes.json().catch(() => null);
      const publicUrl = json?.files?.[0]?.url;
      if (typeof publicUrl === 'string' && publicUrl.startsWith('https://')) {
        if (await verifyDirectImageUrl(publicUrl)) {
          return { publicUrl, source: 'uguu.se (Verified public HTTPS image/jpeg)' };
        }
      }
    }
  } catch (err: any) {
    console.warn('[SocialPublisher] uguu.se upload failed:', err.message);
  }

  // 2. Secondary: x0.at (free public HTTPS CDN, direct raw image/* URL, max 512 MB)
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('file', blob, `postpilot_${Date.now()}.${ext}`);

    const uploadRes = await fetch('https://x0.at/', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });

    if (uploadRes.ok) {
      const publicUrl = (await uploadRes.text()).trim();
      if (publicUrl.startsWith('https://') && (await verifyDirectImageUrl(publicUrl))) {
        return { publicUrl, source: 'x0.at (Verified public HTTPS image/jpeg)' };
      }
    }
  } catch (err: any) {
    console.warn('[SocialPublisher] x0.at upload failed:', err.message);
  }

  // 3. Tertiary: Litterbox Catbox (in case residential/non-blocked egress is used)
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('reqtype', 'fileupload');
    form.append('time', '24h');
    form.append('fileToUpload', blob, `postpilot_${Date.now()}.${ext}`);

    const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(12000),
    });

    if (uploadRes.ok) {
      const publicUrl = (await uploadRes.text()).trim();
      if (publicUrl.startsWith('https://') && (await verifyDirectImageUrl(publicUrl))) {
        return { publicUrl, source: 'Litterbox Catbox (Verified public HTTPS)' };
      }
    }
  } catch (err: any) {
    console.warn('[SocialPublisher] Litterbox upload failed:', err.message);
  }

  // 4. Local server URL ONLY if external unauthenticated fetch actually returns image/* (never accept IAP HTML!)
  if (localCacheCallback) {
    const localUrl = localCacheCallback(buffer, mimeType);
    try {
      if (await verifyDirectImageUrl(localUrl)) {
        return { publicUrl: localUrl, source: 'Local Public App Endpoint (Verified image/*)' };
      }
    } catch {
      // Fall through
    }
  }

  throw new Error(
    'Public HTTPS image URL could not be verified (image hosts unreachable and preview APP_URL requires browser authentication).'
  );
}

// ==========================================
// 1. INSTAGRAM OFFICIAL GRAPH API PUBLISHER
// ==========================================
export async function publishToInstagram(params: {
  caption: string;
  publicImageUrl?: string;
  mimeType: 'image/jpeg' | 'image/png';
}): Promise<PlatformPublishResult> {
  const token = credentialsStore.meta?.userAccessToken || credentialsStore.facebook?.pageAccessToken || '';
  let igId = credentialsStore.instagram?.igId || '';
  let accountLabel = credentialsStore.instagram?.username ? `@${credentialsStore.instagram.username}` : undefined;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!token) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'MISSING_CREDENTIALS',
      errorMessage: 'Meta Access Token is not connected.',
      reason: 'No authorized Meta Access Token is stored on the server.',
      requiredAction: 'Click "Connect Instagram" in Connected Accounts and authorize Meta OAuth.',
      attempts: 0,
      accountLabel,
    };
  }

  // Automatically resolve numeric Instagram Business Account ID from connected Facebook Page if missing or invalid
  if (!isNumericId(igId)) {
    try {
      await resolveAndVerifyInstagramAccount();
      igId = credentialsStore.instagram?.igId || '';
      accountLabel = credentialsStore.instagram?.username ? `@${credentialsStore.instagram.username}` : igId || undefined;
    } catch (err: any) {
      return {
        platform: 'instagram',
        status: 'FAILED',
        errorCode: err.errorCode || 'NO_LINKED_IG_ACCOUNT',
        errorMessage: err.errorMessage || err.message || 'Could not retrieve numeric Instagram Business Account ID from connected Facebook Page.',
        reason: err.reason || 'A linked Instagram Business or Creator account is required for Content Publishing.',
        requiredAction: err.requiredAction || IG_LINK_REQUIRED_STEPS,
        attempts: 0,
        accountLabel,
      };
    }
  }

  if (!isNumericId(igId)) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'INVALID_IG_ACCOUNT_ID',
      errorMessage: 'Valid numeric Instagram Business/Creator Account ID could not be resolved.',
      reason: 'Instagram Graph API only accepts numeric Instagram Account IDs from facebook_page.instagram_business_account.',
      requiredAction: IG_LINK_REQUIRED_STEPS,
      attempts: 0,
      accountLabel,
    };
  }

  if (credentialsStore.meta?.expiresAt && credentialsStore.meta.expiresAt < nowSec) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'Meta Access Token for Instagram has expired.',
      reason: `Token expired at ${new Date(credentialsStore.meta.expiresAt * 1000).toLocaleString()}.`,
      requiredAction: 'Click "Reconnect" on Instagram in Connected Accounts to re-authorize Meta OAuth.',
      attempts: 0,
      accountLabel,
    };
  }

  // Official Instagram Graph API photo container requirement: JPEG only!
  if (params.mimeType !== 'image/jpeg') {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'UNSUPPORTED_FORMAT',
      errorMessage: `Instagram Graph API requires JPEG format (received ${params.mimeType}).`,
      reason: 'Official Instagram Content Publishing API only supports JPEG images for feed photo posts.',
      requiredAction: 'Ensure poster canvas exports as image/jpeg before publishing.',
      attempts: 0,
      accountLabel,
    };
  }

  if (!params.publicImageUrl || !params.publicImageUrl.startsWith('https://')) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'PUBLIC_IMAGE_UNAVAILABLE',
      errorMessage: 'A verified public HTTPS image URL is required for Instagram Graph API.',
      reason: 'Instagram servers must fetch the JPEG over public HTTPS without authentication.',
      requiredAction: 'Ensure public image hosting succeeded and retry.',
      attempts: 0,
      accountLabel,
    };
  }

  // Step 1: Create IG Media Container
  const containerOp = await withTransientRetry('instagram', async () => {
    const formBody = new URLSearchParams({
      image_url: params.publicImageUrl!,
      caption: params.caption,
      access_token: token,
    });
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      const classified = classifyMetaGraphError('instagram', data.error || { message: `HTTP ${resp.status}` }, resp.status);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
    if (!data.id) {
      throw new Error('Instagram Graph API did not return a media creation_id.');
    }
    return data.id as string;
  });

  if (containerOp.error || !containerOp.result) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: containerOp.error?.errorCode,
      errorMessage: containerOp.error?.errorMessage,
      reason: containerOp.error?.reason,
      requiredAction: containerOp.error?.requiredAction,
      attempts: containerOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  const creationId = containerOp.result;

  // Step 2: Poll container status until FINISHED (Instagram processes image asynchronously)
  let containerReady = false;
  let lastStatusDetail = '';
  for (let poll = 0; poll < 14; poll++) {
    try {
      const statusResp = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const statusData = await statusResp.json();
      if (statusData.status_code === 'FINISHED') {
        containerReady = true;
        break;
      }
      if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
        return {
          platform: 'instagram',
          status: 'FAILED',
          errorCode: `IG_CONTAINER_${statusData.status_code}`,
          errorMessage: statusData.status || `Instagram media container ${statusData.status_code}.`,
          reason: 'Instagram failed to download or process the poster JPEG from the public image URL.',
          requiredAction: 'Check that the poster is valid JPEG (<8MB, aspect ratio 4:5 to 1.91:1) and publicly accessible.',
          attempts: containerOp.attempts,
          captionUsed: params.caption,
          accountLabel,
        };
      }
      lastStatusDetail = statusData.status_code || 'IN_PROGRESS';
    } catch {
      // continue polling
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!containerReady) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: 'IG_CONTAINER_TIMEOUT',
      errorMessage: `Media container ${creationId} did not finish processing in time (last status: ${lastStatusDetail || 'unknown'}).`,
      reason: 'Instagram media ingestion timed out before publishing.',
      requiredAction: 'Wait a moment and retry.',
      attempts: containerOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  // Step 3: Publish Container
  const publishOp = await withTransientRetry('instagram', async () => {
    const formBody = new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    });
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      const classified = classifyMetaGraphError('instagram', data.error || { message: `HTTP ${resp.status}` }, resp.status);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
    return data.id as string;
  });

  if (publishOp.error || !publishOp.result) {
    return {
      platform: 'instagram',
      status: 'FAILED',
      errorCode: publishOp.error?.errorCode,
      errorMessage: publishOp.error?.errorMessage,
      reason: publishOp.error?.reason,
      requiredAction: publishOp.error?.requiredAction,
      attempts: containerOp.attempts + publishOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  const mediaId = publishOp.result;

  // Step 4: Retrieve real permalink URL (numeric mediaId is NOT the /p/ shortcode!)
  let permalink: string | undefined;
  try {
    const permResp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?fields=id,permalink&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const permData = await permResp.json();
    if (permData?.permalink) {
      permalink = permData.permalink;
    }
  } catch {
    // permalink optional if media_publish succeeded
  }

  return {
    platform: 'instagram',
    status: 'SUCCESS',
    postId: mediaId,
    postUrl: permalink || `https://www.instagram.com/${credentialsStore.instagram?.username || ''}`,
    attempts: Math.max(containerOp.attempts, publishOp.attempts),
    captionUsed: params.caption,
    accountLabel,
  };
}

// ==========================================
// 2. FACEBOOK PAGE OFFICIAL GRAPH API PUBLISHER
// ==========================================
export async function publishToFacebook(params: {
  caption: string;
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  ext: 'jpg' | 'png';
}): Promise<PlatformPublishResult> {
  const fb = credentialsStore.facebook;
  const userToken = credentialsStore.meta?.userAccessToken || '';
  const pageId = fb?.pageId || '';
  let pageToken = fb?.pageAccessToken || '';
  const accountLabel = fb?.pageName || pageId || undefined;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!pageId || (!pageToken && !userToken)) {
    return {
      platform: 'facebook',
      status: 'FAILED',
      errorCode: 'MISSING_CREDENTIALS',
      errorMessage: 'Facebook Page ID or Page Access Token is not connected.',
      reason: 'No connected Facebook Page credentials found on the server.',
      requiredAction: 'Click "Connect Facebook" in Connected Accounts and authorize your Facebook Page with pages_manage_posts permission.',
      attempts: 0,
      accountLabel,
    };
  }

  if (credentialsStore.meta?.expiresAt && credentialsStore.meta.expiresAt < nowSec && (!pageToken || pageToken === userToken)) {
    return {
      platform: 'facebook',
      status: 'FAILED',
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'Meta Access Token for Facebook Page has expired.',
      reason: `Token expired at ${new Date(credentialsStore.meta.expiresAt * 1000).toLocaleString()}.`,
      requiredAction: 'Click "Reconnect" on Facebook in Connected Accounts to obtain a fresh Page Access Token.',
      attempts: 0,
      accountLabel,
    };
  }

  // If we only have a User Token (or pageToken equals userToken), ensure we exchange for a real Page Access Token
  if (!pageToken || pageToken === userToken) {
    try {
      const pResp = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=access_token,name&access_token=${encodeURIComponent(userToken)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const pData = await pResp.json();
      if (pData.access_token) {
        pageToken = pData.access_token;
        if (credentialsStore.facebook) {
          credentialsStore.facebook.pageAccessToken = pageToken;
          if (pData.name) credentialsStore.facebook.pageName = pData.name;
          saveCredentialsToDisk();
        }
      }
    } catch {
      pageToken = pageToken || userToken;
    }
  }

  const uploadOp = await withTransientRetry('facebook', async () => {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(params.imageBuffer)], { type: params.mimeType });
    form.append('source', blob, `poster_${Date.now()}.${params.ext}`);
    form.append('message', params.caption);
    form.append('published', 'true');
    form.append('access_token', pageToken);

    const resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20000),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) {
      const classified = classifyMetaGraphError('facebook', data.error || { message: `HTTP ${resp.status}` }, resp.status);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
    return {
      photoId: data.id as string,
      postId: (data.post_id || data.id) as string,
    };
  });

  if (uploadOp.error || !uploadOp.result) {
    return {
      platform: 'facebook',
      status: 'FAILED',
      errorCode: uploadOp.error?.errorCode,
      errorMessage: uploadOp.error?.errorMessage,
      reason: uploadOp.error?.reason,
      requiredAction: uploadOp.error?.requiredAction,
      attempts: uploadOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  const { postId } = uploadOp.result;

  // Retrieve real permalink_url
  let permalinkUrl = `https://www.facebook.com/${postId}`;
  try {
    const linkResp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(pageToken)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const linkData = await linkResp.json();
    if (linkData?.permalink_url) {
      permalinkUrl = linkData.permalink_url;
    }
  } catch {
    // keep constructed post URL
  }

  return {
    platform: 'facebook',
    status: 'SUCCESS',
    postId,
    postUrl: permalinkUrl,
    attempts: uploadOp.attempts,
    captionUsed: params.caption,
    accountLabel,
  };
}

// ==========================================
// 3. LINKEDIN OFFICIAL REST IMAGES + POSTS API PUBLISHER
// ==========================================
export async function publishToLinkedIn(params: {
  caption: string;
  altText: string;
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
}): Promise<PlatformPublishResult> {
  const li = credentialsStore.linkedin;
  const token = li?.accessToken || '';
  const authorUrn = li?.authorUrn || '';
  const accountLabel = li?.authorName || authorUrn || undefined;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!token || !authorUrn) {
    return {
      platform: 'linkedin',
      status: 'FAILED',
      errorCode: 'MISSING_CREDENTIALS',
      errorMessage: 'LinkedIn Access Token or Author URN is not connected.',
      reason: 'No connected LinkedIn OAuth credentials are stored on the server.',
      requiredAction: 'Click "Connect LinkedIn" in Connected Accounts to authorize LinkedIn OAuth 2.0 with openid, profile, and w_member_social permissions.',
      attempts: 0,
      accountLabel,
    };
  }

  if (li?.expiresAt && li.expiresAt < nowSec) {
    return {
      platform: 'linkedin',
      status: 'FAILED',
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'LinkedIn OAuth Access Token has expired.',
      reason: `Token expired at ${new Date(li.expiresAt * 1000).toLocaleString()}.`,
      requiredAction: 'Click "Reconnect" on LinkedIn in Connected Accounts to refresh authorization.',
      attempts: 0,
      accountLabel,
    };
  }

  const candidateVersions = getRecentLinkedInVersions();
  let versionIdx = 0;
  let activeVersion = candidateVersions[0];

  // Step 1: Initialize Image Upload (/rest/images?action=initializeUpload)
  const initOp = await withTransientRetry('linkedin', async () => {
    const resp = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': activeVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.status === 426 && versionIdx + 1 < candidateVersions.length) {
      versionIdx++;
      activeVersion = candidateVersions[versionIdx];
      throw Object.assign(new Error('LinkedIn API version retry'), {
        isClassified: true,
        isTransient: true,
        errorCode: 'LINKEDIN_VERSION',
        errorMessage: data?.message || `Retrying with LinkedIn-Version ${activeVersion}`,
        reason: 'LinkedIn API version header negotiation',
        requiredAction: 'Automatic retry',
      });
    }

    if (!resp.ok || !data?.value?.uploadUrl || !data?.value?.image) {
      const classified = classifyLinkedInError(resp.status, data);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }

    return {
      uploadUrl: data.value.uploadUrl as string,
      imageUrn: data.value.image as string,
    };
  });

  if (initOp.error || !initOp.result) {
    return {
      platform: 'linkedin',
      status: 'FAILED',
      errorCode: initOp.error?.errorCode,
      errorMessage: initOp.error?.errorMessage,
      reason: initOp.error?.reason,
      requiredAction: initOp.error?.requiredAction,
      attempts: initOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  const { uploadUrl, imageUrn } = initOp.result;

  // Step 2: Upload binary image to LinkedIn uploadUrl
  const putOp = await withTransientRetry('linkedin', async () => {
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': params.mimeType,
      },
      body: new Uint8Array(params.imageBuffer),
      signal: AbortSignal.timeout(25000),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const classified = classifyLinkedInError(resp.status, errBody);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }
    return true;
  });

  if (putOp.error) {
    return {
      platform: 'linkedin',
      status: 'FAILED',
      errorCode: putOp.error.errorCode,
      errorMessage: putOp.error.errorMessage,
      reason: putOp.error.reason,
      requiredAction: putOp.error.requiredAction,
      attempts: initOp.attempts + putOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  // Step 3: Create LinkedIn Post (/rest/posts)
  const postOp = await withTransientRetry('linkedin', async () => {
    const resp = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': activeVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: params.caption,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: {
            altText: params.altText.slice(0, 200),
            id: imageUrn,
          },
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const classified = classifyLinkedInError(resp.status, errBody);
      throw Object.assign(new Error(classified.errorMessage), { isClassified: true, ...classified });
    }

    const postUrn = resp.headers.get('x-restli-id') || resp.headers.get('x-linkedin-id') || '';
    return postUrn;
  });

  if (postOp.error) {
    return {
      platform: 'linkedin',
      status: 'FAILED',
      errorCode: postOp.error.errorCode,
      errorMessage: postOp.error.errorMessage,
      reason: postOp.error.reason,
      requiredAction: postOp.error.requiredAction,
      attempts: initOp.attempts + putOp.attempts + postOp.attempts,
      captionUsed: params.caption,
      accountLabel,
    };
  }

  const postUrn = postOp.result || '';
  const postUrl = postUrn
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`
    : 'https://www.linkedin.com/feed/';

  return {
    platform: 'linkedin',
    status: 'SUCCESS',
    postId: postUrn || imageUrn,
    postUrl,
    attempts: Math.max(initOp.attempts, putOp.attempts, postOp.attempts),
    captionUsed: params.caption,
    accountLabel,
  };
}

// ==========================================
// UNIFIED AUTOMATIC PUBLISHING WORKFLOW & REPORT BUILDER
// ==========================================
export function formatPublishingReportText(report: PublishingReport): string {
  const entries: Array<[string, PlatformPublishResult]> = [
    ['Instagram', report.platforms.instagram],
    ['Facebook', report.platforms.facebook],
    ['LinkedIn', report.platforms.linkedin],
  ];
  const activeEntries = entries.filter(([, res]) => res.status !== 'SKIPPED');
  const displayEntries = activeEntries.length > 0 ? activeEntries : entries;
  const headerSuffix =
    displayEntries.length === 1 ? ` (${displayEntries[0][0].toUpperCase()})` : '';

  const lines: string[] = [
    `SOCIAL MEDIA PUBLISHING REPORT${headerSuffix}`,
    '',
    `Poster Generation: ${report.posterGeneration.status}${report.posterGeneration.detail ? ` (${report.posterGeneration.detail})` : ''}`,
    '',
    ...displayEntries.map(([label, res]) => `${label}: ${res.status}`),
    '',
  ];

  for (const [label, res] of displayEntries) {
    if (res.status === 'SUCCESS') {
      lines.push(`${label} Post URL: ${res.postUrl || 'Published (URL not returned)'}`);
    } else if (res.status === 'FAILED') {
      lines.push(
        `${label} Error [${res.errorCode || 'ERROR'}]: ${res.errorMessage || 'Failed'} | Reason: ${res.reason || 'Unknown'} | Action: ${res.requiredAction || 'Check credentials'}`
      );
    } else {
      lines.push(`${label}: Skipped (not selected)`);
    }
  }

  return lines.join('\n');
}

export async function runSocialPublishingWorkflow(params: {
  topic: string;
  dataUrl?: string;
  imageUrl?: string;
  platformDataUrls?: Partial<Record<SocialPlatform, string>>;
  platforms?: SocialPlatform[];
  captions: {
    instagram: string;
    facebook: string;
    linkedin: string;
  };
  localCacheCallback?: (buf: Buffer, mime: string) => string;
}): Promise<PublishingReport> {
  const selectedPlatforms = new Set<SocialPlatform>(
    params.platforms && params.platforms.length > 0 ? params.platforms : ['instagram', 'facebook', 'linkedin']
  );

  type PreparedBuffer = { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: 'jpg' | 'png'; sizeBytes: number };
  const preparedByPlatform: Partial<Record<SocialPlatform, PreparedBuffer>> = {};
  let basePrepared: PreparedBuffer | null = null;
  let globalPrepError: string | null = null;

  try {
    const primarySource =
      params.dataUrl ||
      params.platformDataUrls?.instagram ||
      params.platformDataUrls?.facebook ||
      params.platformDataUrls?.linkedin;

    if (primarySource || params.imageUrl) {
      basePrepared = await prepareImageBuffer({ dataUrl: primarySource, imageUrl: params.imageUrl });
    }

    for (const plat of ['instagram', 'facebook', 'linkedin'] as SocialPlatform[]) {
      if (!selectedPlatforms.has(plat)) continue;
      const customDataUrl = params.platformDataUrls?.[plat];
      if (customDataUrl && customDataUrl !== primarySource) {
        preparedByPlatform[plat] = await prepareImageBuffer({ dataUrl: customDataUrl });
      } else if (basePrepared) {
        preparedByPlatform[plat] = basePrepared;
      }
    }

    if (!basePrepared && Object.keys(preparedByPlatform).length === 0) {
      throw new Error('No rendered poster image was provided for publishing.');
    }
  } catch (err: any) {
    globalPrepError = err.message || 'Poster image could not be prepared.';
  }

  if (globalPrepError) {
    const failedReport: PublishingReport = {
      id: `rep_${Date.now()}`,
      timestamp: new Date().toISOString(),
      topic: params.topic,
      posterGeneration: {
        status: 'FAILED',
        detail: globalPrepError,
      },
      platforms: {
        instagram: {
          platform: 'instagram',
          status: selectedPlatforms.has('instagram') ? 'FAILED' : 'SKIPPED',
          errorCode: 'IMAGE_PREP_FAILED',
          errorMessage: globalPrepError,
          reason: 'Poster image could not be prepared or verified.',
          requiredAction: 'Ensure poster canvas renders a valid JPEG image under 8 MB.',
          attempts: 0,
        },
        facebook: {
          platform: 'facebook',
          status: selectedPlatforms.has('facebook') ? 'FAILED' : 'SKIPPED',
          errorCode: 'IMAGE_PREP_FAILED',
          errorMessage: globalPrepError,
          reason: 'Poster image could not be prepared or verified.',
          requiredAction: 'Ensure poster canvas renders a valid JPEG/PNG image.',
          attempts: 0,
        },
        linkedin: {
          platform: 'linkedin',
          status: selectedPlatforms.has('linkedin') ? 'FAILED' : 'SKIPPED',
          errorCode: 'IMAGE_PREP_FAILED',
          errorMessage: globalPrepError,
          reason: 'Poster image could not be prepared or verified.',
          requiredAction: 'Ensure poster canvas renders a valid JPEG/PNG image.',
          attempts: 0,
        },
      },
      formattedReport: '',
    };
    failedReport.formattedReport = formatPublishingReportText(failedReport);
    publishHistory.unshift(failedReport);
    saveHistoryToDisk();
    return failedReport;
  }

  const igPrepared = preparedByPlatform.instagram || basePrepared!;
  const fbPrepared = preparedByPlatform.facebook || basePrepared!;
  const liPrepared = preparedByPlatform.linkedin || basePrepared!;

  // Host public HTTPS URL only if Instagram is selected (Facebook & LinkedIn use direct binary uploads!)
  let publicImageUrl: string | undefined;
  let publicImageHost: string | undefined;
  let igHostingError: string | undefined;

  if (selectedPlatforms.has('instagram')) {
    try {
      const hosted = await hostAndVerifyPublicImage(
        igPrepared.buffer,
        igPrepared.mimeType,
        igPrepared.ext,
        params.localCacheCallback
      );
      publicImageUrl = hosted.publicUrl;
      publicImageHost = hosted.source;
    } catch (err: any) {
      igHostingError = err.message;
    }
  }

  // Execute each platform independently so failure in one NEVER stops the others!
  const igPromise: Promise<PlatformPublishResult> = !selectedPlatforms.has('instagram')
    ? Promise.resolve({ platform: 'instagram', status: 'SKIPPED', attempts: 0 })
    : igHostingError && credentialsStore.instagram?.igId && credentialsStore.meta?.userAccessToken
    ? Promise.resolve({
        platform: 'instagram',
        status: 'FAILED',
        errorCode: 'PUBLIC_IMAGE_HOST_FAILED',
        errorMessage: igHostingError,
        reason: 'Instagram Graph API requires a publicly reachable HTTPS image URL without authentication.',
        requiredAction: 'Check outbound HTTPS connectivity to image hosts or deploy with a public APP_URL.',
        attempts: 0,
        captionUsed: params.captions.instagram,
      })
    : publishToInstagram({
        caption: params.captions.instagram,
        publicImageUrl,
        mimeType: igPrepared.mimeType,
      });

  const fbPromise: Promise<PlatformPublishResult> = !selectedPlatforms.has('facebook')
    ? Promise.resolve({ platform: 'facebook', status: 'SKIPPED', attempts: 0 })
    : publishToFacebook({
        caption: params.captions.facebook,
        imageBuffer: fbPrepared.buffer,
        mimeType: fbPrepared.mimeType,
        ext: fbPrepared.ext,
      });

  const liPromise: Promise<PlatformPublishResult> = !selectedPlatforms.has('linkedin')
    ? Promise.resolve({ platform: 'linkedin', status: 'SKIPPED', attempts: 0 })
    : publishToLinkedIn({
        caption: params.captions.linkedin,
        altText: params.topic,
        imageBuffer: liPrepared.buffer,
        mimeType: liPrepared.mimeType,
      });

  const [igResult, fbResult, liResult] = await Promise.all([igPromise, fbPromise, liPromise]);
  const primarySummaryPrepared = basePrepared || igPrepared || fbPrepared || liPrepared;

  const report: PublishingReport = {
    id: `rep_${Date.now()}`,
    timestamp: new Date().toISOString(),
    topic: params.topic,
    posterGeneration: {
      status: 'SUCCESS',
      detail: `${primarySummaryPrepared.mimeType} ${(primarySummaryPrepared.sizeBytes / 1024).toFixed(1)} KB`,
      imageHost: publicImageHost,
      sizeBytes: primarySummaryPrepared.sizeBytes,
      format: primarySummaryPrepared.mimeType,
    },
    platforms: {
      instagram: igResult,
      facebook: fbResult,
      linkedin: liResult,
    },
    formattedReport: '',
  };

  report.formattedReport = formatPublishingReportText(report);
  publishHistory.unshift(report);
  saveHistoryToDisk();
  return report;
}
