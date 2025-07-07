'use client';

import { useAuth } from '@clerk/nextjs';

interface ApiClientOptions extends RequestInit {
  includeOrgId?: boolean;
}

export function useApiClient() {
  const { getToken, orgId } = useAuth();
  
  const apiClient = async (
    endpoint: string,
    options: ApiClientOptions = {}
  ): Promise<Response> => {
    const token = await getToken();
    
    const { includeOrgId = true, headers = {}, ...restOptions } = options;
    
    const requestHeaders: HeadersInit = {
      ...headers,
      'Content-Type': 'application/json',
    };
    
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    if (includeOrgId && orgId) {
      requestHeaders['x-organization-id'] = orgId;
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
      throw new Error(`API request failed: ${response.statusText}`);
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
      throw new Error(`API request failed: ${response.statusText}`);
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
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  };
  
  const apiDelete = async <T,>(endpoint: string, options?: ApiClientOptions): Promise<T> => {
    const response = await apiClient(endpoint, { ...options, method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
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