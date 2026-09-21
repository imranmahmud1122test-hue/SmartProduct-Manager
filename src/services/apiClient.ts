/**
 * Unified API Client for Smart Product Manager
 * Supports relative API paths as well as external Render backend URLs (VITE_API_URL).
 * Provides robust error parsing, connection timeouts, and Render cold-start diagnostics.
 */

export function getApiBaseUrl(): string {
  const customUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) ||
    ''
  ).trim();

  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }
  return '';
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  retryAfter?: number;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 25000
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${normalizedEndpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. HTML error page or plain string)
    }

    if (!response.ok) {
      // Check for common Render / reverse-proxy error codes
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        return {
          ok: false,
          status: response.status,
          error: 'Backend is waking up (Render free tier cold start). Please wait 30 seconds and try again.',
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          status: 404,
          error: 'Verification API endpoint not found. Ensure your backend Web Service is running on Render.',
        };
      }

      const errorMessage =
        json?.error ||
        json?.message ||
        `Server returned error ${response.status} (${response.statusText || 'Error'})`;

      return {
        ok: false,
        status: response.status,
        data: json,
        error: errorMessage,
        retryAfter: json?.retryAfter,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: json ?? (text as unknown as T),
      retryAfter: json?.retryAfter,
    };
  } catch (err: any) {
    clearTimeout(timer);

    if (err?.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        error: 'Connection timed out. If using Render free tier, the backend may be spinning up. Please try again.',
      };
    }

    const isNetworkError =
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('Load failed');

    return {
      ok: false,
      status: 0,
      error: isNetworkError
        ? 'Cannot reach verification service. If your app is hosted on Render, the backend may be sleeping or restarting. Please retry in a few seconds.'
        : (err?.message || 'Network communication error'),
    };
  }
}

export async function apiPost<T = any>(
  endpoint: string,
  body: Record<string, any>,
  timeoutMs = 25000
): Promise<ApiResponse<T>> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

export async function apiGet<T = any>(
  endpoint: string,
  timeoutMs = 25000
): Promise<ApiResponse<T>> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'GET',
    },
    timeoutMs
  );
}
