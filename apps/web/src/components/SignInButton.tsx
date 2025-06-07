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
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
    >
      Sign In
    </button>
  );
}
