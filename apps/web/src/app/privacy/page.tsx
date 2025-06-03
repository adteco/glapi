'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Last updated: December 2024
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 lg:p-12">
            <div className="prose prose-gray prose-invert max-w-none">
              
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="text-gray-300 mb-6">
                GLAPI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, 
                use, disclose, and safeguard your information when you use our service.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3">Personal Information</h3>
              <p className="text-gray-300 mb-4">
                We may collect the following personal information:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Name and contact information (email, phone number)</li>
                <li>Company information and job title</li>
                <li>Account credentials and authentication data</li>
                <li>Payment and billing information</li>
                <li>Communication preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3">Usage Information</h3>
              <p className="text-gray-300 mb-4">
                We automatically collect information about how you use our service:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Log data (IP address, browser type, access times)</li>
                <li>Device information and operating system</li>
                <li>API usage patterns and performance metrics</li>
                <li>Feature usage and interaction data</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-300 mb-4">
                We use the collected information for:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Providing and maintaining our service</li>
                <li>Processing transactions and billing</li>
                <li>Customer support and communication</li>
                <li>Service improvement and development</li>
                <li>Security monitoring and fraud prevention</li>
                <li>Legal compliance and regulatory requirements</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">4. Data Security</h2>
              <p className="text-gray-300 mb-4">
                We implement appropriate security measures to protect your information:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Encryption in transit and at rest</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits and monitoring</li>
                <li>Secure data centers and infrastructure</li>
                <li>Employee training and access restrictions</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-gray-300 mb-4">
                We do not sell your personal information. We may share information in these circumstances:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>With your explicit consent</li>
                <li>To trusted service providers under strict confidentiality agreements</li>
                <li>To comply with legal obligations or court orders</li>
                <li>To protect our rights, safety, or property</li>
                <li>In connection with a business transfer or merger</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
              <p className="text-gray-300 mb-6">
                We retain your information only as long as necessary for the purposes outlined in this policy, 
                or as required by law. Financial transaction data may be retained for longer periods to comply 
                with regulatory requirements.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights</h2>
              <p className="text-gray-300 mb-4">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="text-gray-300 mb-6 list-disc list-inside space-y-2">
                <li>Access to your personal information</li>
                <li>Correction of inaccurate data</li>
                <li>Deletion of your personal information</li>
                <li>Data portability</li>
                <li>Restriction of processing</li>
                <li>Objection to processing</li>
              </ul>

              <h2 className="text-2xl font-semibold text-white mb-4">8. Cookies and Tracking</h2>
              <p className="text-gray-300 mb-6">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
                and provide personalized content. You can control cookie settings through your browser preferences.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">9. International Data Transfers</h2>
              <p className="text-gray-300 mb-6">
                Your information may be transferred to and processed in countries other than your own. 
                We ensure appropriate safeguards are in place to protect your data during international transfers.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">10. Children's Privacy</h2>
              <p className="text-gray-300 mb-6">
                Our service is not intended for children under 13. We do not knowingly collect personal information 
                from children under 13. If we become aware of such collection, we will delete the information immediately.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
              <p className="text-gray-300 mb-6">
                We may update this Privacy Policy periodically. We will notify you of any material changes by 
                posting the new policy on this page and updating the "Last updated" date.
              </p>

              <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Us</h2>
              <p className="text-gray-300 mb-6">
                If you have questions about this Privacy Policy or our data practices, please contact us at{' '}
                <a href="mailto:privacy@glapi.com" className="text-sky-400 hover:text-sky-300">
                  privacy@glapi.com
                </a>{' '}
                or{' '}
                <Link href="/contact" className="text-sky-400 hover:text-sky-300">
                  through our contact form
                </Link>.
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