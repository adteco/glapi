export const clerkRedirects = {
  signInFallbackRedirectUrl:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ??
    '/',
  signUpFallbackRedirectUrl:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ??
    '/',
};
