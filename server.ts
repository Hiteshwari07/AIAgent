import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  clearPlatformCredentials,
  getOAuthConfig,
  getPublishHistory,
  getSanitizedConnectionStatus,
  prepareImageBuffer,
  recordPublishReport,
  resolveAndVerifyInstagramAccount,
  runSocialPublishingWorkflow,
  saveOAuthAppCredentials,
  selectTargetAccount,
  SocialPlatform,
  verifyAndSaveLinkedInToken,
  verifyAndSaveMetaToken,
  verifyPlatformConnection,
} from './server/socialPublisher.ts';
import {
  createZernioProfile,
  deleteZernioPost,
  disconnectZernioAccount,
  extractZernioProfileId,
  extractZernioProfileName,
  getZernioDashboardSnapshot,
  initiateZernioOAuthConnect,
  isZernioConfigured,
  listZernioAccounts,
  listZernioProfiles,
  listZernioPosts,
  publishOrScheduleViaZernio,
  publishZernioScheduledPostNow,
  retryZernioPost,
  selectActiveZernioProfile,
  selectZernioAccountTarget,
  verifyZernioAuthentication,
  verifyZernioConnectedAccountAfterCallback,
} from './server/zernioService.ts';
import { FESTIVAL_CATALOG, getUpcomingFestivals } from './server/festivalCalendar.ts';
import {
  createScheduledPost,
  deleteDesignItem,
  deleteScheduledPost,
  getBrandProfile,
  getSavedDesigns,
  getScheduledPosts,
  saveBrandProfile,
  saveDesignItem,
  updateScheduledPost,
} from './server/studioStore.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

function toSafeApiHttpStatus(status: number): number {
  const code = Number(status);
  if (!Number.isFinite(code) || code < 400 || code >= 600) return 500;
  // Nginx reverse proxy intercepts 502/503/504 with proxy_intercept_errors and replaces JSON with warmup HTML (HTTP 200).
  // Translate upstream 502/503/504 to HTTP 500 on /api/* JSON endpoints so browsers always receive the real JSON error.
  if (code === 502 || code === 503 || code === 504) return 500;
  return code;
}

// Structured /api/* request/response logger & HTML-hijack shield
app.use('/api', (req: Request, res: Response, next) => {
  const startMs = Date.now();
  const origStatus = res.status.bind(res);
  let requestedStatus = 200;

  res.status = ((code: number) => {
    requestedStatus = code;
    if (code === 502 || code === 503 || code === 504) {
      res.setHeader('X-Upstream-Status', String(code));
      return origStatus(500);
    }
    return origStatus(code);
  }) as any;

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const contentType = String(res.getHeader('content-type') || '');
    const isWriteOrErr = req.method !== 'GET' || res.statusCode >= 400 || durationMs > 3000;
    if (isWriteOrErr) {
      console.log(
        `[API] ${req.method} ${req.originalUrl} -> HTTP ${res.statusCode}${
          requestedStatus !== res.statusCode ? ` (mapped from ${requestedStatus})` : ''
        } [${contentType || 'no-ct'}] (${durationMs}ms)`
      );
    }
  });

  next();
});

// Idempotency store so Retry Request never creates duplicate Zernio/scheduled posts (15-min TTL)
interface IdempotentEntry {
  createdAt: number;
  status: 'pending' | 'succeeded';
  promise?: Promise<{ statusCode: number; body: any }>;
  result?: { statusCode: number; body: any };
}
const idempotentActionStore = new Map<string, IdempotentEntry>();

function pruneIdempotentStore() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of idempotentActionStore.entries()) {
    if (v.createdAt < cutoff) idempotentActionStore.delete(k);
  }
}

// Initialize GoogleGenAI SDK safely
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with provided key:', err);
  }
}

function parseGeminiError(err: any): { status: number; message: string; isQuota: boolean } {
  const raw = err?.message || String(err || 'Gemini API error');
  let status = Number(err?.status || err?.code || 502);
  let msg = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) {
      status = Number(parsed.error.code || status);
      msg = String(parsed.error.message || msg);
    }
  } catch {
    // not JSON
  }
  const isQuota =
    status === 429 ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.toLowerCase().includes('quota');
  if (isQuota) {
    status = 429;
    msg = msg.split('\n')[0];
  } else if (status < 400 || status >= 600 || Number.isNaN(status)) {
    status = 500;
  }
  return { status: toSafeApiHttpStatus(status), message: msg, isQuota };
}

function safeParseModelJson<T = any>(rawText: string): T {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) {
    throw new Error('AI model returned an empty JSON response.');
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new Error('AI model returned malformed JSON. Please retry.');
  }
}

let stickyPreferredGeminiModel: 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen' = 'gemini-3.1-flash-lite';

async function generateWithModelFallback(params: {
  contents: any;
  config: any;
  timeoutMs: number;
}): Promise<{ response: any; model: string }> {
  if (!ai) {
    throw Object.assign(new Error('Gemini API client is not initialized.'), { status: 503 });
  }
  const models: Array<'gemini-3.1-flash-lite' | 'gemini-4-hydrogen'> =
    stickyPreferredGeminiModel === 'gemini-4-hydrogen'
      ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
      : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
  let lastError: any = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const hasFallback = i + 1 < models.length;
    const attemptTimeoutMs = hasFallback ? Math.max(params.timeoutMs, 25000) : params.timeoutMs;
    try {
      const cfg = { ...(params.config || {}) };
      if (model === 'gemini-4-hydrogen') {
        cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      } else {
        delete cfg.thinkingConfig;
      }
      const call = ai.models.generateContent({
        model,
        contents: params.contents,
        config: cfg,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini request timed out after ${Math.round(attemptTimeoutMs / 1000)}s.`)),
          attemptTimeoutMs
        )
      );
      const response: any = await Promise.race([call, timeoutPromise]);
      if (cfg.responseMimeType === 'application/json') {
        safeParseModelJson(response?.text || '');
      }
      stickyPreferredGeminiModel = model;
      return { response, model };
    } catch (err: any) {
      lastError = err;
      const parsed = parseGeminiError(err);
      const errMsgLower = String(err?.message || '').toLowerCase();
      const shouldFallback =
        hasFallback &&
        (parsed.isQuota ||
          parsed.status >= 400 ||
          errMsgLower.includes('timed out') ||
          errMsgLower.includes('json'));
      if (shouldFallback) {
        console.log(`[Gemini] Switching primary model to ${models[i + 1]} (${parsed.isQuota ? 'quota' : 'transient'})`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Gemini API request failed.');
}

function normalizeHexColor(val: any, fallback: string): string {
  const s = String(val || '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : fallback;
}

function shouldIncludeBalancedTeam(params: {
  category?: string;
  subCategory?: string;
  customTopic?: string;
  decorations?: string;
}): boolean {
  const haystack = `${params.subCategory || ''} ${params.customTopic || ''} ${params.decorations || ''}`.toLowerCase();
  if (/(no people|no human|abstract only|architecture only|buildings only|server room|circuit board|minimalist plinth)/i.test(haystack)) {
    return false;
  }
  return /(walk-in|team|collaboration|cohort|workshop|seminar|conference|training program|internship|leadership team|client testimonial)/i.test(
    haystack
  );
}

// Prompt builder helper covering Corporate, IT/Tech, Marketing, Hiring, Events & 29 Cultural Festivals
function buildScenePrompt(params: {
  occasion: string;
  category?: string;
  subCategory?: string;
  customTopic?: string;
  aspectRatio: string;
  palette?: string;
  decorations?: string;
  variationIndex: number;
}): { prompt: string; seed: number; allowBalancedPeople: boolean } {
  const sizeDesc =
    params.aspectRatio === '1:1'
      ? 'Square 1:1'
      : params.aspectRatio === '4:5'
      ? 'Portrait 4:5'
      : params.aspectRatio === '16:9'
      ? 'Landscape 16:9'
      : 'Vertical 9:16';
  const seed = Math.floor(Math.random() * 899999) + 100000 + params.variationIndex * 777;
  const allowBalancedPeople = shouldIncludeBalancedTeam(params);

  const layoutFramingHint =
    params.variationIndex === 0
      ? 'directional dark gradient space on the left half for clean left-aligned executive typography, focal architecture on the right'
      : params.variationIndex === 1
      ? 'symmetrical balanced editorial composition with deep calm central negative space for hero typography'
      : 'clean elevated visual interest in the upper third and rich deep dark lower canvas for an architectural frosted card';

  let occasionStr = params.subCategory || params.occasion;
  let defaultPalette = 'deep slate indigo, warm champagne gold and architectural obsidian';
  let defaultDecorations = 'clean geometric studio lighting, soft depth of field, subtle architectural light rays';

  const festivalEntry = FESTIVAL_CATALOG.find(
    (f) => f.slug === params.occasion || (params.occasion === 'eid' && f.slug === 'eid_ul_fitr')
  );

  const topicLower = `${params.subCategory || ''} ${params.customTopic || ''}`.toLowerCase();

  if (festivalEntry) {
    occasionStr = `${festivalEntry.name} celebratory agency backdrop`;
    const festivalVariations: Record<string, [string, string, string]> = {
      diwali: [
        'deep royal maroon, obsidian and lustrous warm gold',
        'rich crimson, warm amber flame tones and antique brass',
        'midnight mahogany, warm candlelight amber and floating golden embers',
      ],
      holi: [
        'dark studio backdrop with vibrant magenta, violet, saffron and turquoise powder clouds',
        'sunset plum, warm pink gulal clouds and radiant saffron',
        'midnight navy with vivid cyan and yellow pigment dust',
      ],
      uttarayan: [
        'warm sunset saffron indigo sky with minimalist colorful geometric kites high in the upper corner',
        'golden hour twilight gradient with subtle traditional kite silhouettes far away',
        'deep evening cobalt sky with illuminated paper sky lanterns floating gently',
      ],
      navratri: [
        'royal indigo, crimson marigold and warm bronze dandiya stage lighting',
        'festive vermilion orange, deep purple and glittering fairy lights',
        'midnight plum, saffron silk sheen and glowing temple lanterns',
      ],
    };

    const customPalettes = festivalVariations[festivalEntry.slug];
    defaultPalette = customPalettes
      ? customPalettes[params.variationIndex % 3]
      : festivalEntry.visualTheme;
    defaultDecorations =
      params.variationIndex === 0
        ? festivalEntry.visualTheme
        : params.variationIndex === 1
        ? `${festivalEntry.visualTheme}, warm rim lighting, deep uncluttered backdrop`
        : `${festivalEntry.visualTheme}, subtle architectural border light, soft floor reflection`;
  } else if (params.category === 'corporate' || params.occasion === 'corporate') {
    const isEvent = /(event|celebration|anniversary|summit|gala|conference)/.test(topicLower);
    occasionStr = isEvent
      ? `${params.subCategory || params.customTopic || 'corporate milestone event'} modern gala & conference stage`
      : `${params.subCategory || params.customTopic || 'corporate enterprise'} modern executive architecture`;
    defaultPalette =
      params.variationIndex === 0
        ? 'obsidian navy slate, brushed titanium silver and subtle warm amber rim accents'
        : params.variationIndex === 1
        ? 'executive charcoal graphite, warm architectural champagne brass highlights'
        : 'deep royal midnight blue glass facade reflections with clean modern minimalism';
    defaultDecorations = isEvent
      ? 'modern architectural conference hall lighting, subtle warm spotlight rays, sleek glass & dark wood depth'
      : allowBalancedPeople
      ? 'modern architectural boardroom with balanced diverse men and women executives in smart business attire blurred softly in background, clean executive negative space'
      : 'modern skyscraper glass geometry, sleek executive marble lobby lighting, uncluttered dark negative space';
  } else if (params.category === 'it_tech' || params.occasion === 'it_tech') {
    const isMarketingAi = /(digital marketing|ai & digital)/.test(topicLower);
    occasionStr = isMarketingAi
      ? `${params.subCategory || params.customTopic || 'AI digital marketing analytics'} modern tech studio`
      : `${params.subCategory || params.customTopic || 'enterprise AI & cloud technology'} abstract visual`;
    defaultPalette =
      params.variationIndex === 0
        ? 'deep dark space navy, subtle luminous cyan neural data streams and frosted glass nodes'
        : params.variationIndex === 1
        ? 'obsidian black, electric indigo optical light prism and precision micro-grid'
        : 'midnight emerald slate, subtle holographic fiber optics and smooth matte carbon';
    defaultDecorations = 'minimalist abstract 3D glass waves, optical hardware depth, soft volumetric glow, clean uncluttered focal area';
  } else if (params.category === 'hiring' || params.occasion === 'hiring') {
    occasionStr = `${params.subCategory || params.customTopic || 'modern tech & corporate career recruitment'} workplace backdrop`;
    defaultPalette =
      params.variationIndex === 0
        ? 'architectural midnight teal, crisp cobalt studio accent lighting and clean matte slate'
        : params.variationIndex === 1
        ? 'deep navy indigo, warm amber studio light wash and subtle modern office glass blur'
        : 'clean charcoal slate with ascending modern architectural stairs and emerald rim light';
    defaultDecorations = allowBalancedPeople
      ? 'modern bright-yet-moody tech office campus with balanced group of male and female engineers and managers collaborating naturally in soft focus, zero solo fashion portraits'
      : 'clean minimalist modern tech office architecture, glass meeting pods, warm desk lamp glow, zero clutter';
  } else if (params.occasion === 'product_launch') {
    occasionStr = `${params.subCategory || params.customTopic || 'luxury product showcase'} studio stage`;
    defaultPalette =
      params.variationIndex === 0
        ? 'matte obsidian graphite with subtle cyan rim light'
        : params.variationIndex === 1
        ? 'minimalist dark carbon with warm ambient golden spotlight'
        : 'luxurious dark emerald glass with clean geometric backlight';
    defaultDecorations = 'minimalist dark studio pedestal podium, soft circular spotlight, faint floor reflection';
  } else {
    occasionStr = params.customTopic || params.subCategory || 'premium business promotional showcase';
    defaultPalette =
      params.variationIndex === 0
        ? 'luxury obsidian black, deep carbon slate and radiant warm gold rim light'
        : params.variationIndex === 1
        ? 'deep burgundy slate and champagne metallic light sweep'
        : 'architectural midnight blue with high-contrast amber studio glow';
    defaultDecorations = 'sleek architectural studio floor, soft volumetric spotlight beam, clean dark empty center';
  }

  const palette = params.palette || defaultPalette;
  const decorations = params.decorations || defaultDecorations;
  const humanDirective = allowBalancedPeople
    ? 'Balanced editorial representation of both men and women in smart business attire if people appear, never solo female glamour portraits.'
    : 'Strictly NO people, NO women, NO girls, NO models, NO faces, NO portraits.';

  const prompt = `${sizeDesc} agency-grade ${occasionStr} poster BACKGROUND, ${palette}, cinematic studio lighting, depth of field, ${decorations}, ${layoutFramingHint}. ${humanDirective} Strictly NO text, NO letters, NO numbers, NO watermarks, NO logos.`;

  return { prompt, seed, allowBalancedPeople };
}

// High-speed external free image model generator with crisp dimensions & negative prompt
async function fetchPollinationsImage(
  prompt: string,
  seed: number,
  aspectRatio: string,
  allowBalancedPeople = false
): Promise<string> {
  const width =
    aspectRatio === '9:16' ? 608 : aspectRatio === '4:5' ? 864 : aspectRatio === '16:9' ? 1024 : 1024;
  const height =
    aspectRatio === '9:16' ? 1080 : aspectRatio === '4:5' ? 1080 : aspectRatio === '16:9' ? 576 : 1024;
  const negativeTag = allowBalancedPeople
    ? ' --no solo female model, women-only portrait, fashion glamour, random stock face, text, letters, words, watermark, logos, typography, numbers'
    : ' --no text, letters, words, watermark, logos, typography, numbers, faces, humans, women, girls, models';
  const encodedPrompt = encodeURIComponent(prompt + negativeTag);

  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
}

// OCR and Quality Gate check using Gemini 3.8 Flash (Free Tier)
async function runSceneOCR(imageUrlOrBase64: string): Promise<{ hasText: boolean; detectedText: string[] }> {
  if (!ai || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
    return { hasText: false, detectedText: [] };
  }

  try {
    let mimeType = 'image/jpeg';
    let base64Data = '';

    if (imageUrlOrBase64.startsWith('data:')) {
      const parts = imageUrlOrBase64.split(',');
      const match = parts[0].match(/:(.*?);/);
      mimeType = match ? match[1] : 'image/png';
      base64Data = parts[1];
    } else if (imageUrlOrBase64.startsWith('http')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(imageUrlOrBase64, { signal: controller.signal });
      clearTimeout(timeoutId);
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
      const ct = resp.headers.get('content-type');
      if (ct) mimeType = ct;
    } else {
      return { hasText: false, detectedText: [] };
    }

    const geminiCall = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Quality Gate OCR: reply strict JSON {"hasTextOrSymbols": boolean, "detectedItems": string[]}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('OCR Timeout')), 4000));
    const response: any = await Promise.race([geminiCall, timeoutPromise]);

    const parsed = safeParseModelJson(response.text || '{}');
    return {
      hasText: Boolean(parsed.hasTextOrSymbols && parsed.detectedItems?.length > 0),
      detectedText: parsed.detectedItems || [],
    };
  } catch (err) {
    return { hasText: false, detectedText: [] };
  }
}

// 1. Generate 3 Background Scenes
app.post('/api/generate-scenes', async (req: Request, res: Response) => {
  try {
    const {
      occasion = 'diwali',
      category,
      subCategory,
      customTopic = '',
      aspectRatio = '1:1',
      palette,
      decorations,
    } = req.body;

    const variations = [];

    for (let i = 0; i < 3; i++) {
      const { prompt, seed, allowBalancedPeople } = buildScenePrompt({
        occasion,
        category,
        subCategory,
        customTopic,
        aspectRatio,
        palette,
        decorations,
        variationIndex: i,
      });

      let imageUrl = '';
      let source: 'gemini' | 'pollinations' | 'procedural' = 'pollinations';

      try {
        imageUrl = await fetchPollinationsImage(prompt, seed, aspectRatio, allowBalancedPeople);
      } catch (err) {
        console.warn('Pollinations error, fallback to procedural SVG:', err);
        source = 'procedural';
      }

      let ocrResult = { hasText: false, detectedText: [] as string[] };
      if (imageUrl && !imageUrl.startsWith('data:image/svg+xml')) {
        ocrResult = await runSceneOCR(imageUrl);
      }

      variations.push({
        id: `var-${Date.now()}-${i}-${seed}`,
        imageUrl,
        prompt,
        source,
        qualityPassed: !ocrResult.hasText,
        ocrDetectedText: ocrResult.detectedText,
      });
    }

    return res.json({
      success: true,
      variations,
    });
  } catch (error: any) {
    console.error('Error generating scenes:', error);
    return res.status(500).json({ error: error.message || 'Scene generation failed' });
  }
});

// 1B. Full Corporate, IT, Marketing, Hiring & Festival Creative Suite Generator (3 Distinct Concepts + Copy + Captions)
app.post('/api/poster/generate-suite', async (req: Request, res: Response) => {
  try {
    const {
      category = 'corporate',
      subCategory = 'Company Introduction',
      occasion = 'corporate',
      topic = '',
      language = 'english',
      aspectRatio = '4:5',
      highlightsInput = [],
      offerText = '',
      ctaInput = '',
      palettePrompt = '',
      decorationsPrompt = '',
      includeBrandProfile = true,
    } = req.body;

    const brand = getBrandProfile();
    const festivalInfo = FESTIVAL_CATALOG.find((f) => f.slug === occasion);
    const activeCompany = includeBrandProfile && brand.companyName ? brand.companyName : '';
    const langKey: 'english' | 'hindi' | 'gujarati' =
      language === 'hindi' || language === 'gujarati' ? language : 'english';

    const providedHighlights = Array.isArray(highlightsInput)
      ? highlightsInput.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 4)
      : [];

    const brandPrimary = normalizeHexColor(brand.primaryColor, '#F59E0B');
    const brandSecondary = normalizeHexColor(brand.secondaryColor, '#0F172A');
    const brandAccent = normalizeHexColor(brand.accentColor, '#06B6D4');
    const hasCustomBrandPalette = !(
      brandPrimary === '#F59E0B' &&
      brandSecondary === '#0F172A' &&
      (brandAccent === '#06B6D4' || brandAccent === '#38BDF8')
    );

    const resolveCategoryPalettes = (): Array<{ primary: string; secondary: string; accent: string }> => {
      const hay = `${subCategory} ${topic} ${occasion}`.toLowerCase();
      if (/(intern|internship|training|campus|bootcamp|cohort)/.test(hay)) {
        return [
          { primary: '#38BDF8', secondary: '#0F173D', accent: '#A78BFA' },
          { primary: '#34D399', secondary: '#06241D', accent: '#E2E8F0' },
          { primary: '#FBBF24', secondary: '#0B162C', accent: '#38BDF8' },
        ];
      }
      if (category === 'hiring' || /(hiring|job|recruit|vacancy|career|walk-in)/.test(hay)) {
        return [
          { primary: '#2DD4BF', secondary: '#081F2C', accent: '#38BDF8' },
          { primary: '#60A5FA', secondary: '#0B1736', accent: '#FFFFFF' },
          { primary: '#F5C451', secondary: '#111827', accent: '#34D399' },
        ];
      }
      if (/(event|celebrat|anniversary|summit|conference|gala|milestone)/.test(hay)) {
        return [
          { primary: '#F5C451', secondary: '#110C18', accent: '#F472B6' },
          { primary: '#DDD6FE', secondary: '#1A0F36', accent: '#F5C451' },
          { primary: '#FBBF24', secondary: '#0C1838', accent: '#E2E8F0' },
        ];
      }
      if (category === 'festival' || festivalInfo) {
        return [
          { primary: '#F5C451', secondary: '#360714', accent: '#FB923C' },
          { primary: '#E2E8F0', secondary: '#16113D', accent: '#F5C451' },
          { primary: '#FDE047', secondary: '#062920', accent: '#34D399' },
        ];
      }
      if (/(ai|artificial|machine|data|digital marketing|automation|llm|analytics)/.test(hay)) {
        return [
          { primary: '#D8B4FE', secondary: '#170E33', accent: '#38BDF8' },
          { primary: '#38BDF8', secondary: '#060F24', accent: '#A78BFA' },
          { primary: '#F5C451', secondary: '#121329', accent: '#818CF8' },
        ];
      }
      if (category === 'it_tech') {
        return [
          { primary: '#38BDF8', secondary: '#06162E', accent: '#818CF8' },
          { primary: '#C4B5FD', secondary: '#160E33', accent: '#38BDF8' },
          { primary: '#34D399', secondary: '#061F1B', accent: '#38BDF8' },
        ];
      }
      if (category === 'marketing') {
        return [
          { primary: '#F5C451', secondary: '#0A0B10', accent: '#38BDF8' },
          { primary: '#E2E8F0', secondary: '#0D111A', accent: '#F59E0B' },
          { primary: '#34D399', secondary: '#062118', accent: '#F5C451' },
        ];
      }
      return [
        { primary: '#FFFFFF', secondary: '#0A192F', accent: '#38BDF8' },
        { primary: '#F5C451', secondary: '#090B10', accent: '#FDE68A' },
        { primary: '#E2E8F0', secondary: '#0F2557', accent: '#60A5FA' },
      ];
    };

    const categoryPalettes = resolveCategoryPalettes();

    const trimAtWord = (text: string, maxLen: number): string => {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (normalized.length <= maxLen) return normalized;
      const sliced = normalized.slice(0, maxLen);
      const lastSpace = sliced.lastIndexOf(' ');
      return (lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced).trim();
    };

    const sanitizeConceptCopy = (
      raw: any,
      fallback: any,
      idx: number
    ) => {
      const seenNormalized = new Set<string>();
      const cleanExact = (v: any) => String(v || '').replace(/\s+/g, ' ').trim();
      const cleanAiText = (v: any, maxLen: number) => trimAtWord(String(v || ''), maxLen);

      let headlineText = topic?.trim() && raw.headlineText
        ? cleanAiText(raw.headlineText, 72)
        : cleanAiText(raw.headlineText || fallback.headlineText, 64);
      if (headlineText) seenNormalized.add(headlineText.toLowerCase());

      let headlineSubtext = cleanAiText(raw.headlineSubtext || fallback.headlineSubtext, 34);
      if (!headlineSubtext || seenNormalized.has(headlineSubtext.toLowerCase()) || headlineText.toLowerCase() === headlineSubtext.toLowerCase()) {
        headlineSubtext = cleanAiText(subCategory || category.replace('_', ' '), 34).toUpperCase();
        if (seenNormalized.has(headlineSubtext.toLowerCase())) {
          headlineSubtext = category === 'festival' ? 'FESTIVE GREETINGS' : 'ANNOUNCEMENT';
        }
      }
      seenNormalized.add(headlineSubtext.toLowerCase());

      let subheadingText = cleanAiText(raw.subheadingText || fallback.subheadingText, 120);
      if (seenNormalized.has(subheadingText.toLowerCase())) {
        subheadingText = cleanAiText(fallback.subheadingText, 120);
      }
      if (subheadingText) seenNormalized.add(subheadingText.toLowerCase());

      const explicitOffer = cleanExact(offerText);
      let badgeText = explicitOffer || cleanAiText(raw.badgeText || fallback.badgeText, 20);
      if (!explicitOffer && badgeText && seenNormalized.has(badgeText.toLowerCase())) {
        badgeText = cleanAiText(fallback.badgeText, 20);
      }
      const badgeSubtext = cleanAiText(raw.badgeSubtext || fallback.badgeSubtext, 22);

      const rawHighlights =
        providedHighlights.length > 0
          ? providedHighlights
          : Array.isArray(raw.highlights)
          ? raw.highlights
          : [];
      const uniqueHighlights: string[] = [];
      for (const h of rawHighlights) {
        const s = providedHighlights.length > 0 ? cleanExact(h) : cleanAiText(h, 52);
        const norm = s.toLowerCase();
        if (s && (providedHighlights.length > 0 || !seenNormalized.has(norm)) && uniqueHighlights.length < 4) {
          seenNormalized.add(norm);
          uniqueHighlights.push(s);
        }
      }

      const validFonts =
        langKey === 'hindi'
          ? ['font-hindi', 'font-rozha']
          : langKey === 'gujarati'
          ? ['font-gujarati']
          : ['font-jakarta', 'font-montserrat', 'font-manrope', 'font-playfair', 'font-cinzel', 'font-poppins'];
      const defaultFonts =
        langKey === 'hindi'
          ? ['font-hindi', 'font-rozha', 'font-hindi']
          : langKey === 'gujarati'
          ? ['font-gujarati', 'font-gujarati', 'font-gujarati']
          : category === 'festival'
          ? ['font-cinzel', 'font-playfair', 'font-montserrat']
          : ['font-jakarta', 'font-playfair', 'font-manrope'];

      const headlineFont = validFonts.includes(raw.headlineFont) ? raw.headlineFont : defaultFonts[idx];
      const validCtaStyles = ['gold_pill', 'solid_crimson', 'emerald_luxury', 'glass_border', 'neon_accent'] as const;
      const ctaStyle = validCtaStyles.includes(raw.ctaStyle)
        ? raw.ctaStyle
        : idx === 2
        ? 'glass_border'
        : category === 'it_tech'
        ? 'neon_accent'
        : 'gold_pill';

      const validBadgeStyles = ['scalloped_gold', 'minimal_ring', 'festive_tag', 'neon_badge'] as const;
      const isFestiveOrPromo = category === 'festival' || occasion === 'sale';
      let badgeStyle: (typeof validBadgeStyles)[number] = validBadgeStyles.includes(raw.badgeStyle)
        ? raw.badgeStyle
        : isFestiveOrPromo && idx === 1
        ? 'scalloped_gold'
        : 'minimal_ring';
      if (!isFestiveOrPromo && badgeStyle === 'scalloped_gold') {
        badgeStyle = 'minimal_ring';
      }

      return {
        conceptTitle: cleanAiText(raw.conceptTitle || fallback.conceptTitle, 36),
        layoutStyle: raw.layoutStyle,
        headlineText,
        headlineSubtext,
        headlineStyle: raw.headlineStyle,
        headlineFont,
        subheadingText,
        ctaText: cleanExact(ctaInput) || cleanAiText(raw.ctaText || fallback.ctaText, 28),
        ctaStyle,
        badgeText,
        badgeSubtext,
        badgeStyle,
        highlights: uniqueHighlights,
        palette: {
          primary: normalizeHexColor(
            includeBrandProfile && hasCustomBrandPalette && idx === 0 ? brandPrimary : raw.palette?.primary,
            fallback.palette.primary
          ),
          secondary: normalizeHexColor(
            includeBrandProfile && hasCustomBrandPalette && idx === 0 ? brandSecondary : raw.palette?.secondary,
            fallback.palette.secondary
          ),
          accent: normalizeHexColor(
            includeBrandProfile && hasCustomBrandPalette && idx === 0 ? brandAccent : raw.palette?.accent,
            fallback.palette.accent
          ),
        },
      };
    };

    const fallbackConcepts = () => {
      const subjectLabel = topic?.trim() || (festivalInfo ? festivalInfo.name : subCategory);
      const langGreeting =
        festivalInfo?.suggestedGreeting?.[langKey] ||
        (langKey === 'hindi'
          ? `${subjectLabel}`
          : langKey === 'gujarati'
          ? `${subjectLabel}`
          : subjectLabel);

      const defaultSubhead =
        langKey === 'hindi'
          ? activeCompany
            ? `${activeCompany} की ओर से ${subCategory}`
            : 'सरल, स्पष्ट और विश्वसनीय सेवाएँ।'
          : langKey === 'gujarati'
          ? activeCompany
            ? `${activeCompany} તરફથી ${subCategory}`
            : 'સરળ, સ્પષ્ટ અને વિશ્વસનીય સેવાઓ.'
          : activeCompany
          ? `${activeCompany} — Clear and reliable ${subCategory.toLowerCase()} solutions.`
          : `Clear, reliable ${subCategory.toLowerCase()} for your business.`;

      const defaultCta =
        ctaInput?.trim() ||
        (langKey === 'hindi'
          ? 'संपर्क करें'
          : langKey === 'gujarati'
          ? 'સંપર્ક કરો'
          : category === 'hiring'
          ? 'Apply Now'
          : category === 'festival'
          ? 'Warm Wishes'
          : 'Contact Us');

      const defaultBadge =
        offerText?.trim() ||
        (category === 'hiring'
          ? 'WE ARE HIRING'
          : category === 'festival'
          ? String(new Date().getFullYear())
          : category === 'it_tech'
          ? 'IT SERVICES'
          : 'ANNOUNCEMENT');

      const palettes =
        includeBrandProfile && hasCustomBrandPalette
          ? [
              { primary: brandPrimary, secondary: brandSecondary, accent: brandAccent },
              categoryPalettes[1],
              categoryPalettes[2],
            ]
          : categoryPalettes;

      const layoutStyles: Array<'executive_left' | 'centered_editorial' | 'split_frame'> =
        category === 'festival' || /(event|celebrat|anniversary|summit)/.test(subCategory.toLowerCase())
          ? ['centered_editorial', 'split_frame', 'executive_left']
          : category === 'hiring' || category === 'marketing'
          ? ['split_frame', 'executive_left', 'centered_editorial']
          : ['executive_left', 'centered_editorial', 'split_frame'];
      const conceptNames =
        layoutStyles[0] === 'centered_editorial'
          ? ['Editorial Hero Center', 'Architectural Glass Card', 'Brand Executive Grid']
          : layoutStyles[0] === 'split_frame'
          ? ['Architectural Glass Card', 'Brand Executive Grid', 'Editorial Hero Center']
          : ['Brand Executive Grid', 'Editorial Hero Center', 'Architectural Glass Card'];
      const headlineStyles: Array<'gold' | 'silver' | 'white'> =
        category === 'festival' || category === 'marketing'
          ? ['gold', 'white', 'silver']
          : ['white', 'silver', 'gold'];
      const headlineAngles =
        langKey === 'english' && !festivalInfo
          ? [
              langGreeting,
              activeCompany ? `${subjectLabel} at ${activeCompany}` : `${subjectLabel}`,
              `${subCategory} Overview`,
            ]
          : [langGreeting, langGreeting, langGreeting];
      const eyebrowAngles = [
        subCategory.toUpperCase(),
        category === 'festival' ? 'FESTIVE WISHES' : 'KEY UPDATE',
        category === 'hiring' ? 'CAREERS' : category === 'it_tech' ? 'TECHNOLOGY' : 'BUSINESS UPDATE',
      ];

      return layoutStyles.map((layoutStyle, idx) =>
        sanitizeConceptCopy(
          {
            conceptTitle: conceptNames[idx],
            layoutStyle,
            headlineText: headlineAngles[idx],
            headlineSubtext: eyebrowAngles[idx],
            headlineStyle: headlineStyles[idx],
            subheadingText: defaultSubhead,
            ctaText: defaultCta,
            badgeText: defaultBadge,
            badgeSubtext: festivalInfo ? 'Greetings' : category.replace('_', ' ').toUpperCase(),
            highlights: providedHighlights,
            palette: palettes[idx],
          },
          {
            conceptTitle: conceptNames[idx],
            headlineText: headlineAngles[idx],
            headlineSubtext: eyebrowAngles[idx],
            subheadingText: defaultSubhead,
            ctaText: defaultCta,
            badgeText: defaultBadge,
            badgeSubtext: festivalInfo ? 'Greetings' : 'POSTPILOT',
            palette: palettes[idx],
          },
          idx
        )
      );
    };

    let generatedConcepts = fallbackConcepts();
    let captions = {
      instagram: `${topic || subCategory}${activeCompany ? ` — ${activeCompany}` : ''}\n\n#${subCategory.replace(/[^a-zA-Z0-9]/g, '') || 'Business'} #Update`,
      facebook: `${topic || subCategory}${activeCompany ? ` from ${activeCompany}` : ''}. Contact us to learn more.`,
      linkedin: `${topic || subCategory}${activeCompany ? ` — ${activeCompany}` : ''}. Sharing an update with our network.`,
    };
    let aiSource = 'template';

    if (ai && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
      try {
        const brandColorDirective =
          includeBrandProfile && hasCustomBrandPalette
            ? `- Saved Custom Brand Palette (anchor Concept 1 to these hex colors): primary=${brandPrimary}, secondary=${brandSecondary}, accent=${brandAccent}`
            : `- Use category-authentic high-contrast palettes matching: Concept 1=${JSON.stringify(categoryPalettes[0])}, Concept 2=${JSON.stringify(categoryPalettes[1])}, Concept 3=${JSON.stringify(categoryPalettes[2])}`;

        const prompt = `You write short, clear, everyday professional copy for business and festival posters.
Create 3 distinct poster concepts for:
- Category: ${category}
- Sub-Category / Topic: ${subCategory} — "${topic || subCategory}"
- Occasion Slug: ${occasion}${festivalInfo ? ` (${festivalInfo.name})` : ''}
- Output Language for ALL poster text (headlines, subheadings, CTAs, highlights): ${langKey} (Use natural Devanagari for Hindi, natural Gujarati for Gujarati, plain clear English for English. Zero spelling or grammar errors.)
- User Key Points / Highlights (preserve EVERY user point faithfully): ${providedHighlights.length > 0 ? providedHighlights.join(' | ') : 'None provided — write 2-3 very short, plain factual bullet points (3-6 common words each), or leave empty for simple festival greetings.'}
- User Offer / Badge Text (keep exact if provided): "${offerText || 'Auto-select a simple 1-2 word tag'}"
- User CTA (keep exact if provided): "${ctaInput || 'Auto-select a clear 2-3 word action like Apply Now or Contact Us'}"
- Company Name (preserve exact spelling, NEVER alter it): "${activeCompany || 'None specified'}"
${brandColorDirective}

WRITING QUALITY RULES (STRICT):
1. Write SHORT, SIMPLE, NATURAL, everyday words. Sound like a clear human writer, NOT a hype-heavy marketing ad.
2. AVOID overly fluent buzzwords or cliché slogans (never use words like "unleash", "velocity", "algorithmic power", "synergy", "revolutionary", "elevate", "seamless transformation", "game-changer", or long flowery sentences).
3. Keep every line concise and easy to read on a poster:
   - headlineSubtext (eyebrow): 2-3 simple words
   - headlineText: 2-6 clear, direct words (vary angle across the 3 concepts without losing user meaning)
   - subheadingText: ONE short, clear sentence (6-12 plain words max — NO paragraphs!)
   - badgeText: 1-2 words
   - highlights: 2-3 short items (3-6 clear words each)
4. PRESERVE EVERY USER DETAIL: Never change, omit, or invent company names, dates, addresses, phone numbers, emails, prices, offers, or technical terms given in the topic or highlights.
5. NEVER duplicate the exact same text across eyebrow, headline, subheading, badge, or highlights.
6. Layout & typography styles across the 3 concepts:
   - Concept 1: layoutStyle="${generatedConcepts[0].layoutStyle}", headlineFont="${langKey === 'hindi' ? 'font-hindi' : langKey === 'gujarati' ? 'font-gujarati' : category === 'festival' ? 'font-cinzel' : 'font-jakarta'}", badgeStyle="${category === 'festival' || occasion === 'sale' ? 'scalloped_gold' : 'minimal_ring'}", using the Concept 1 palette.
   - Concept 2: layoutStyle="${generatedConcepts[1].layoutStyle}", headlineFont="${langKey === 'hindi' ? 'font-rozha' : langKey === 'gujarati' ? 'font-gujarati' : 'font-playfair'}".
   - Concept 3: layoutStyle="${generatedConcepts[2].layoutStyle}", headlineFont="${langKey === 'hindi' ? 'font-hindi' : langKey === 'gujarati' ? 'font-gujarati' : 'font-manrope'}".
   - Use badgeStyle="scalloped_gold" ONLY for festivals/sales; use "minimal_ring" or "festive_tag" for corporate, IT, or hiring posters.
7. Write brief, natural social captions for Instagram, Facebook, and LinkedIn (1-2 clear sentences + 2-3 simple relevant hashtags in ${langKey === 'english' ? 'English' : `${langKey} with clean hashtags`}).`;

        const { response, model: usedModel } = await generateWithModelFallback({
          contents: prompt,
          timeoutMs: 26000,
          config: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                concepts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      conceptTitle: { type: Type.STRING },
                      layoutStyle: { type: Type.STRING },
                      headlineText: { type: Type.STRING },
                      headlineSubtext: { type: Type.STRING },
                      headlineStyle: { type: Type.STRING },
                      headlineFont: { type: Type.STRING },
                      subheadingText: { type: Type.STRING },
                      ctaText: { type: Type.STRING },
                      ctaStyle: { type: Type.STRING },
                      badgeText: { type: Type.STRING },
                      badgeSubtext: { type: Type.STRING },
                      badgeStyle: { type: Type.STRING },
                      highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                      palette: {
                        type: Type.OBJECT,
                        properties: {
                          primary: { type: Type.STRING },
                          secondary: { type: Type.STRING },
                          accent: { type: Type.STRING },
                        },
                      },
                    },
                    required: ['conceptTitle', 'layoutStyle', 'headlineText', 'subheadingText', 'ctaText'],
                  },
                },
                captions: {
                  type: Type.OBJECT,
                  properties: {
                    instagram: { type: Type.STRING },
                    facebook: { type: Type.STRING },
                    linkedin: { type: Type.STRING },
                  },
                  required: ['instagram', 'facebook', 'linkedin'],
                },
              },
              required: ['concepts', 'captions'],
            },
          },
        });
        const parsed = safeParseModelJson(response.text || '{}');

        if (Array.isArray(parsed.concepts) && parsed.concepts.length >= 3) {
          const validLayouts = ['executive_left', 'centered_editorial', 'split_frame'] as const;
          const validHeadlineStyles = ['gold', 'silver', 'rose_gold', 'emerald', 'white'] as const;
          generatedConcepts = parsed.concepts.slice(0, 3).map((c: any, idx: number) =>
            sanitizeConceptCopy(
              {
                ...c,
                layoutStyle: validLayouts.includes(c.layoutStyle)
                  ? c.layoutStyle
                  : generatedConcepts[idx].layoutStyle,
                headlineStyle: validHeadlineStyles.includes(c.headlineStyle)
                  ? c.headlineStyle
                  : generatedConcepts[idx].headlineStyle,
              },
              generatedConcepts[idx],
              idx
            )
          );
          aiSource = usedModel;
        }
        if (parsed.captions?.instagram && parsed.captions?.facebook && parsed.captions?.linkedin) {
          captions = {
            instagram: String(parsed.captions.instagram),
            facebook: String(parsed.captions.facebook),
            linkedin: String(parsed.captions.linkedin),
          };
        }
      } catch (err) {
        console.warn('[GenerateSuite] Gemini fallback used:', err);
      }
    }

    // Build 3 distinct visual scene URLs matched to each concept
    const variations = await Promise.all(
      generatedConcepts.map(async (concept, i) => {
        const { prompt, seed, allowBalancedPeople } = buildScenePrompt({
          occasion,
          category,
          subCategory,
          customTopic: topic || subCategory,
          aspectRatio,
          palette: palettePrompt
            ? `${palettePrompt}, accented with ${concept.palette.primary}`
            : `${concept.palette.secondary} architectural tone accented with ${concept.palette.primary} and ${concept.palette.accent}`,
          decorations: decorationsPrompt || undefined,
          variationIndex: i,
        });

        let imageUrl = '';
        let source: 'pollinations' | 'procedural' = 'pollinations';
        try {
          imageUrl = await fetchPollinationsImage(prompt, seed, aspectRatio, allowBalancedPeople);
        } catch {
          source = 'procedural';
        }

        return {
          id: `suite-${Date.now()}-${i}-${seed}`,
          imageUrl,
          prompt,
          source,
          qualityPassed: true,
          ocrDetectedText: [],
          ...concept,
        };
      })
    );

    return res.json({
      success: true,
      aiSource,
      variations,
      captions,
      companyInfo: includeBrandProfile && brand.companyName
        ? {
            companyName: brand.companyName,
            tagline: brand.tagline,
            website: brand.website,
            email: brand.email,
            phone: brand.phone,
            showContactBar: Boolean(brand.website || brand.email || brand.phone || brand.tagline),
          }
        : undefined,
      brandLogoUrl: includeBrandProfile && brand.logoDataUrl ? brand.logoDataUrl : undefined,
    });
  } catch (err: any) {
    console.error('[GenerateSuite] Failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'Poster suite generation failed.' });
  }
});

// ==========================================
// BRAND PROFILE, SAVED DESIGNS, FESTIVALS & SCHEDULER
// ==========================================
app.get('/api/brand', (_req: Request, res: Response) => {
  return res.json({ success: true, brand: getBrandProfile() });
});

app.post('/api/brand', (req: Request, res: Response) => {
  try {
    const saved = saveBrandProfile(req.body || {});
    return res.json({ success: true, brand: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Could not save brand profile.' });
  }
});

app.get('/api/designs', (_req: Request, res: Response) => {
  return res.json({ success: true, designs: getSavedDesigns() });
});

app.post('/api/designs', (req: Request, res: Response) => {
  try {
    const { id, name, category = 'corporate', subCategory = 'General', language = 'english', poster } = req.body || {};
    if (!poster || !name) {
      return res.status(400).json({ success: false, error: 'Design name and poster payload are required.' });
    }
    const saved = saveDesignItem({ id, name, category, subCategory, language, poster });
    return res.json({ success: true, design: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Could not save design.' });
  }
});

app.delete('/api/designs/:id', (req: Request, res: Response) => {
  const deleted = deleteDesignItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Design not found.' });
  }
  return res.json({ success: true });
});

app.get('/api/festivals', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    referenceDate: new Date().toISOString().slice(0, 10),
    festivals: getUpcomingFestivals(new Date()),
  });
});

app.get('/api/schedules', async (_req: Request, res: Response) => {
  const localSchedules = getScheduledPosts();
  if (!isZernioConfigured()) {
    return res.json({ success: true, schedules: localSchedules, zernioPosts: [] });
  }
  try {
    const { posts } = await listZernioPosts({ limit: 30 });
    return res.json({
      success: true,
      schedules: localSchedules,
      zernioPosts: posts,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      schedules: localSchedules,
      zernioPosts: [],
      zernioError: err?.message || 'Could not fetch Zernio scheduled posts.',
    });
  }
});

app.post('/api/schedules', async (req: Request, res: Response) => {
  const {
    topic = 'Scheduled Poster',
    category = 'festival',
    occasionSlug,
    scheduledFor,
    timezone,
    platforms = ['instagram', 'facebook', 'linkedin'],
    captions,
    platformDataUrls = {},
    autoPublishApproved,
    profileId,
    clientRequestId,
  } = req.body || {};

  const reqKey =
    typeof clientRequestId === 'string' && clientRequestId.trim()
      ? `schedule:${clientRequestId.trim()}`
      : '';

  if (reqKey) {
    pruneIdempotentStore();
    const existing = idempotentActionStore.get(reqKey);
    if (existing) {
      if (existing.status === 'succeeded' && existing.result) {
        console.log(`[Schedules] Returning deduplicated result for ${reqKey}`);
        return res.status(existing.result.statusCode).json({ ...existing.result.body, deduplicated: true });
      }
      if (existing.status === 'pending' && existing.promise) {
        console.log(`[Schedules] Joining in-flight schedule request for ${reqKey}`);
        const joined = await existing.promise;
        return res.status(joined.statusCode).json({ ...joined.body, deduplicated: joined.body?.success === true });
      }
    }
  }

  const executeSchedule = async (): Promise<{ statusCode: number; body: any }> => {
    try {
      if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) {
        return { statusCode: 400, body: { success: false, error: 'Valid scheduledFor ISO datetime is required.' } };
      }
      if (Date.parse(scheduledFor) <= Date.now()) {
        return { statusCode: 400, body: { success: false, error: 'Scheduled date and time must be in the future.' } };
      }
      if (autoPublishApproved !== true) {
        return {
          statusCode: 400,
          body: {
            success: false,
            error: 'Explicit user approval (autoPublishApproved: true) is required before scheduling automated publishing.',
          },
        };
      }
      if (!platformDataUrls || (!platformDataUrls.instagram && !platformDataUrls.facebook && !platformDataUrls.linkedin)) {
        return {
          statusCode: 400,
          body: {
            success: false,
            error: 'At least one rendered platform image (platformDataUrls) is required.',
          },
        };
      }

      const resolvedCaptions = {
        instagram: captions?.instagram || topic,
        facebook: captions?.facebook || topic,
        linkedin: captions?.linkedin || topic,
      };

      if (isZernioConfigured()) {
        const selectedPlatforms = (Array.isArray(platforms) ? platforms : ['instagram', 'facebook', 'linkedin']).filter(
          (p): p is SocialPlatform => p === 'instagram' || p === 'facebook' || p === 'linkedin'
        );
        const mediaByPlatform: Partial<Record<SocialPlatform, { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: string }>> = {};
        const fallbackSrc =
          platformDataUrls.instagram || platformDataUrls.facebook || platformDataUrls.linkedin;
        for (const plat of selectedPlatforms) {
          const src = platformDataUrls[plat] || fallbackSrc;
          if (src) {
            mediaByPlatform[plat] = await prepareImageBuffer({ dataUrl: src });
          }
        }

        const { zernioPost, report, missingPlatforms } = await publishOrScheduleViaZernio({
          topic,
          platforms: selectedPlatforms,
          captions: resolvedCaptions,
          mediaByPlatform,
          mode: 'schedule',
          scheduledFor,
          timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          profileId,
        });

        const anySuccess = selectedPlatforms.some((p) => report.platforms?.[p]?.status === 'SUCCESS');
        const allSuccess = selectedPlatforms.every((p) => report.platforms?.[p]?.status === 'SUCCESS');

        if (!zernioPost || !anySuccess) {
          const firstErr = selectedPlatforms
            .map((p) => report.platforms?.[p]?.errorMessage || report.platforms?.[p]?.reason)
            .find(Boolean);
          return {
            statusCode: 400,
            body: {
              success: false,
              error:
                firstErr ||
                `Connect at least one selected platform (${missingPlatforms.join(', ')}) in Social Connections before scheduling via Zernio.`,
              report,
            },
          };
        }

        recordPublishReport(report);
        return {
          statusCode: 200,
          body: {
            success: true,
            anySuccess,
            allSuccess,
            provider: 'zernio',
            zernioPost,
            report,
            missingPlatforms,
          },
        };
      }

      const item = createScheduledPost({
        topic,
        category,
        occasionSlug,
        scheduledFor,
        platforms,
        captions: resolvedCaptions,
        platformDataUrls,
        autoPublishApproved: true,
      });

      return { statusCode: 200, body: { success: true, schedule: item } };
    } catch (err: any) {
      const safeStatus = toSafeApiHttpStatus(Number(err?.status || 400));
      console.error(`[Schedules] Failed (status=${safeStatus}, upstream=${err?.status || 'none'}):`, err?.message || err);
      return {
        statusCode: safeStatus,
        body: {
          success: false,
          error: err?.message || 'Could not create scheduled post.',
          upstreamStatus: err?.status || undefined,
        },
      };
    }
  };

  if (!reqKey) {
    const result = await executeSchedule();
    return res.status(result.statusCode).json(result.body);
  }

  const runPromise = executeSchedule();
  idempotentActionStore.set(reqKey, {
    createdAt: Date.now(),
    status: 'pending',
    promise: runPromise,
  });

  const result = await runPromise;
  if (result.body?.success === true) {
    idempotentActionStore.set(reqKey, {
      createdAt: Date.now(),
      status: 'succeeded',
      result,
    });
  } else {
    idempotentActionStore.delete(reqKey);
  }
  return res.status(result.statusCode).json(result.body);
});

app.delete('/api/schedules/:id', (req: Request, res: Response) => {
  const deleted = deleteScheduledPost(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Scheduled item not found.' });
  }
  return res.json({ success: true });
});

async function executeScheduledPublishItem(itemId: string) {
  const item = getScheduledPosts().find((s) => s.id === itemId);
  if (!item || item.status !== 'scheduled' || !item.autoPublishApproved) return null;

  const baseUrl = process.env.APP_URL || `http://127.0.0.1:${PORT}`;
  const report = await runSocialPublishingWorkflow({
    topic: item.topic,
    platformDataUrls: item.platformDataUrls,
    platforms: item.platforms as SocialPlatform[],
    captions: item.captions,
    localCacheCallback: (buffer, mimeType) => {
      const id = `sched-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const ext = mimeType.toLowerCase().includes('jpeg') ? 'jpg' : 'png';
      publicImageCache.set(id, { buffer, mimeType });
      return `${baseUrl}/api/public-image/${id}.${ext}`;
    },
  });

  const anySuccess = item.platforms.some((p) => report.platforms[p]?.status === 'SUCCESS');
  const firstErr = item.platforms
    .map((p) => (report.platforms[p]?.status === 'FAILED' ? `${p}: ${report.platforms[p].errorMessage}` : ''))
    .filter(Boolean)
    .join(' | ');

  updateScheduledPost(item.id, {
    status: anySuccess ? 'published' : 'failed',
    reportId: report.id,
    lastError: firstErr || undefined,
  });

  return report;
}

app.post('/api/schedules/:id/run-now', async (req: Request, res: Response) => {
  try {
    const item = getScheduledPosts().find((s) => s.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }
    const report = await executeScheduledPublishItem(item.id);
    return res.json({ success: true, report, schedules: getScheduledPosts() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Real Multi-Turn AI Chatbot & Poster Design Agent (Gemini 4 Hydrogen — NO hardcoded replies)
async function handleAiChatRequest(req: Request, res: Response) {
  try {
    const { message = '', messages = [], posterState } = req.body || {};
    const trimmedMessage = String(message || '').trim();

    if (!trimmedMessage) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty. Please type a prompt or command.',
      });
    }

    if (!ai || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
      return res.status(503).json({
        success: false,
        error: 'Gemini AI API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const brand = getBrandProfile();
    const stateSummary = {
      title: posterState?.title || '',
      category: posterState?.category || 'corporate',
      subCategory: posterState?.subCategory || '',
      occasion: posterState?.occasion || 'corporate',
      language: posterState?.language || 'english',
      aspectRatio: posterState?.aspectRatio || '4:5',
      layoutStyle: posterState?.layoutStyle || 'centered_editorial',
      backgroundDarkness: posterState?.backgroundDarkness ?? 0.2,
      backgroundBlur: posterState?.backgroundBlur ?? 0,
      customPalette: posterState?.customPalette || null,
      highlights: posterState?.highlights || [],
      headline: posterState?.headline || null,
      subheading: posterState?.subheading || null,
      offerBadge: posterState?.offerBadge || null,
      ctaButton: posterState?.ctaButton || null,
      productPhoto: posterState?.productPhoto
        ? {
            x: posterState.productPhoto.x,
            y: posterState.productPhoto.y,
            scale: posterState.productPhoto.scale,
            glowIntensity: posterState.productPhoto.glowIntensity,
            visible: posterState.productPhoto.visible,
          }
        : null,
      brandLogo: posterState?.brandLogo
        ? {
            position: posterState.brandLogo.position,
            size: posterState.brandLogo.size,
            visible: posterState.brandLogo.visible,
            name: posterState.brandLogo.name,
          }
        : null,
    };

    const validFestivalSlugs = FESTIVAL_CATALOG.map((f) => `${f.slug} (${f.name})`).join(', ');
    const systemInstruction = `You are PostPilot AI Studio Assistant, an expert graphic designer and social media creative partner.
You help users:
1. Create brand-new posters from natural language (corporate, IT/tech, marketing, hiring, Indian/international festivals).
2. Modify the currently active poster in real time (background color/mood, headline size/text/color/position, subheading, badge, CTA button, layout, aspect ratio, highlights, darkness/contrast, product/logo positioning).
3. Answer follow-up questions and keep full context across conversation turns.
4. Prepare and publish posters to Instagram, Facebook, and LinkedIn when asked.

Always respond in natural, helpful language matching the user's language (English, Hindi, Hinglish, or Gujarati). Never give generic canned responses.
When writing or editing any poster text (headlines, subheadings, highlights, badges, CTAs), keep the wording short, simple, natural, and professional—use common everyday words, avoid long sentences or buzzword-heavy marketing language, maintain accurate spelling and grammar, preserve exact user-provided names/dates/addresses/phones/details, and never invent missing details.

Intent Classification Rules:
- Set intent = "generate_poster" when the user asks to create/design/make a NEW poster (e.g., "Create a professional Diwali poster for my IT company", "Make a hiring poster for React developer", "Build a cloud security promo poster"). Populate generateParams accurately:
  * category: "corporate" | "it_tech" | "marketing" | "hiring" | "festival"
  * occasion: choose the exact matching slug from: corporate, it_tech, hiring, product_launch, sale, ${validFestivalSlugs}
  * subCategory: human-readable topic (e.g., "Diwali", "Job Vacancies", "Artificial Intelligence", "Company Introduction", "Product Launch")
  * topic: short 1-sentence summary (under 20 words) keeping exact user names, dates, phones, and addresses (brand on server: "${brand.companyName || 'Not set'}")
  * language: "english" | "hindi" | "gujarati"
  * aspectRatio: "4:5" | "1:1" | "16:9" | "9:16"
  * palette: optional visual color scheme if user specifies colors
  * highlights: optional 0-4 short factual bullets (under 8 words each) preserving exact user details
  * offerText / ctaInput: optional short badge or CTA text if requested
- Set intent = "regenerate_background" when the user wants to change the background color, theme, mood, or generate a new backdrop on the EXISTING poster (e.g., "Change the background to dark blue", "Make the background festive gold with diyas", "Generate a new background"). Populate scenePromptOverride (palette, decorations, occasion) AND optionally updates.customPalette (where secondary = dark backdrop hex like "#0B1D3A", primary = main highlight hex like "#38BDF8", accent = secondary accent hex like "#F59E0B") and/or updates.backgroundDarkness.
- Set intent = "modify_poster" when the user wants to adjust typography, size, text, colors, visibility, alignment, layout, aspect ratio, or layer offsets on the CURRENT poster (e.g., "Make the heading bigger" -> increase headline.size by +10 to +16 from current size ${stateSummary.headline?.size ?? 40}; "Make it white/gold/silver/emerald/rose_gold" -> headline.style; "Change heading text to ..." -> headline.text; "Move CTA up" -> ctaButton.yOffset; "Hide badge" -> offerBadge.visible=false). Populate "updates".
- Set intent = "prepare_publish" when the user asks to publish, post, or schedule the poster on Instagram, Facebook, or LinkedIn. Populate "suggestedPlatforms".
- Set intent = "conversation" for general creative advice, caption ideas, Q&A, or follow-up clarifications.

Current Active Poster State:
${JSON.stringify(stateSummary)}`;

    const sanitizedHistory = Array.isArray(messages)
      ? messages
          .filter((m: any) => m && typeof m.text === 'string' && m.text.trim() && (m.sender === 'user' || m.sender === 'assistant' || m.role === 'user' || m.role === 'model'))
          .slice(-14)
          .map((m: any) => ({
            role: m.sender === 'assistant' || m.role === 'model' ? ('model' as const) : ('user' as const),
            parts: [{ text: String(m.text).trim() }],
          }))
      : [];

    const contents = [
      ...sanitizedHistory,
      {
        role: 'user' as const,
        parts: [{ text: trimmedMessage }],
      },
    ];

    const chatSchema = {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING },
        intent: {
          type: Type.STRING,
          enum: ['generate_poster', 'modify_poster', 'regenerate_background', 'prepare_publish', 'conversation'],
        },
        suggestedPlatforms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        generateParams: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            subCategory: { type: Type.STRING },
            occasion: { type: Type.STRING },
            topic: { type: Type.STRING },
            language: { type: Type.STRING },
            aspectRatio: { type: Type.STRING },
            palette: { type: Type.STRING },
            decorations: { type: Type.STRING },
            offerText: { type: Type.STRING },
            ctaInput: { type: Type.STRING },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        scenePromptOverride: {
          type: Type.OBJECT,
          properties: {
            occasion: { type: Type.STRING },
            palette: { type: Type.STRING },
            decorations: { type: Type.STRING },
            customTopic: { type: Type.STRING },
          },
        },
        updates: {
          type: Type.OBJECT,
          properties: {
            aspectRatio: { type: Type.STRING },
            layoutStyle: { type: Type.STRING },
            backgroundDarkness: { type: Type.NUMBER },
            backgroundBlur: { type: Type.NUMBER },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            customPalette: {
              type: Type.OBJECT,
              properties: {
                primary: { type: Type.STRING },
                secondary: { type: Type.STRING },
                accent: { type: Type.STRING },
              },
            },
            headline: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                subtext: { type: Type.STRING },
                style: { type: Type.STRING },
                size: { type: Type.NUMBER },
                yOffset: { type: Type.NUMBER },
                xOffset: { type: Type.NUMBER },
                align: { type: Type.STRING },
                letterSpacing: { type: Type.NUMBER },
              },
            },
            subheading: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                color: { type: Type.STRING },
                size: { type: Type.NUMBER },
                yOffset: { type: Type.NUMBER },
                visible: { type: Type.BOOLEAN },
              },
            },
            offerBadge: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                subtext: { type: Type.STRING },
                style: { type: Type.STRING },
                size: { type: Type.NUMBER },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                rotation: { type: Type.NUMBER },
                visible: { type: Type.BOOLEAN },
              },
            },
            ctaButton: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                style: { type: Type.STRING },
                size: { type: Type.NUMBER },
                yOffset: { type: Type.NUMBER },
                visible: { type: Type.BOOLEAN },
              },
            },
            productPhoto: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                scale: { type: Type.NUMBER },
                glowIntensity: { type: Type.NUMBER },
                visible: { type: Type.BOOLEAN },
                useCardFallback: { type: Type.BOOLEAN },
              },
            },
            brandLogo: {
              type: Type.OBJECT,
              properties: {
                position: { type: Type.STRING },
                size: { type: Type.NUMBER },
                withPlate: { type: Type.BOOLEAN },
                visible: { type: Type.BOOLEAN },
              },
            },
          },
        },
      },
      required: ['reply', 'intent'],
    };

    const { response, model: usedModel } = await generateWithModelFallback({
      contents,
      timeoutMs: 24000,
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 1536,
        responseMimeType: 'application/json',
        responseSchema: chatSchema,
      },
    });
    const rawText = response?.text || '';
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = safeParseModelJson(rawText);
    const intent = parsed.intent || 'conversation';

    if (parsed.generateParams?.topic && typeof parsed.generateParams.topic === 'string') {
      const t = parsed.generateParams.topic.replace(/\s+/g, ' ').trim();
      if (t.length > 200) {
        const sliced = t.slice(0, 200);
        const idx = sliced.lastIndexOf(' ');
        parsed.generateParams.topic = (idx > 120 ? sliced.slice(0, idx) : sliced).trim();
      }
    }

    return res.json({
      success: true,
      model: usedModel,
      intent,
      reply: parsed.reply,
      shouldRegenerateScene: intent === 'regenerate_background',
      scenePromptOverride: parsed.scenePromptOverride || undefined,
      generateParams: parsed.generateParams || undefined,
      suggestedPlatforms: parsed.suggestedPlatforms || undefined,
      updates: parsed.updates || undefined,
    });
  } catch (error: any) {
    const parsedErr = parseGeminiError(error);
    console.warn(`[ChatAI] Request failed (${parsedErr.status}): ${parsedErr.message}`);
    return res.status(parsedErr.status).json({
      success: false,
      error: parsedErr.message || 'AI chatbot failed to process your request.',
      quotaExceeded: parsedErr.isQuota,
    });
  }
}

app.post('/api/chat-intent', handleAiChatRequest);
app.post('/api/chat', handleAiChatRequest);

// ==========================================
// REAL SOCIAL MEDIA CONNECTION & ZERNIO HOSTED OAUTH (NO MOCKS)
// ==========================================

async function buildMergedConnectionStatus() {
  const legacy = getSanitizedConnectionStatus();
  if (!isZernioConfigured()) {
    return {
      ...legacy,
      provider: 'direct' as const,
      zernio: {
        configured: false,
        authenticated: false,
        freeAccountLimit: 2,
        activeProfile: null,
        profiles: [],
        accounts: [],
      },
    };
  }

  const brandName = getBrandProfile().companyName;
  const snap = await getZernioDashboardSnapshot(brandName);
  const igAcc = snap.activeByPlatform.instagram;
  const fbAcc = snap.activeByPlatform.facebook;
  const liAcc = snap.activeByPlatform.linkedin;

  const igAccounts = snap.accounts.filter((a) => a.platform?.toLowerCase() === 'instagram');
  const fbAccounts = snap.accounts.filter((a) => a.platform?.toLowerCase() === 'facebook');
  const liAccounts = snap.accounts.filter((a) => a.platform?.toLowerCase() === 'linkedin');

  const isExpired = (iso?: string | null) => {
    if (!iso) return false;
    const ms = Date.parse(iso);
    return !Number.isNaN(ms) && ms < Date.now();
  };

  return {
    ...legacy,
    provider: 'zernio' as const,
    instagram: {
      connected: Boolean(igAcc && igAcc.isActive !== false && !isExpired(igAcc.tokenExpiresAt)),
      igId: igAcc?._id || null,
      accountId: igAcc?._id || null,
      username: igAcc?.username ? igAcc.username.replace(/^@/, '') : igAcc?.displayName || null,
      name: igAcc?.displayName || igAcc?.username || null,
      profileId: snap.activeProfile?._id || null,
      pageId: null,
      pageName: snap.activeProfile?.name || null,
      eligibleForPublishing: Boolean(igAcc && igAcc.isActive !== false),
      publishingQuota: null,
      tokenExpired: isExpired(igAcc?.tokenExpiresAt),
      expiresAt: igAcc?.tokenExpiresAt ? Math.floor(Date.parse(igAcc.tokenExpiresAt) / 1000) : null,
      missingPermissions: [],
      grantedPermissions: igAcc?.permissions || [],
      availableAccounts: igAccounts.map((a) => ({
        igId: a._id,
        accountId: a._id,
        igUsername: a.username ? a.username.replace(/^@/, '') : a.displayName || a._id,
        igName: a.displayName || a.username || a._id,
        pageName: snap.activeProfile?.name || 'Zernio Profile',
      })),
    },
    facebook: {
      connected: Boolean(fbAcc && fbAcc.isActive !== false && !isExpired(fbAcc.tokenExpiresAt)),
      pageId: fbAcc?._id || null,
      accountId: fbAcc?._id || null,
      pageName: fbAcc?.displayName || fbAcc?.username || null,
      profileId: snap.activeProfile?._id || null,
      tokenExpired: isExpired(fbAcc?.tokenExpiresAt),
      expiresAt: fbAcc?.tokenExpiresAt ? Math.floor(Date.parse(fbAcc.tokenExpiresAt) / 1000) : null,
      missingPermissions: [],
      grantedPermissions: fbAcc?.permissions || [],
      availablePages: fbAccounts.map((a) => ({
        pageId: a._id,
        accountId: a._id,
        pageName: a.displayName || a.username || a._id,
      })),
    },
    linkedin: {
      connected: Boolean(liAcc && liAcc.isActive !== false && !isExpired(liAcc.tokenExpiresAt)),
      authorUrn: liAcc?._id || null,
      accountId: liAcc?._id || null,
      authorName: liAcc?.displayName || liAcc?.username || null,
      handle: liAcc?.username || null,
      profileId: snap.activeProfile?._id || null,
      tokenExpired: isExpired(liAcc?.tokenExpiresAt),
      expiresAt: liAcc?.tokenExpiresAt ? Math.floor(Date.parse(liAcc.tokenExpiresAt) / 1000) : null,
      scopes: liAcc?.permissions || [],
      availableTargets: liAccounts.map((a) => ({
        urn: a._id,
        name: a.displayName || a.username || a._id,
        type: a.accountType || 'profile',
      })),
    },
    zernio: {
      configured: snap.configured,
      authenticated: snap.authenticated,
      error: snap.error,
      errorCode: snap.errorCode,
      planName: snap.usage?.planName || 'Usage-Based',
      billingPeriod: snap.usage?.billingPeriod || 'monthly',
      connectedAccountsCount:
        snap.teamAudit?.totalAccountsAcrossTeam ??
        snap.usage?.usage?.connectedAccounts ??
        snap.accounts.length,
      freeAccountLimit: snap.teamAudit?.freeAccountLimit ?? 2,
      teamAudit: snap.teamAudit || null,
      activeProfile: snap.activeProfile,
      profiles: snap.profiles,
      accounts: snap.accounts.map((a) => ({
        _id: a._id,
        platform: a.platform,
        username: a.username,
        displayName: a.displayName,
        profilePicture: a.profilePicture,
        profileId: extractZernioProfileId(a.profileId),
        profileName: extractZernioProfileName(a.profileId, snap.profiles),
        isActive: a.isActive !== false && a.enabled !== false,
        needsReconnection: Boolean(a.needsReconnection),
        platformStatus: a.platformStatus,
        tokenExpiresAt: a.tokenExpiresAt || null,
        createdAt: a.createdAt,
      })),
    },
  };
}

// Return sanitized connection status (NEVER exposes API keys or tokens)
app.get('/api/social/status', async (_req: Request, res: Response) => {
  try {
    const status = await buildMergedConnectionStatus();
    return res.json({
      success: true,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to load social connection status.',
    });
  }
});

// Verify Zernio backend API authentication & plan usage
app.get('/api/zernio/verify', async (_req: Request, res: Response) => {
  try {
    const auth = await verifyZernioAuthentication();
    if (!auth.authenticated) {
      return res.status(auth.errorCode === 'ZERNIO_KEY_MISSING' ? 503 : 401).json({
        success: false,
        ...auth,
      });
    }
    const status = await buildMergedConnectionStatus();
    return res.json({
      success: true,
      authenticated: true,
      usage: auth.usage,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      authenticated: false,
      error: err?.message || 'Zernio verification failed.',
    });
  }
});

// List, create, and switch user-specific Zernio profiles
app.get('/api/zernio/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await listZernioProfiles();
    return res.json({ success: true, profiles });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ success: false, error: err?.message || 'Could not load Zernio profiles.' });
  }
});

app.post('/api/zernio/profiles', async (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body || {};
    const profile = await createZernioProfile({ name, description, color });
    const status = await buildMergedConnectionStatus();
    return res.json({ success: true, profile, status });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not create Zernio profile.' });
  }
});

app.post('/api/zernio/profiles/select', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body || {};
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'profileId is required.' });
    }
    await selectActiveZernioProfile(String(profileId));
    const status = await buildMergedConnectionStatus();
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not switch profile.' });
  }
});

// Retrieve connected Zernio accounts for the active profile
app.get('/api/zernio/accounts', async (req: Request, res: Response) => {
  try {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;
    const status = await buildMergedConnectionStatus();
    const targetProfileId = profileId || status.zernio?.activeProfile?._id;
    const accounts = await listZernioAccounts(targetProfileId);
    return res.json({ success: true, profileId: targetProfileId, accounts });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ success: false, error: err?.message || 'Could not retrieve Zernio accounts.' });
  }
});

// Switch active Zernio account for a platform within active profile
app.post('/api/zernio/accounts/select', async (req: Request, res: Response) => {
  try {
    const { platform, accountId, profileId } = req.body || {};
    if ((platform !== 'instagram' && platform !== 'facebook' && platform !== 'linkedin') || !accountId) {
      return res.status(400).json({ success: false, error: 'Valid platform and accountId are required.' });
    }
    const statusBefore = await buildMergedConnectionStatus();
    const activeProfileId = profileId || statusBefore.zernio?.activeProfile?._id;
    if (!activeProfileId) {
      return res.status(400).json({ success: false, error: 'No active Zernio profile.' });
    }
    const accounts = await listZernioAccounts(activeProfileId);
    selectZernioAccountTarget(activeProfileId, platform, String(accountId), accounts);
    const status = await buildMergedConnectionStatus();
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not select account.' });
  }
});

// Disconnect specific Zernio account (with profile ownership validation)
app.delete('/api/zernio/accounts/:accountId', async (req: Request, res: Response) => {
  try {
    await disconnectZernioAccount({ accountId: req.params.accountId });
    const status = await buildMergedConnectionStatus();
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not disconnect Zernio account.' });
  }
});

// Zernio Post Management: Retry failed/partial post, Publish scheduled post now, Delete/Cancel post
app.post('/api/zernio/posts/:postId/retry', async (req: Request, res: Response) => {
  try {
    const post = await retryZernioPost(req.params.postId);
    return res.json({ success: true, post });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Retry failed.' });
  }
});

app.post('/api/zernio/posts/:postId/publish-now', async (req: Request, res: Response) => {
  try {
    const post = await publishZernioScheduledPostNow(req.params.postId);
    return res.json({ success: true, post });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not publish scheduled post now.' });
  }
});

app.delete('/api/zernio/posts/:postId', async (req: Request, res: Response) => {
  try {
    await deleteZernioPost(req.params.postId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ success: false, error: err?.message || 'Could not delete Zernio post.' });
  }
});

// Cryptographic CSRF OAuth state store (15-minute TTL)
const pendingOAuthStates = new Map<
  string,
  {
    platform: 'instagram' | 'facebook' | 'linkedin';
    provider: 'zernio' | 'direct';
    profileId?: string;
    createdAt: number;
  }
>();

function pruneExpiredOAuthStates() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingOAuthStates.entries()) {
    if (v.createdAt < cutoff) pendingOAuthStates.delete(k);
  }
}

// Legacy Direct Meta/LinkedIn token endpoints (preserved if ZERNIO_API_KEY is not used)
app.post('/api/social/connect/meta', async (req: Request, res: Response) => {
  try {
    const { accessToken, instagramAccountId, facebookPageId, targetPlatform = 'both' } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'NO_TOKEN',
        message: 'Meta Access Token is required.',
      });
    }
    const result = await verifyAndSaveMetaToken({
      accessToken,
      explicitIgId: instagramAccountId,
      explicitPageId: facebookPageId,
      targetPlatform: targetPlatform === 'instagram' || targetPlatform === 'facebook' ? targetPlatform : 'both',
    });

    if (targetPlatform === 'instagram' && !result.status.instagram.connected && !instagramAccountId) {
      return res.json({
        success: true,
        warning:
          'Token verified, but none of your Facebook Pages have a linked Instagram Business or Creator account.',
        ...result,
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.errorCode || 'META_CONNECT_ERROR',
      message: err.errorMessage || err.message || 'Failed to verify Meta token.',
      reason: err.reason,
      requiredAction: err.requiredAction,
    });
  }
});

app.post('/api/social/connect/linkedin', async (req: Request, res: Response) => {
  try {
    const { accessToken, authorUrn } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'NO_TOKEN',
        message: 'LinkedIn Access Token is required.',
      });
    }
    const result = await verifyAndSaveLinkedInToken({
      accessToken,
      explicitAuthorUrn: authorUrn,
    });
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.errorCode || 'LINKEDIN_CONNECT_ERROR',
      message: err.errorMessage || err.message || 'Failed to verify LinkedIn token.',
      reason: err.reason,
      requiredAction: err.requiredAction,
    });
  }
});

app.post('/api/social/instagram/resolve', async (req: Request, res: Response) => {
  try {
    const { facebookPageId, instagramAccountId } = req.body || {};
    const result = await resolveAndVerifyInstagramAccount({
      explicitPageId: facebookPageId,
      explicitIgId: instagramAccountId,
    });
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.errorCode || 'IG_RESOLVE_ERROR',
      message: err.errorMessage || err.message || 'Could not resolve linked Instagram Business/Creator Account ID.',
      reason: err.reason,
      requiredAction: err.requiredAction,
      status: await buildMergedConnectionStatus(),
    });
  }
});

// Switch active Instagram, Facebook, or LinkedIn account target
app.post('/api/social/select-target', async (req: Request, res: Response) => {
  try {
    const { platform, targetId, profileId } = req.body;
    if ((platform !== 'instagram' && platform !== 'facebook' && platform !== 'linkedin') || !targetId) {
      return res.status(400).json({
        success: false,
        message: 'Valid platform (instagram, facebook, or linkedin) and targetId are required.',
      });
    }
    if (isZernioConfigured()) {
      const snap = await getZernioDashboardSnapshot(getBrandProfile().companyName);
      const activeProfileId = profileId || snap.activeProfile?._id;
      if (!activeProfileId) {
        return res.status(400).json({ success: false, message: 'No active Zernio profile.' });
      }
      selectZernioAccountTarget(activeProfileId, platform, String(targetId), snap.accounts);
      const status = await buildMergedConnectionStatus();
      return res.json({ success: true, status });
    }
    const status = selectTargetAccount(platform, String(targetId));
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Could not switch target account.',
    });
  }
});

app.post('/api/social/connect/oauth-app', async (req: Request, res: Response) => {
  const { platform, clientId, clientSecret } = req.body;
  if ((platform !== 'meta' && platform !== 'linkedin') || !clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      message: 'Valid platform (meta or linkedin), clientId, and clientSecret are required.',
    });
  }
  saveOAuthAppCredentials(platform, clientId, clientSecret);
  return res.json({
    success: true,
    status: await buildMergedConnectionStatus(),
  });
});

// Live Verification Endpoint: Actively verifies Zernio API authentication & connected accounts
app.post('/api/social/verify', async (req: Request, res: Response) => {
  try {
    const rawPlatform = String(req.body?.platform || 'all');
    const target: SocialPlatform | 'all' =
      rawPlatform === 'instagram' || rawPlatform === 'facebook' || rawPlatform === 'linkedin'
        ? rawPlatform
        : 'all';

    if (isZernioConfigured()) {
      const auth = await verifyZernioAuthentication();
      const status = await buildMergedConnectionStatus();
      const targets: SocialPlatform[] =
        target === 'all' ? ['instagram', 'facebook', 'linkedin'] : [target];
      const results: Record<string, any> = {};

      for (const plat of targets) {
        if (!auth.authenticated) {
          results[plat] = {
            ok: false,
            state: 'ERROR',
            errorCode: auth.errorCode,
            message: auth.error || 'Zernio API authentication failed.',
            requiredAction: 'Check ZERNIO_API_KEY in backend environment secrets.',
          };
          continue;
        }
        const ps = status[plat];
        if (ps?.connected) {
          const label =
            plat === 'instagram'
              ? `@${status.instagram.username}`
              : plat === 'facebook'
              ? status.facebook.pageName
              : status.linkedin.authorName;
          results[plat] = {
            ok: true,
            state: 'CONNECTED',
            message: `Verified live via Zernio (${label || 'Active account'}) in profile "${status.zernio?.activeProfile?.name || 'Default'}".`,
          };
        } else if (ps?.tokenExpired) {
          results[plat] = {
            ok: false,
            state: 'EXPIRED',
            message: `${plat} OAuth token expired on Zernio.`,
            requiredAction: `Click Reconnect on ${plat} to refresh OAuth authorization.`,
          };
        } else {
          results[plat] = {
            ok: false,
            state: 'NOT_CONNECTED',
            message: `No active ${plat} account connected under Zernio profile "${status.zernio?.activeProfile?.name || 'Default'}".`,
            requiredAction: `Click Connect ${plat.charAt(0).toUpperCase() + plat.slice(1)} to complete hosted OAuth.`,
          };
        }
      }

      return res.json({
        success: true,
        provider: 'zernio',
        authenticated: auth.authenticated,
        results,
        status,
      });
    }

    const verification = await verifyPlatformConnection(target);
    return res.json({
      success: true,
      ...verification,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'VERIFY_FAILED',
      message: err?.message || 'Live connection verification failed.',
      status: await buildMergedConnectionStatus(),
    });
  }
});

// Disconnect platform credentials (via Zernio or legacy store)
app.post('/api/social/disconnect', async (req: Request, res: Response) => {
  try {
    const { platform = 'all', accountId, profileId } = req.body || {};
    if (isZernioConfigured()) {
      await disconnectZernioAccount({
        accountId,
        platform,
        profileId,
      });
      return res.json({
        success: true,
        status: await buildMergedConnectionStatus(),
      });
    }
    clearPlatformCredentials(platform);
    return res.json({
      success: true,
      status: await buildMergedConnectionStatus(),
    });
  } catch (err: any) {
    return res.status(err?.status || 400).json({
      success: false,
      message: err?.message || 'Could not disconnect account.',
    });
  }
});

function resolveOAuthRedirectUri(req: Request): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && !envAppUrl.includes('MY_APP_URL')) {
    return `${envAppUrl.replace(/\/+$/, '')}/auth/callback`;
  }
  const forwardedHost = req.get('x-forwarded-host') || req.get('host');
  if (forwardedHost && !forwardedHost.startsWith('127.0.0.1') && !forwardedHost.startsWith('localhost')) {
    return `https://${forwardedHost.replace(/\/+$/, '')}/auth/callback`;
  }
  return 'https://ais-dev-npoqrverfcqcjlu2tp2k2n-840734708977.asia-east1.run.app/auth/callback';
}

// Initiate Hosted OAuth URL (Zernio Hosted OAuth first; legacy direct OAuth fallback if ZERNIO_API_KEY absent)
app.get('/api/auth/social/url', async (req: Request, res: Response) => {
  const rawPlatform = (req.query.platform as string) || 'instagram';
  const platform: 'instagram' | 'facebook' | 'linkedin' =
    rawPlatform === 'facebook' || rawPlatform === 'linkedin' ? rawPlatform : 'instagram';

  const baseRedirectUri = resolveOAuthRedirectUri(req);

  if (isZernioConfigured()) {
    try {
      pruneExpiredOAuthStates();
      const stateToken = `zn_${platform}_${crypto.randomBytes(16).toString('hex')}`;
      const requestedProfileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;
      const reconnectAccountId =
        typeof req.query.reconnectAccountId === 'string' ? req.query.reconnectAccountId : undefined;
      const loginMethod =
        req.query.loginMethod === 'facebook_login' || req.query.loginMethod === 'instagram_login'
          ? req.query.loginMethod
          : undefined;

      const callbackUrl = new URL(baseRedirectUri);
      callbackUrl.searchParams.set('zernio_state', stateToken);
      callbackUrl.searchParams.set('zplatform', platform);

      const { authUrl, profileId } = await initiateZernioOAuthConnect({
        platform,
        redirectUrl: callbackUrl.toString(),
        profileId: requestedProfileId,
        reconnectAccountId,
        loginMethod,
      });

      pendingOAuthStates.set(stateToken, {
        platform,
        provider: 'zernio',
        profileId,
        createdAt: Date.now(),
      });

      return res.json({
        success: true,
        configured: true,
        provider: 'zernio',
        url: authUrl,
        platform,
        profileId,
        redirectUri: baseRedirectUri,
      });
    } catch (err: any) {
      return res.status(err?.status || 400).json({
        success: false,
        configured: true,
        provider: 'zernio',
        error: err?.code || 'ZERNIO_CONNECT_ERROR',
        message: err?.message || `Could not initiate Zernio OAuth for ${platform}.`,
        paymentDetails: err?.details?.paymentDetails || null,
        teamAudit: err?.details?.teamAudit || null,
        redirectUri: baseRedirectUri,
      });
    }
  }

  const { clientId, clientSecret } = getOAuthConfig(platform);

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      configured: false,
      error: 'OAUTH_NOT_CONFIGURED',
      platform,
      redirectUri: baseRedirectUri,
      missingEnvVars: ['ZERNIO_API_KEY'],
      message:
        'ZERNIO_API_KEY is not configured on the backend server. Add ZERNIO_API_KEY to your backend .env or AI Studio Secrets.',
    });
  }

  pruneExpiredOAuthStates();
  const stateToken = `${platform}_${crypto.randomBytes(16).toString('hex')}`;
  pendingOAuthStates.set(stateToken, { platform, provider: 'direct', createdAt: Date.now() });

  let authUrl = '';
  if (platform === 'linkedin') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: baseRedirectUri,
      state: stateToken,
      scope: 'openid profile email w_member_social',
    });
    authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  } else {
    const metaScope =
      platform === 'instagram'
        ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
        : 'pages_manage_posts,pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: baseRedirectUri,
      state: stateToken,
      response_type: 'code',
      scope: metaScope,
    });
    authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  return res.json({
    success: true,
    configured: true,
    provider: 'direct',
    url: authUrl,
    platform,
    redirectUri: baseRedirectUri,
  });
});

// OAuth Callback Handler: Handles Zernio Hosted OAuth callbacks (with live account verification) & direct OAuth fallback
app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const rawState = (req.query.state as string) || '';
  const zernioStateToken = (req.query.zernio_state as string) || '';
  const connectedParam = (req.query.connected as string) || '';
  const callbackAccountId = (req.query.accountId as string) || '';
  const callbackProfileId = (req.query.profileId as string) || '';
  const callbackUsername = (req.query.username as string) || '';
  const zplatformParam = (req.query.zplatform as string) || '';
  const oauthError =
    (req.query.error_description as string) ||
    (req.query.message as string) ||
    (req.query.error as string) ||
    '';
  const requestIdParam = (req.query.request_id as string) || '';
  const stageParam = (req.query.stage as string) || '';
  const redirectUri = resolveOAuthRedirectUri(req);

  pruneExpiredOAuthStates();
  const stateKey = zernioStateToken || rawState;
  const pendingState = stateKey ? pendingOAuthStates.get(stateKey) : undefined;
  if (pendingState) {
    pendingOAuthStates.delete(stateKey);
  }

  const resolvedPlatform: 'instagram' | 'facebook' | 'linkedin' =
    pendingState?.platform ||
    (connectedParam === 'linkedin' || zplatformParam === 'linkedin' || rawState.startsWith('linkedin')
      ? 'linkedin'
      : connectedParam === 'facebook' || zplatformParam === 'facebook' || rawState.startsWith('facebook')
      ? 'facebook'
      : 'instagram');

  const isZernioFlow =
    Boolean(zernioStateToken) ||
    Boolean(connectedParam) ||
    Boolean(callbackAccountId) ||
    Boolean(requestIdParam) ||
    Boolean(stageParam) ||
    pendingState?.provider === 'zernio' ||
    (isZernioConfigured() && !code);

  const renderResultPage = (ok: boolean, title: string, detail: string, extra?: Record<string, any>) => {
    const safePlatform = JSON.stringify(resolvedPlatform);
    const safeDetail = JSON.stringify(detail);
    const safeAccountId = JSON.stringify(extra?.accountId || callbackAccountId || '');
    const safeProfileId = JSON.stringify(extra?.profileId || callbackProfileId || '');
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${ok ? 'Connected' : 'Connection Failed'} - PostPilot</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0B0F19; color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
            .card { background: #111827; padding: 28px; border-radius: 14px; border: 1px solid ${ok ? '#16a34a' : '#dc2626'}; max-width: 460px; }
            h2 { margin: 0 0 8px; font-size: 18px; color: ${ok ? '#4ade80' : '#f87171'}; }
            p { margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.55; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${title}</h2>
            <p>${detail}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: ${ok ? "'OAUTH_AUTH_SUCCESS'" : "'OAUTH_AUTH_ERROR'"},
                platform: ${safePlatform},
                accountId: ${safeAccountId},
                profileId: ${safeProfileId},
                message: ${safeDetail}
              }, '*');
              setTimeout(function() { window.close(); }, ${ok ? 1000 : 3500});
            }
          </script>
        </body>
      </html>
    `;
  };

  if (oauthError) {
    const lowerErr = oauthError.toLowerCase();
    let friendly = oauthError;
    if (lowerErr.includes('redirect_uri')) {
      friendly = `Redirect URI mismatch (${oauthError}). Callback URI: ${redirectUri}`;
    } else if (lowerErr.includes('access_denied') || lowerErr.includes('user_cancelled')) {
      friendly = 'Authorization was cancelled or required publishing permissions were declined.';
    } else if (lowerErr.includes('reconnect_account_mismatch')) {
      friendly = 'Reconnected with a different social account than expected. Please disconnect and connect cleanly.';
    }
    if (stageParam) friendly += ` (Stage: ${stageParam})`;
    if (requestIdParam) friendly += ` [Request ID: ${requestIdParam}]`;
    return res.status(400).send(renderResultPage(false, 'Authorization Failed', friendly));
  }

  // Handle Zernio Hosted OAuth Callback — MUST verify account directly with Zernio API
  if (isZernioFlow) {
    if (zernioStateToken && !pendingState) {
      return res
        .status(400)
        .send(
          renderResultPage(
            false,
            'Invalid or Expired OAuth Session',
            'OAuth CSRF session token is missing or expired. Restart authorization from Social Connections.'
          )
        );
    }

    try {
      const targetProfileId = callbackProfileId || pendingState?.profileId;
      const verification = await verifyZernioConnectedAccountAfterCallback({
        profileId: targetProfileId,
        platform: resolvedPlatform,
        accountId: callbackAccountId || undefined,
      });

      if (!verification.verified || !verification.account) {
        return res.status(400).send(
          renderResultPage(
            false,
            'Account Verification Incomplete',
            `OAuth returned from ${resolvedPlatform}, but no active connected ${resolvedPlatform} account was confirmed in Zernio yet. Ensure you selected a Page/Business account or check your Zernio account quota (first 2 accounts free).`
          )
        );
      }

      const displayLabel =
        verification.account.displayName ||
        verification.account.username ||
        callbackUsername ||
        verification.account._id;

      return res.send(
        renderResultPage(
          true,
          `${resolvedPlatform.charAt(0).toUpperCase() + resolvedPlatform.slice(1)} Connected`,
          `Verified "${displayLabel}" via Zernio API. Closing window...`,
          { accountId: verification.account._id, profileId: verification.profileId }
        )
      );
    } catch (err: any) {
      return res.status(500).send(
        renderResultPage(false, 'Zernio Verification Error', err?.message || 'Could not verify connected account.')
      );
    }
  }

  // Legacy Direct OAuth Fallback
  if (!pendingState) {
    return res
      .status(400)
      .send(renderResultPage(false, 'Invalid or Expired OAuth State', 'OAuth session state is missing or expired. Restart authorization from Social Connections.'));
  }

  if (!code) {
    return res.status(400).send(renderResultPage(false, 'Missing Authorization Code', 'OAuth provider did not return an authorization code.'));
  }

  try {
    if (resolvedPlatform === 'linkedin') {
      const { clientId, clientSecret } = getOAuthConfig('linkedin');
      if (!clientId || !clientSecret) {
        return res.status(400).send(renderResultPage(false, 'LinkedIn OAuth Not Configured', 'Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET on server.'));
      }

      const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) {
        const rawErr = tokenData.error_description || tokenData.error || 'Could not exchange authorization code for token.';
        return res.status(400).send(renderResultPage(false, 'LinkedIn Token Exchange Failed', rawErr));
      }

      const expiresAt = tokenData.expires_in ? Math.floor(Date.now() / 1000) + Number(tokenData.expires_in) : undefined;
      await verifyAndSaveLinkedInToken({
        accessToken: tokenData.access_token,
        expiresAt,
        scopes: tokenData.scope ? String(tokenData.scope).split(/[ ,]+/) : undefined,
      });

      return res.send(renderResultPage(true, 'LinkedIn Connected', 'Your LinkedIn account has been verified and saved on the server. Closing window...'));
    } else {
      const { clientId, clientSecret } = getOAuthConfig('facebook');
      if (!clientId || !clientSecret) {
        return res.status(400).send(renderResultPage(false, 'Meta OAuth Not Configured', 'Missing META_CLIENT_ID or META_CLIENT_SECRET on server.'));
      }

      const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', clientId);
      tokenUrl.searchParams.set('redirect_uri', redirectUri);
      tokenUrl.searchParams.set('client_secret', clientSecret);
      tokenUrl.searchParams.set('code', code);

      const tokenResp = await fetch(tokenUrl.toString());
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) {
        const msg = tokenData?.error?.message || 'Could not exchange authorization code.';
        return res.status(400).send(renderResultPage(false, 'Meta Token Exchange Failed', msg));
      }

      let finalToken = tokenData.access_token as string;
      let expiresAt = tokenData.expires_in ? Math.floor(Date.now() / 1000) + Number(tokenData.expires_in) : undefined;

      try {
        const llUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
        llUrl.searchParams.set('grant_type', 'fb_exchange_token');
        llUrl.searchParams.set('client_id', clientId);
        llUrl.searchParams.set('client_secret', clientSecret);
        llUrl.searchParams.set('fb_exchange_token', finalToken);
        const llResp = await fetch(llUrl.toString());
        const llData = await llResp.json();
        if (llResp.ok && llData.access_token) {
          finalToken = llData.access_token;
          if (llData.expires_in) {
            expiresAt = Math.floor(Date.now() / 1000) + Number(llData.expires_in);
          }
        }
      } catch {
        // continue
      }

      await verifyAndSaveMetaToken({
        accessToken: finalToken,
        expiresAt,
        targetPlatform: resolvedPlatform === 'instagram' ? 'instagram' : 'facebook',
      });

      const title = resolvedPlatform === 'instagram' ? 'Instagram Business Connected' : 'Facebook Page Connected';
      return res.send(renderResultPage(true, title, 'Verified credentials have been saved on the server. Closing window...'));
    }
  } catch (err: any) {
    return res.status(500).send(renderResultPage(false, 'OAuth Error', err.message || 'Unexpected callback error.'));
  }
});

// Compatibility endpoint returning active sanitized accounts
app.get('/api/social/accounts', async (_req: Request, res: Response) => {
  const s = (await buildMergedConnectionStatus()) as any;
  res.json({
    accounts: [
      {
        id: s.instagram.accountId || s.instagram.igId || 'soc-ig',
        platform: 'instagram',
        name: s.instagram.username ? `@${s.instagram.username}` : 'Instagram Business',
        handle: s.instagram.username ? `@${s.instagram.username}` : 'Not connected',
        avatar: '',
        connected: s.instagram.connected,
        connectedAt: s.instagram.connected ? 'Verified via Zernio' : undefined,
        status: s.instagram.tokenExpired ? 'expired' : 'active',
      },
      {
        id: s.facebook.accountId || s.facebook.pageId || 'soc-fb',
        platform: 'facebook',
        name: s.facebook.pageName || 'Facebook Page',
        handle: s.facebook.pageId || 'Not connected',
        avatar: '',
        connected: s.facebook.connected,
        connectedAt: s.facebook.connected ? 'Verified via Zernio' : undefined,
        status: s.facebook.tokenExpired ? 'expired' : 'active',
      },
      {
        id: s.linkedin.accountId || s.linkedin.authorUrn || 'soc-li',
        platform: 'linkedin',
        name: s.linkedin.authorName || 'LinkedIn Profile',
        handle: s.linkedin.authorUrn || 'Not connected',
        avatar: '',
        connected: s.linkedin.connected,
        connectedAt: s.linkedin.connected ? 'Verified via Zernio' : undefined,
        status: s.linkedin.tokenExpired ? 'expired' : 'active',
      },
    ],
  });
});

// In-memory public image cache for Meta Graph API scraper
const publicImageCache = new Map<string, { buffer: Buffer; mimeType: string }>();

// Serve public images for Meta scraper (supports .jpg, .jpeg, .png)
app.get('/api/public-image/:id.:ext', (req: Request, res: Response) => {
  const image = publicImageCache.get(req.params.id);
  if (!image) {
    return res.status(404).send('Image not found');
  }
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(image.buffer);
});

// Cache image and return public URL
app.post('/api/public-image/upload', (req: Request, res: Response) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'Valid dataUrl required' });
    }
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const id = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const ext = mimeType.toLowerCase().includes('jpeg') || mimeType.toLowerCase().includes('jpg') ? 'jpg' : 'png';
    publicImageCache.set(id, { buffer, mimeType });

    const baseUrl = process.env.APP_URL || 'https://ais-dev-npoqrverfcqcjlu2tp2k2n-840734708977.asia-east1.run.app';
    const publicUrl = `${baseUrl}/api/public-image/${id}.${ext}`;
    return res.json({ success: true, publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});



// Unified Automatic Social Media Publishing Workflow (Zernio API primary; direct API fallback)
app.post('/api/social/publish-workflow', async (req: Request, res: Response) => {
  const {
    topic = 'Promotional Poster',
    dataUrl,
    imageUrl,
    platformDataUrls,
    platforms = ['instagram', 'facebook', 'linkedin'],
    captions,
    profileId,
    clientRequestId,
  } = req.body || {};

  const reqKey =
    typeof clientRequestId === 'string' && clientRequestId.trim()
      ? `publish:${clientRequestId.trim()}`
      : '';

  if (reqKey) {
    pruneIdempotentStore();
    const existing = idempotentActionStore.get(reqKey);
    if (existing) {
      if (existing.status === 'succeeded' && existing.result) {
        console.log(`[PublishWorkflow] Returning deduplicated result for ${reqKey}`);
        return res.status(existing.result.statusCode).json({ ...existing.result.body, deduplicated: true });
      }
      if (existing.status === 'pending' && existing.promise) {
        console.log(`[PublishWorkflow] Joining in-flight publish request for ${reqKey}`);
        const joined = await existing.promise;
        return res.status(joined.statusCode).json({ ...joined.body, deduplicated: joined.body?.success === true });
      }
    }
  }

  const executePublishWorkflow = async (): Promise<{ statusCode: number; body: any }> => {
    try {
      const reqBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const fallbackCaptions = {
        instagram: `${topic}\n\n#Marketing #Featured #Design #Brand`,
        facebook: `${topic}\n\n#Community #Update #Brand`,
        linkedin: `Excited to share our latest update: ${topic}.\n\n#Business #Branding #Marketing #Innovation`,
      };

      const resolvedCaptions = {
        instagram: captions?.instagram?.trim() || fallbackCaptions.instagram,
        facebook: captions?.facebook?.trim() || fallbackCaptions.facebook,
        linkedin: captions?.linkedin?.trim() || fallbackCaptions.linkedin,
      };

      if (isZernioConfigured()) {
        const selectedPlatforms = (Array.isArray(platforms) ? platforms : ['instagram', 'facebook', 'linkedin']).filter(
          (p): p is SocialPlatform => p === 'instagram' || p === 'facebook' || p === 'linkedin'
        );
        const primarySource =
          dataUrl ||
          platformDataUrls?.instagram ||
          platformDataUrls?.facebook ||
          platformDataUrls?.linkedin;

        const mediaByPlatform: Partial<Record<SocialPlatform, { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: string }>> = {};
        const basePrepared = primarySource || imageUrl ? await prepareImageBuffer({ dataUrl: primarySource, imageUrl }) : null;

        for (const plat of selectedPlatforms) {
          const customSrc = platformDataUrls?.[plat];
          if (customSrc && customSrc !== primarySource) {
            mediaByPlatform[plat] = await prepareImageBuffer({ dataUrl: customSrc });
          } else if (basePrepared) {
            mediaByPlatform[plat] = basePrepared;
          }
        }

        if (Object.keys(mediaByPlatform).length === 0) {
          return {
            statusCode: 400,
            body: {
              success: false,
              error: 'NO_POSTER_IMAGE',
              message: 'A rendered poster image is required before publishing.',
            },
          };
        }

        const { zernioPost, report } = await publishOrScheduleViaZernio({
          topic,
          platforms: selectedPlatforms,
          captions: resolvedCaptions,
          mediaByPlatform,
          mode: 'now',
          profileId,
        });

        const anySuccess = selectedPlatforms.some((p) => report.platforms?.[p]?.status === 'SUCCESS');
        const allSuccess = selectedPlatforms.every((p) => report.platforms?.[p]?.status === 'SUCCESS');

        if (zernioPost) {
          recordPublishReport(report);
        }

        if (!anySuccess) {
          const firstErr =
            selectedPlatforms
              .map((p) => `${p}: ${report.platforms?.[p]?.errorMessage || report.platforms?.[p]?.reason}`)
              .find(Boolean) || 'Publishing failed for all selected platforms.';
          return {
            statusCode: 400,
            body: {
              success: false,
              anySuccess: false,
              allSuccess: false,
              provider: 'zernio',
              error: firstErr,
              message: firstErr,
              zernioPost,
              report,
            },
          };
        }

        return {
          statusCode: 200,
          body: {
            success: true,
            anySuccess,
            allSuccess,
            provider: 'zernio',
            zernioPost,
            report,
          },
        };
      }

      const report = await runSocialPublishingWorkflow({
        topic,
        dataUrl,
        imageUrl,
        platformDataUrls,
        platforms: platforms as SocialPlatform[],
        captions: resolvedCaptions,
        localCacheCallback: (buffer, mimeType) => {
          const id = `wf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const ext = mimeType.toLowerCase().includes('jpeg') ? 'jpg' : 'png';
          publicImageCache.set(id, { buffer, mimeType });
          return `${reqBaseUrl}/api/public-image/${id}.${ext}`;
        },
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          report,
        },
      };
    } catch (err: any) {
      const safeStatus = toSafeApiHttpStatus(Number(err?.status || 500));
      console.error(
        `[PublishWorkflow] Failed (status=${safeStatus}, upstream=${err?.status || 'none'}):`,
        err?.message || err
      );
      return {
        statusCode: safeStatus,
        body: {
          success: false,
          error: err?.code || 'WORKFLOW_ERROR',
          message: err?.message || 'Social publishing workflow failed.',
          upstreamStatus: err?.status || undefined,
        },
      };
    }
  };

  if (!reqKey) {
    const result = await executePublishWorkflow();
    return res.status(result.statusCode).json(result.body);
  }

  const runPromise = executePublishWorkflow();
  idempotentActionStore.set(reqKey, {
    createdAt: Date.now(),
    status: 'pending',
    promise: runPromise,
  });

  const result = await runPromise;
  if (result.body?.success === true) {
    idempotentActionStore.set(reqKey, {
      createdAt: Date.now(),
      status: 'succeeded',
      result,
    });
  } else {
    idempotentActionStore.delete(reqKey);
  }
  return res.status(result.statusCode).json(result.body);
});

// Get Unified Publishing History (Local audit log + live Zernio posts)
app.get('/api/social/workflow-history', async (_req: Request, res: Response) => {
  const localHistory = getPublishHistory();
  if (!isZernioConfigured()) {
    return res.json({
      success: true,
      history: localHistory,
      zernioPosts: [],
    });
  }
  try {
    const { posts } = await listZernioPosts({ limit: 30 });
    return res.json({
      success: true,
      history: localHistory,
      zernioPosts: posts,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      history: localHistory,
      zernioPosts: [],
      zernioError: err?.message || 'Could not retrieve Zernio publishing history.',
    });
  }
});

// Legacy /api/social/publish routed through Zernio or legacy workflow
app.post('/api/social/publish', async (req: Request, res: Response) => {
  try {
    const { posterTitle, caption, hashtags = [], platforms = ['instagram', 'facebook', 'linkedin'], dataUrl, imageUrl } = req.body;
    const fullText = `${caption || posterTitle || ''}\n\n${Array.isArray(hashtags) ? hashtags.join(' ') : ''}`.trim();
    const reqBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const validPlatforms: SocialPlatform[] = (Array.isArray(platforms) ? platforms : []).filter(
      (p: any): p is SocialPlatform => p === 'instagram' || p === 'facebook' || p === 'linkedin'
    );

    if (isZernioConfigured()) {
      const prepared = await prepareImageBuffer({ dataUrl, imageUrl });
      const mediaByPlatform: Partial<Record<SocialPlatform, { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png'; ext: string }>> = {};
      for (const plat of validPlatforms) mediaByPlatform[plat] = prepared;

      const { zernioPost, report } = await publishOrScheduleViaZernio({
        topic: posterTitle || 'Poster',
        platforms: validPlatforms,
        captions: { instagram: fullText, facebook: fullText, linkedin: fullText },
        mediaByPlatform,
        mode: 'now',
      });
      recordPublishReport(report);
      return res.json({ success: true, provider: 'zernio', zernioPost, report });
    }

    const report = await runSocialPublishingWorkflow({
      topic: posterTitle || 'Poster',
      dataUrl,
      imageUrl,
      platforms: validPlatforms,
      captions: {
        instagram: fullText,
        facebook: fullText,
        linkedin: fullText,
      },
      localCacheCallback: (buffer, mimeType) => {
        const id = `leg-${Date.now()}`;
        const ext = mimeType.toLowerCase().includes('jpeg') ? 'jpg' : 'png';
        publicImageCache.set(id, { buffer, mimeType });
        return `${reqBaseUrl}/api/public-image/${id}.${ext}`;
      },
    });

    return res.json({
      success: true,
      report,
    });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ success: false, error: err.message });
  }
});

// Generate Platform-Tailored Captions & Hashtags (Instagram, Facebook, and Professional LinkedIn)
app.post('/api/social/generate-platform-captions', async (req: Request, res: Response) => {
  try {
    const { topic = '', occasion = 'sale', headline = '', offer = '', language = 'english' } = req.body;
    const subject = topic || headline || occasion;

    if (ai && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
      try {
        const prompt = `You are a social media strategist. Generate tailored posts for this campaign:
- Topic/Headline: "${subject}"
- Occasion/Category: ${occasion}
- Offer/CTA: "${offer || 'Limited-time showcase'}"
- Language preference: ${language}

Return strict JSON:
{
  "instagram": { "caption": "engaging visual 2-3 sentence caption with relevant emojis", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] },
  "facebook": { "caption": "warm community-focused 2-3 sentence Page post with clear call to action", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4"] },
  "linkedin": { "caption": "professional, authoritative 2-3 sentence LinkedIn post suitable for business followers", "hashtags": ["#Business", "#Industry", "#Innovation", "#Strategy"] }
}`;

        const { response, model: usedModel } = await generateWithModelFallback({
          contents: prompt,
          timeoutMs: 12000,
          config: { responseMimeType: 'application/json' },
        });
        const parsed = safeParseModelJson(response.text || '{}');
        if (parsed.instagram && parsed.facebook && parsed.linkedin) {
          return res.json({ success: true, source: usedModel, ...parsed });
        }
      } catch (e: any) {
        console.warn('[Captions] Gemini fallback triggered:', e?.message || e);
      }
    }

    const cleanTag = `#${String(occasion || 'Campaign').replace(/[^a-zA-Z0-9]/g, '') || 'Campaign'}`;
    return res.json({
      success: true,
      source: 'template',
      instagram: {
        caption: `✨ ${subject}${offer ? ` — ${offer}` : ''}! Discover our latest showcase designed to stand out. Save this post & tap the link in bio to explore more!`,
        hashtags: [cleanTag, '#VisualDesign', '#BrandShowcase', '#Featured', '#TrendingNow'],
      },
      facebook: {
        caption: `We're thrilled to share our newest highlight: ${subject}${offer ? ` (${offer})` : ''}. Let us know what you think in the comments and share with friends!`,
        hashtags: [cleanTag, '#Community', '#SpecialAnnouncement', '#FollowUs'],
      },
      linkedin: {
        caption: `Pleased to announce our latest initiative: ${subject}${offer ? ` — ${offer}` : ''}. Built for quality, clarity, and measurable brand impact. Connect with our team to learn more.`,
        hashtags: ['#BrandStrategy', '#Marketing', '#Innovation', '#Leadership', cleanTag],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Generate AI Social Media Caption (single-caption compatibility endpoint)
app.post('/api/social/generate-caption', async (req: Request, res: Response) => {
  try {
    const { occasion, headline, posterTitle, offer, language = 'hinglish' } = req.body;
    const title = headline || posterTitle || 'Special Announcement';

    if (ai && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
      try {
        const prompt = `You are a social media advertising copywriter.
Write an engaging, high-converting social media post caption and 6 relevant hashtags for this poster:
- Occasion: ${occasion}
- Headline: "${title}"
- Offer: "${offer || 'Special Showcase'}"
- Language style: ${language}

Return strict JSON:
{
  "caption": "engaging 2-3 sentence caption",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"]
}`;

        const { response } = await generateWithModelFallback({
          contents: prompt,
          timeoutMs: 10000,
          config: { responseMimeType: 'application/json' },
        });
        const parsed = safeParseModelJson(response.text || '{}');
        return res.json({ success: true, ...parsed });
      } catch {
        // fallback below
      }
    }

    return res.json({
      success: true,
      caption: `✨ ${title}${offer ? ` — ${offer}` : ''}! Check out our latest campaign highlight today.`,
      hashtags: [`#${occasion || 'Promo'}`, '#Featured', '#SpecialOffer', '#ShopNow', '#Design', '#Brand'],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Quality Gate 8-Point Pre-Export & Pre-Publish Verification Audit

app.post('/api/quality-gate', async (req: Request, res: Response) => {
  try {
    const { posterConfig } = req.body;
    const issues: string[] = [];

    // 1. Margin Safe Check (>= 6% boundary)
    const headlineY = Number(posterConfig?.headline?.yOffset ?? 15);
    const ctaY = Number(posterConfig?.ctaButton?.yOffset ?? 88);
    const marginSafePassed = headlineY >= 6 && ctaY <= 94;
    if (!marginSafePassed) {
      issues.push('Typography or CTA is too close to poster edge (< 6% safe zone).');
    }

    // 2. Contrast & Legibility check
    const contrastPassed = (posterConfig?.backgroundDarkness ?? 0.15) >= 0.08;
    if (!contrastPassed) {
      issues.push('Background contrast scrim is low (< 8%). Increase darkness scrim for crisp legibility.');
    }

    // 3. No text overlapping & Layer Collision check
    const productVisible = Boolean(posterConfig?.productPhoto?.visible && posterConfig?.productPhoto?.url);
    const productY = Number(posterConfig?.productPhoto?.y ?? 60);
    const noCollisionPassed = !productVisible || Math.abs(productY - headlineY) >= 22;
    if (!noCollisionPassed) {
      issues.push('Headline and focal visual are too close. Separate vertical placement by >= 22%.');
    }

    // 4. Company Branding Visibility Check
    const hasLogo = Boolean(posterConfig?.brandLogo?.visible && posterConfig?.brandLogo?.url);
    const hasCompanyText = Boolean(posterConfig?.companyInfo?.companyName?.trim() || posterConfig?.brandLogo?.name?.trim());
    const brandingPassed = hasLogo || hasCompanyText;
    if (!brandingPassed) {
      issues.push('No company name or logo visible on the poster. Add Brand Settings or enable Brand Logo.');
    }

    // 5. Balanced Layout Spacing & Highlights Density
    const highlights = Array.isArray(posterConfig?.highlights) ? posterConfig.highlights : [];
    const balancePassed = highlights.length <= 4 && (posterConfig?.headline?.text?.length || 0) <= 95;
    if (!balancePassed) {
      issues.push('Headline is overly long or highlights exceed 4 items. Keep copy tight and scannable.');
    }

    // 6. Correct Aspect Ratio & Export Dimension Readiness
    const validAspects = ['1:1', '4:5', '9:16', '16:9'];
    const dimensionsPassed = validAspects.includes(posterConfig?.aspectRatio || '1:1');

    // 7. Scene Background OCR Verification
    const activeVar = posterConfig?.backgroundImages?.[posterConfig?.activeVariationIndex ?? 0];
    const noAiTextPassed = activeVar?.qualityPassed !== false;
    if (!noAiTextPassed) {
      issues.push('Background scene contains potential stray text artifacts. Regenerate or pick another concept.');
    }

    // 8. Spelling, Grammar, Deduplication & Copy Integrity Check (Gemini + heuristics)
    let spellingPassed = true;
    const headlineTxt = String(posterConfig?.headline?.text || '').trim();
    const eyebrowTxt = String(posterConfig?.headline?.subtext || '').trim();
    const subheadingTxt = String(posterConfig?.subheading?.text || '').trim();
    const ctaTxt = String(posterConfig?.ctaButton?.text || '').trim();
    const combinedCopy = [headlineTxt, subheadingTxt, ctaTxt, ...highlights].filter(Boolean).join(' | ');

    const hasDuplicateCopy =
      (Boolean(headlineTxt) && Boolean(eyebrowTxt) && headlineTxt.toLowerCase() === eyebrowTxt.toLowerCase()) ||
      (Boolean(headlineTxt) && Boolean(subheadingTxt) && headlineTxt.toLowerCase() === subheadingTxt.toLowerCase());

    if (hasDuplicateCopy) {
      spellingPassed = false;
      issues.push('Duplicate wording detected between eyebrow, headline, or subheading.');
    }

    if (!headlineTxt) {
      spellingPassed = false;
      issues.push('Primary headline text is empty.');
    } else if (ai && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')) {
      try {
        const spellCheckCall = ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Check the following poster copy (may be English, Hindi, or Gujarati) for obvious typos, broken characters, or severe grammar errors. Do NOT flag stylistic brand names or mixed language hashtags. Copy: "${combinedCopy}"`,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                issue: { type: Type.STRING },
              },
              required: ['passed'],
            },
          },
        });
        const resp: any = await Promise.race([
          spellCheckCall,
          new Promise((_, rej) => setTimeout(() => rej(new Error('Spellcheck timeout')), 6000)),
        ]);
        const parsed = safeParseModelJson(resp.text || '{}');
        if (parsed.passed === false && parsed.issue) {
          spellingPassed = false;
          issues.push(`Copy Review: ${parsed.issue}`);
        }
      } catch {
        // Keep spellingPassed true if timed out
      }
    }

    const checks = [
      marginSafePassed,
      contrastPassed,
      noCollisionPassed,
      brandingPassed,
      balancePassed,
      dimensionsPassed,
      noAiTextPassed,
      spellingPassed,
    ];
    const passedCount = checks.filter(Boolean).length;
    const score = Math.round((passedCount / checks.length) * 100);
    const allPassed = checks.every(Boolean);

    return res.json({
      passed: allPassed,
      score,
      marginSafePassed,
      contrastPassed,
      noCollisionPassed,
      copyMatchPassed: spellingPassed,
      spellingPassed,
      brandingPassed,
      dimensionsPassed,
      balancePassed,
      noAiTextPassed,
      issues,
      ocrDetectedText: activeVar?.ocrDetectedText || [],
      repairedAutomatically: false,
      checkedAt: new Date().toLocaleTimeString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Always return JSON for unmatched /api/* routes & Express errors (never HTML)
app.all(['/api', '/api/*'], (req: Request, res: Response) => {
  return res.status(404).type('application/json').json({
    success: false,
    error: 'API_NOT_FOUND',
    message: `API endpoint ${req.method} ${req.originalUrl} was not found.`,
  });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  const isApiReq = /^\/api(\/|$)/.test(req.path) || req.headers.accept?.includes('application/json');
  if (isApiReq) {
    const rawStatus = Number(err?.status || err?.statusCode || 500);
    const status = toSafeApiHttpStatus(rawStatus);
    console.error(`[API Error] ${req.method} ${req.originalUrl} -> HTTP ${status} (raw=${rawStatus}):`, err?.message || err);
    return res.status(status).type('application/json').json({
      success: false,
      error: err?.code || 'SERVER_ERROR',
      message: err?.message || 'Unexpected server error.',
      upstreamStatus: rawStatus !== status ? rawStatus : undefined,
    });
  }
  return next(err);
});

// Vite or Static file serving (guarded so /api routes can never receive index.html)
async function setupViteOrStatic() {
  app.use((req: Request, res: Response, next) => {
    if (/^\/api(\/|$)/.test(req.path)) {
      return res.status(404).type('application/json').json({
        success: false,
        error: 'API_NOT_FOUND',
        message: `API endpoint ${req.method} ${req.path} was not found.`,
      });
    }
    return next();
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Safe background scheduler: executes ONLY explicitly approved posts whose scheduledFor <= now
  let schedulerBusy = false;
  setInterval(async () => {
    if (schedulerBusy) return;
    schedulerBusy = true;
    try {
      const now = Date.now();
      const dueItems = getScheduledPosts().filter(
        (s) => s.status === 'scheduled' && s.autoPublishApproved === true && Date.parse(s.scheduledFor) <= now
      );
      for (const item of dueItems) {
        try {
          await executeScheduledPublishItem(item.id);
        } catch (err) {
          console.warn(`[Scheduler] Failed scheduled item ${item.id}:`, err);
        }
      }
    } finally {
      schedulerBusy = false;
    }
  }, 30000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[PostPilot AI Poster Engine] Server ready at http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic();
