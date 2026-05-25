import Link from 'next/link';

export default function SignUpButton() {
  return (
    <Link
      href="/sign-up"
      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200"
    >
      Get Started
    </Link>
  );
}
