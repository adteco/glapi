import crypto from 'crypto';

export interface HeaderSource {
  get(name: string): string | null;
}

export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'RequestAuthError';
    this.status = status;
  }
}

export function getAuthorizationHeader(headers: HeaderSource): string | null {
  return headers.get('authorization') || headers.get('Authorization');
}

export function extractAuthorizationCredential(headers: HeaderSource): string | null {
  const authHeader = getAuthorizationHeader(headers);
  if (!authHeader) {
    return null;
  }

  return authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : authHeader.trim();
}

export function extractBearerToken(headers: HeaderSource): string | null {
  const authHeader = getAuthorizationHeader(headers);
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

export function requireStaticAuthorizationCredential(
  headers: HeaderSource,
  expectedCredential: string | undefined,
  options: {
    allowInDevelopment?: boolean;
    developmentNotice?: string;
    missingCredentialMessage?: string;
  } = {}
): string | null {
  if (!expectedCredential) {
    if (options.allowInDevelopment && process.env.NODE_ENV === 'development') {
      if (options.developmentNotice) {
        console.warn(options.developmentNotice);
      }
      return null;
    }

    throw new RequestAuthError(
      options.missingCredentialMessage || 'Authentication is not configured.',
      500
    );
  }

  const providedCredential = extractAuthorizationCredential(headers);
  if (!providedCredential || providedCredential !== expectedCredential) {
    throw new RequestAuthError('Unauthorized', 401);
  }

  return providedCredential;
}

export function verifySha256HmacSignature(
  payload: string,
  signature: string | null,
  signingKey: string
): boolean {
  if (!signature) {
    return false;
  }

  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedDigest = parts[1];
  const computedDigest = crypto
    .createHmac('sha256', signingKey)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedDigest, 'hex'),
      Buffer.from(computedDigest, 'hex')
    );
  } catch {
    return false;
  }
}
