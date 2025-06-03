'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-sky-400" />
          <span className="text-xl font-bold">GLAPI</span>
        </Link>
        
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

      {/* Content */}
      <div className="relative px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Last updated: December 2024
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 lg:p-12">
            <div className="prose prose-gray prose-invert max-w-none">
              
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 mb-6">
                By accessing and using GLAPI (the "Service"), you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-300 mb-6">
                GLAPI provides an API-first general ledger service for businesses. Our service includes transaction processing, 
                financial reporting, and integration capabilities designed for modern business operations.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">3. User Accounts</h2>
              <p className="text-gray-300 mb-4">
                To access certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">4. Acceptable Use</h2>
              <p className="text-gray-300 mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Distribute malware or other harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any fraudulent or illegal purpose</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">5. Data and Privacy</h2>
              <p className="text-gray-300 mb-6">
                Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information. 
                By using our Service, you agree to the collection and use of information in accordance with our Privacy Policy.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">6. Payment Terms</h2>
              <p className="text-gray-300 mb-4">
                For paid services:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Fees are charged in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable except as required by law</li>
                <li>You authorize us to charge your payment method for applicable fees</li>
                <li>Failed payments may result in service suspension</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">7. Service Availability</h2>
              <p className="text-gray-300 mb-6">
                We strive to maintain high service availability but cannot guarantee uninterrupted access. 
                We may temporarily suspend the service for maintenance, updates, or other operational reasons.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">8. Intellectual Property</h2>
              <p className="text-gray-300 mb-6">
                The Service and its original content, features, and functionality are owned by GLAPI and are protected by 
                international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-300 mb-6">
                In no event shall GLAPI be liable for any indirect, incidental, special, consequential, or punitive damages, 
                including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">10. Termination</h2>
              <p className="text-gray-300 mb-6">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, 
                for any reason, including if you breach the Terms of Service.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to Terms</h2>
              <p className="text-gray-300 mb-6">
                We reserve the right to modify these terms at any time. We will notify users of any material changes. 
                Your continued use of the Service after such modifications constitutes acceptance of the updated terms.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Information</h2>
              <p className="text-gray-300 mb-6">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@glapi.com" className="text-sky-400 hover:text-sky-300">
                  legal@glapi.com
                </a>
              </p>

            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}