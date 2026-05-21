export const DEFAULT_PORT = 3041;

export const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3020',
  'http://localhost:3030',
  'http://localhost:8787',
  'https://staging.glapi.net',
  'https://web.glapi.net',
  'https://www.glapi.net',
  'https://glapi.net',
  'https://docs.glapi.net',
];

export function getPort(): number {
  const rawPort = process.env.PORT;
  if (!rawPort) return DEFAULT_PORT;

  const parsed = Number.parseInt(rawPort, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

export function getPublicApiBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://localhost:3041';
}
