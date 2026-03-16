import crypto from 'crypto';
import {
  RequestAuthError,
  extractAuthorizationCredential,
  extractBearerToken,
  requireStaticAuthorizationCredential,
  verifySha256HmacSignature,
} from './request-auth';

describe('request-auth helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('extracts bearer tokens from authorization headers', () => {
    const headers = new Headers({
      Authorization: 'Bearer clerk-token-value',
    });

    expect(extractBearerToken(headers)).toBe('clerk-token-value');
    expect(extractAuthorizationCredential(headers)).toBe('clerk-token-value');
  });

  it('supports raw authorization credentials for internal callers', () => {
    const headers = new Headers({
      Authorization: 'internal-lookup-key',
    });

    expect(extractBearerToken(headers)).toBeNull();
    expect(extractAuthorizationCredential(headers)).toBe('internal-lookup-key');
  });

  it('requires the expected shared credential', () => {
    const headers = new Headers({
      Authorization: 'Bearer internal-lookup-key',
    });

    expect(
      requireStaticAuthorizationCredential(headers, 'internal-lookup-key')
    ).toBe('internal-lookup-key');
  });

  it('rejects incorrect shared credentials', () => {
    const headers = new Headers({
      Authorization: 'Bearer wrong-key',
    });

    expect(() =>
      requireStaticAuthorizationCredential(headers, 'internal-lookup-key')
    ).toThrow(new RequestAuthError('Unauthorized', 401));
  });

  it('allows missing shared credentials in development when explicitly enabled', () => {
    process.env.NODE_ENV = 'development';

    expect(
      requireStaticAuthorizationCredential(new Headers(), undefined, {
        allowInDevelopment: true,
      })
    ).toBeNull();
  });

  it('verifies sha256 hmac signatures', () => {
    const payload = JSON.stringify({ hello: 'world' });
    const signingKey = 'hmac-key';
    const digest = crypto
      .createHmac('sha256', signingKey)
      .update(payload)
      .digest('hex');

    expect(
      verifySha256HmacSignature(payload, `sha256=${digest}`, signingKey)
    ).toBe(true);
    expect(
      verifySha256HmacSignature(payload, 'sha256=deadbeef', signingKey)
    ).toBe(false);
  });
});
