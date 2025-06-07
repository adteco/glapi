// components/SignInButton.tsx in your satellite app

'use client';

// Sign in button for satellite domain authentication

export default function SignInButton() {
  const handleSignIn = () => {
    // For satellite domains, redirect to the primary domain's sign-in page
    // The redirect URL includes the current domain as the redirect_url parameter
    const primarySignInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'http://adteco.com/sign-in';
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Redirect to primary domain with return URL
    window.location.href = `${primarySignInUrl}?redirect_url=${encodeURIComponent(currentUrl)}`;
  };

  return (
    <button
      onClick={handleSignIn}
      className="text-gray-300 hover:text-white transition-colors px-4 py-2"
    >
      Sign In
    </button>
  );
}
