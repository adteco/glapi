'use client';

import React from 'react';

interface SubmitButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({ children, disabled = false, className = '' }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        px-6 py-3
        text-base font-medium
        text-white
        bg-sky-600 hover:bg-sky-700
        rounded-md
        shadow-sm
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500
        ${className}
      `}
    >
      {disabled ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Sending...
        </>
      ) : (
        children
      )}
    </button>
  );
}