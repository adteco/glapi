'use client';

import { useRouter } from 'next/navigation';

export default function SignUpButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.push('/sign-up')}
      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200"
    >
      Get Started
    </button>
  );
}
