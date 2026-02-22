import crypto from 'crypto';
import { promisify } from 'util';
import type { NextRequest, NextResponse } from 'next/server';

const scryptAsync = promisify(crypto.scrypt);

export const CUSTOMER_PORTAL_SESSION_COOKIE = 'glapi_customer_portal_session';
const DEFAULT_PORTAL_HOST_SUFFIX = '.clients.glapi.com';

export function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();
  if (normalized.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const salt = crypto.randomBytes(16);
  const derived = (await scryptAsync(normalized, salt, 64)) as Buffer;

  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(
  password: string,
  encodedPasswordHash: string | null | undefined
): Promise<boolean> {
  if (!encodedPasswordHash) {
    return false;
  }

  const [algorithm, saltBase64, digestBase64] = encodedPasswordHash.split('$');
  if (algorithm !== 'scrypt' || !saltBase64 || !digestBase64) {
    return false;
  }

  const salt = Buffer.from(saltBase64, 'base64');
  const expectedDigest = Buffer.from(digestBase64, 'base64');
  const actualDigest = (await scryptAsync(password.trim(), salt, expectedDigest.length)) as Buffer;

  if (actualDigest.length !== expectedDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

export function setCustomerPortalSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(CUSTOMER_PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearCustomerPortalSessionCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}

export function getCustomerPortalSessionToken(request: NextRequest): string | null {
  return request.cookies.get(CUSTOMER_PORTAL_SESSION_COOKIE)?.value ?? null;
}

export function resolvePortalOrgSlug(request: NextRequest, bodyOrgSlug?: string): string | null {
  if (bodyOrgSlug && bodyOrgSlug.trim().length > 0) {
    return bodyOrgSlug.trim().toLowerCase();
  }

  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!hostHeader) {
    return null;
  }

  const host = hostHeader.split(':')[0].toLowerCase();
  const customSuffix = process.env.CUSTOMER_PORTAL_HOST_SUFFIX || DEFAULT_PORTAL_HOST_SUFFIX;

  if (host.endsWith(customSuffix)) {
    const slug = host.slice(0, -customSuffix.length);
    return slug || null;
  }

  return null;
}

export function getRequestIpAddress(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',').map((part) => part.trim());
    if (first) return first;
  }

  return request.headers.get('x-real-ip') || null;
}

export function buildSessionExpiry(days = 14): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function buildTokenExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
