'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <nav className="relative z-10 flex items-center justify-between p-6 lg:px-8 bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="h-8 w-8 text-sky-400" />
        <Link href="/" className="text-xl font-bold text-white">GLAPI</Link>
      </div>
      
      <div className="hidden md:flex items-center space-x-8">
        <Link href="/product" className="text-gray-300 hover:text-white transition-colors">
          Product
        </Link>
        <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
          Pricing
        </Link>
        <Link href="/docs" className="text-gray-300 hover:text-white transition-colors">
          Docs
        </Link>
        <Link href="/contact" className="text-gray-300 hover:text-white transition-colors">
          Contact
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        <SignInButton mode="modal">
          <button className="text-gray-300 hover:text-white transition-colors">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200">
            Get Started
          </button>
        </SignUpButton>
      </div>
    </nav>
  );
}
