// components/SignInButton.tsx in your satellite app

'use client';

// Use the Clerk Next.js hook for better Next.js integration
import { useClerk } from '@clerk/nextjs';

export default function SignInButton() {
  // The useClerk hook provides the openSignIn method to handle redirection.
  const { openSignIn } = useClerk();

  const handleSignIn = () => {
    // Calling openSignIn() on a satellite application will automatically
    // redirect the user to the primary application's sign-in URL.
    // This URL is configured in your satellite app's environment variables.
    // After a successful sign-in, Clerk handles redirecting the user back.
    if (openSignIn) {
      openSignIn();
    }
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
