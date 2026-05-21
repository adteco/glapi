'use client';

import { useRouter } from 'next/navigation';

export default function SignInButton() {
  const router = useRouter();

  const handleSignIn = () => {
    router.push('/sign-in');
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
