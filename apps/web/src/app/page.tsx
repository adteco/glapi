'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck, Zap, Cloud, Lock, Users, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-8">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-sky-400" />
          <span className="text-xl font-bold">GLAPI</span>
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

      {/* Hero Section */}
      <div className="relative px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-20 pb-32 sm:pt-32 sm:pb-40">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              API-First General Ledger
              <span className="block text-sky-400">Built for Modern Business</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
              High-performance, AI-ready accounting infrastructure. Lightweight, extensible, 
              and designed to scale with your business needs.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <SignUpButton mode="modal">
                <button className="rounded-md bg-sky-600 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-500 transition-colors duration-200 shadow-lg hover:shadow-sky-500/50">
                  Start Free Trial
                </button>
              </SignUpButton>
              <Link
                href="/product"
                className="text-lg font-semibold leading-6 text-white flex items-center hover:text-sky-400 transition-colors"
              >
                Learn more <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to modernize your GL
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Built from the ground up for performance, security, and developer experience.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">API First</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  RESTful APIs with comprehensive documentation. Integrate seamlessly with your existing systems.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Cloud className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">High Performance</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Optimized for speed and scale. Handle millions of transactions with sub-second response times.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Designed for AI</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Structured data formats and APIs designed for AI integration and automation.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Tenancy Options */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Flexible Deployment Options
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Choose the deployment model that works best for your organization.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Users className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Shared Tenancy</h3>
                <p className="text-gray-300 mb-6">
                  Cost-effective multi-tenant solution with enterprise-grade security and isolation.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Fast deployment</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Lower operational costs</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Automatic updates</span>
                  </li>
                </ul>
              </div>
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Lock className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Isolated Tenancy</h3>
                <p className="text-gray-300 mb-6">
                  Dedicated infrastructure with complete data isolation and custom configurations.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Complete data isolation</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Custom configurations</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Enhanced compliance</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-sky-600">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to modernize your GL?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-sky-100">
              Join forward-thinking companies already using GLAPI to streamline their financial operations.
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

      {/* Footer */}
      <Footer />
    </div>
  );
}
