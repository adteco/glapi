'use client';

export interface CustomerPortalApiError extends Error {
  status?: number;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

async function request<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`/api/customer-portal${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await parseResponse<{ message?: string }>(response);
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // ignore parse errors for non-json responses
    }
    const error = new Error(message) as CustomerPortalApiError;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return parseResponse<T>(response);
}

export function portalGet<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'GET' });
}

export function portalPost<T>(endpoint: string, payload?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
