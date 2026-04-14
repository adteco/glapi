import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  signInFallback: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  signUpFallback: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
  afterSignIn: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
  afterSignUp: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
};

async function loadRedirects() {
  vi.resetModules();
  return import('./clerk-redirects');
}

describe('clerk redirect helpers', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = ORIGINAL_ENV.signInFallback;
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = ORIGINAL_ENV.signUpFallback;
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = ORIGINAL_ENV.afterSignIn;
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = ORIGINAL_ENV.afterSignUp;
    vi.resetModules();
  });

  it('prefers the new fallback redirect env vars', async () => {
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = '/app';
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = '/welcome';
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = '/legacy-sign-in';
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = '/legacy-sign-up';

    const { clerkRedirects } = await loadRedirects();

    expect(clerkRedirects.signInFallbackRedirectUrl).toBe('/app');
    expect(clerkRedirects.signUpFallbackRedirectUrl).toBe('/welcome');
  });

  it('falls back to the deprecated env vars for backward compatibility', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL;
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = '/legacy-sign-in';
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = '/legacy-sign-up';

    const { clerkRedirects } = await loadRedirects();

    expect(clerkRedirects.signInFallbackRedirectUrl).toBe('/legacy-sign-in');
    expect(clerkRedirects.signUpFallbackRedirectUrl).toBe('/legacy-sign-up');
  });

  it('defaults to the home page when no redirect env vars are configured', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL;
    delete process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL;
    delete process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL;

    const { clerkRedirects } = await loadRedirects();

    expect(clerkRedirects.signInFallbackRedirectUrl).toBe('/');
    expect(clerkRedirects.signUpFallbackRedirectUrl).toBe('/');
  });
});
