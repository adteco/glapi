const API_PROXY_BASE = '/api/proxy';
const TRPC_PROXY_BASE = '/api/trpc';

export function getBrowserApiUrl(path: string): string {
  return `${API_PROXY_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getBrowserTrpcUrl(): string {
  return TRPC_PROXY_BASE;
}

export function getServerApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';
}
