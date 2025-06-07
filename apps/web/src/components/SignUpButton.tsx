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
    <button onClick={handleSignUp} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200">
      Sign Up Here
    </button>
  );
}