// components/SignUpButton.tsx in your satellite app
'use client';

export default function SignUpButton() {
  const handleSignUp = () => {
    // For satellite domains, redirect to the primary domain's sign-up page
    // Assuming the sign-up URL follows the same pattern as sign-in
    const primaryDomain = 'http://adteco.com';
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Redirect to primary domain sign-up with return URL
    window.location.href = `${primaryDomain}/sign-up?redirect_url=${encodeURIComponent(currentUrl)}`;
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