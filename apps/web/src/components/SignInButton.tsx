import Link from 'next/link';

export default function SignInButton() {
  return (
    <Link
      href="/sign-in"
      className="text-gray-300 hover:text-white transition-colors px-4 py-2"
    >
      Sign In
    </Link>
  );
}
