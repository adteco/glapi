import { describe, expect, it } from 'vitest';
import { safeAuthRedirectPath } from './auth-redirect';

describe('safeAuthRedirectPath', () => {
  it('preserves an internal redirect path', () => {
    expect(
      safeAuthRedirectPath('?redirect_url=%2Flists%2Faccounts%3Ftab%3Dactive'),
    ).toBe('/lists/accounts?tab=active');
  });

  it('defaults to the dashboard when no redirect is supplied', () => {
    expect(safeAuthRedirectPath('')).toBe('/dashboard');
  });

  it.each(['https://evil.example', '//evil.example'])(
    'rejects external redirect %s',
    (redirect) => {
      expect(
        safeAuthRedirectPath(`?redirect_url=${encodeURIComponent(redirect)}`),
      ).toBe('/dashboard');
    },
  );
});
