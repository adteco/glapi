'use client';

import { useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { waitForClerkAuthToLoad } from '@/lib/clerk-auth.client';

interface ApiClientOptions extends RequestInit {
  includeOrgId?: boolean;
}

export function useApiClient() {
  const { getToken, orgId, userId, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  const isLoadedRef = useRef(isLoaded);
  const orgIdRef = useRef(orgId);
  const userIdRef = useRef(userId);

  getTokenRef.current = getToken;
  isLoadedRef.current = isLoaded;
  orgIdRef.current = orgId;
  userIdRef.current = userId;

  const buildApiError = async (response: Response): Promise<Error> => {
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
      // Ignore parse errors and fallback to status-based message.
    }

    const statusSummary = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const message = detail
      ? `API request failed (${statusSummary}): ${detail}`
      : `API request failed (${statusSummary})`;

    return new Error(message);
  };
  
  const apiClient = async (
    endpoint: string,
    options: ApiClientOptions = {}
  ): Promise<Response> => {
    const authState = await waitForClerkAuthToLoad(() => ({
      isLoaded: isLoadedRef.current,
      orgId: orgIdRef.current,
      userId: userIdRef.current,
    }));
    const token = await getTokenRef.current();
    
    const { includeOrgId = true, headers = {}, ...restOptions } = options;
    
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
    
    if (includeOrgId && authState.orgId) {
      requestHeaders['x-organization-id'] = authState.orgId;
    }

    if (authState.userId) {
      requestHeaders['x-user-id'] = authState.userId;
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = `${baseUrl}${endpoint}`;
    
    return fetch(url, {
      ...restOptions,
      headers: requestHeaders,
    });
  };
  
  const apiGet = async <T,>(endpoint: string, options?: ApiClientOptions): Promise<T> => {
    const response = await apiClient(endpoint, { ...options, method: 'GET' });
    if (!response.ok) {
      throw await buildApiError(response);
    }
    return response.json();
  };
  
  const apiPost = async <T,>(
    endpoint: string,
    data: unknown,
    options?: ApiClientOptions
  ): Promise<T> => {
    const response = await apiClient(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw await buildApiError(response);
    }
    return response.json();
  };
  
  const apiPut = async <T,>(
    endpoint: string,
    data: unknown,
    options?: ApiClientOptions
  ): Promise<T> => {
    const response = await apiClient(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw await buildApiError(response);
    }
    return response.json();
  };
  
  const apiDelete = async <T,>(endpoint: string, options?: ApiClientOptions): Promise<T> => {
    const response = await apiClient(endpoint, { ...options, method: 'DELETE' });
    if (!response.ok) {
      throw await buildApiError(response);
    }
    return response.json();
  };
  
  return {
    apiClient,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
  };
}
