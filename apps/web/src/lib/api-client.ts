import { auth } from '@clerk/nextjs/server';
import { getServerApiBaseUrl } from '@/lib/browser-api';

interface ApiClientOptions extends RequestInit {
  includeOrgId?: boolean;
}

export async function apiClient(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  const { getToken, orgId, userId } = await auth();
  void userId;
  const token = await getToken();
  
  const { includeOrgId = true, headers, ...restOptions } = options;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Merge any existing headers
  if (headers) {
    // Handle different HeadersInit types
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        requestHeaders[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        requestHeaders[key] = value;
      });
    } else if (typeof headers === 'object') {
      Object.entries(headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      });
    }
  }
  
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  if (includeOrgId && orgId) {
    requestHeaders['x-organization-id'] = orgId;
  }
  
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, {
    ...restOptions,
    headers: requestHeaders,
  });
}

async function buildApiError(response: Response): Promise<Error> {
  let detail = '';

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json() as { message?: string; error?: string };
      detail = payload.message || payload.error || '';
    } else {
      detail = (await response.text()).trim();
    }
  } catch {
    // Ignore parse errors and fallback to status-only messages.
  }

  const statusSummary = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  const message = detail
    ? `API request failed (${statusSummary}): ${detail}`
    : `API request failed (${statusSummary})`;

  return new Error(message);
}

export async function apiGet<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(endpoint, { ...options, method: 'GET' });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json();
}

export async function apiPost<T>(
  endpoint: string,
  data: unknown,
  options?: ApiClientOptions
): Promise<T> {
  const response = await apiClient(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json();
}

export async function apiPut<T>(
  endpoint: string,
  data: unknown,
  options?: ApiClientOptions
): Promise<T> {
  const response = await apiClient(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json();
}

export async function apiDelete<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(endpoint, { ...options, method: 'DELETE' });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json();
}
