'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
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
          <Link href="/pricing" className="text-white font-semibold">
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

      {/* Header */}
      <div className="relative px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Choose the plan that fits your business. Scale up or down as needed.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="relative px-6 lg:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            
            {/* Starter Plan */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white">Starter</h3>
                <p className="mt-2 text-gray-400">Perfect for small businesses</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-white">$29</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Up to 1,000 transactions/month</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Single subsidiary</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Basic API access</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Email support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Standard reports</span>
                </li>
              </ul>
              
              <div className="mt-8">
                <SignUpButton mode="modal">
                  <button className="w-full rounded-md bg-gray-700 px-6 py-3 text-sm font-medium text-white hover:bg-gray-600 transition-colors duration-200">
                    Start Free Trial
                  </button>
                </SignUpButton>
              </div>
            </div>

            {/* Professional Plan */}
            <div className="bg-sky-600/10 rounded-2xl border border-sky-500 p-8 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-sky-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white">Professional</h3>
                <p className="mt-2 text-gray-400">For growing businesses</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-white">$99</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Up to 10,000 transactions/month</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Up to 5 subsidiaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Full API access</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Priority support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Advanced reports & analytics</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Custom integrations</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Shared tenancy</span>
                </li>
              </ul>
              
              <div className="mt-8">
                <SignUpButton mode="modal">
                  <button className="w-full rounded-md bg-sky-600 px-6 py-3 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200 shadow-lg hover:shadow-sky-500/50">
                    Start Free Trial
                  </button>
                </SignUpButton>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white">Enterprise</h3>
                <p className="mt-2 text-gray-400">For large organizations</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-white">Custom</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Unlimited transactions</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Unlimited subsidiaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Isolated tenancy</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">24/7 dedicated support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Custom reporting</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">SLA guarantees</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-gray-300">On-premise deployment</span>
                </li>
              </ul>
              
              <div className="mt-8">
                <Link href="/contact">
                  <button className="w-full rounded-md bg-gray-700 px-6 py-3 text-sm font-medium text-white hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center">
                    Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-900/50 py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change plans at any time?
              </h3>
              <p className="text-gray-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-300">
                Yes, all plans come with a 14-day free trial. No credit card required to get started.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                What happens if I exceed my transaction limits?
              </h3>
              <p className="text-gray-300">
                We'll notify you when you approach your limit. You can upgrade your plan or purchase additional transaction credits.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Do you offer custom pricing for large enterprises?
              </h3>
              <p className="text-gray-300">
                Yes, we offer custom pricing and features for large enterprise customers. Contact our sales team to discuss your specific needs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-sky-600">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-sky-100">
              Join thousands of businesses already using GLAPI to streamline their financial operations.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <SignUpButton mode="modal">
                <button className="rounded-md bg-white px-6 py-3 text-lg font-semibold text-sky-600 hover:bg-gray-100 transition-colors duration-200 shadow-lg">
                  Start Free Trial
                </button>
              </SignUpButton>
              <Link href="/contact" className="text-lg font-semibold leading-6 text-white">
                Contact Sales <ArrowRight className="ml-2 h-4 w-4 inline" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}