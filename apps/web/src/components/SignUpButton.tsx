// components/SignUpButton.tsx in your satellite app
'use client';
import { useClerk } from '@clerk/nextjs';

export default function SignUpButton() {
  const { openSignUp } = useClerk();

  const handleSignUp = () => {
    if (openSignUp) {
      openSignUp();
    }
  };

  return (
    <button 
      onClick={handleSignUp} 
      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200"
    >
      Get Started
    </button>
  );
}