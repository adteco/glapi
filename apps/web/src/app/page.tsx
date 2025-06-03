'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white p-6">
      <div className="text-center max-w-2xl mx-auto">
        <ShieldCheck className="h-24 w-24 text-sky-400 mx-auto mb-8" />
        
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Welcome to Adteco GL
        </h1>
        
        <p className="text-lg md:text-xl text-gray-300 mb-10">
          Modernize your financial operations with our intuitive General Ledger system. 
          Secure, scalable, and built for growth.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <SignInButton mode="modal">
            <button className="rounded-md bg-sky-600 px-6 py-3 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200 w-full sm:w-auto shadow-lg hover:shadow-sky-500/50">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors duration-200 w-full sm:w-auto shadow-lg hover:shadow-blue-500/50">
              Sign Up
            </button>
          </SignUpButton>
        </div>

        <p className="mt-12 text-sm text-gray-500">
          Securely powered by Clerk.
        </p>
      </div>
    </div>
  );
}
