import Link from 'next/link';

export const metadata = {
  title: 'Thank You - Adteco',
  description: 'Thank you for contacting us',
}

export default function ThankYou() {
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="h1 mb-4">Thank You for Contacting Us</h1>
            <p className="text-xl text-gray-400 mb-8">We've received your message and will get back to you shortly.</p>
            <Link href="/" className="btn text-white bg-purple-600 hover:bg-purple-700">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}