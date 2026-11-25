export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  contentType: string;
  isHtmlError?: boolean;
  data: T | null;
  error?: string;
}

export async function safeParseResponseJson<T = any>(resp: Response): Promise<SafeJsonResult<T>> {
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  let rawText = '';

  try {
    rawText = await resp.text();
  } catch (err: any) {
    return {
      ok: false,
      status: resp.status || 0,
      contentType,
      data: null,
      error: err?.message || 'Network connection interrupted while reading server response.',
    };
  }

  if (!rawText || !rawText.trim()) {
    return {
      ok: resp.ok,
      status: resp.status,
      contentType,
      data: null,
      error: resp.ok ? undefined : `Server returned an empty response (HTTP ${resp.status}). Please retry.`,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    const anyParsed = parsed as any;
    const errMsg = !resp.ok
      ? anyParsed?.message || anyParsed?.error || `Request failed with HTTP ${resp.status}.`
      : undefined;
    return {
      ok: resp.ok,
      status: resp.status,
      contentType,
      data: parsed,
      error: errMsg,
    };
  } catch {
    const trimmed = rawText.trim();
    const looksHtml =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!') ||
      trimmed.toLowerCase().startsWith('<html') ||
      trimmed.startsWith('<');

    console.warn('[safeFetch] Expected JSON but received non-JSON response', {
      url: resp.url || 'unknown',
      status: resp.status,
      redirected: resp.redirected,
      contentType: contentType || 'unspecified',
      preview: trimmed.slice(0, 140),
    });

    return {
      ok: false,
      status: resp.status || 502,
      contentType,
      isHtmlError: looksHtml,
      data: null,
      error: looksHtml
        ? `Server returned an unexpected HTML page (HTTP ${resp.status || 502}) instead of JSON. Please click Retry Request.`
        : `Invalid JSON response from server (HTTP ${resp.status}). Please click Retry Request.`,
    };
  }
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  try {
    const mergedHeaders = new Headers(init?.headers || {});
    if (!mergedHeaders.has('Accept')) {
      mergedHeaders.set('Accept', 'application/json');
    }
    const resp = await fetch(input, {
      ...init,
      headers: mergedHeaders,
    });
    return await safeParseResponseJson<T>(resp);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      data: null,
      error: err?.message || 'Unable to reach server. Please check your connection and retry.',
    };
  }
}
