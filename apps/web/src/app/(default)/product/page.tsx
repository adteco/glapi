'use client';

import { SignUpButton } from '@clerk/nextjs';
import { 
  Zap, 
  Cloud, 
  Lock, 
  Users, 
  ArrowRight, 
  CheckCircle,
  Code,
  Database,
  Globe,
  BarChart3,
  Shield,
  Rocket,
  Server,
  FileCode,
  Gauge
} from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="relative px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            The Future of General Ledger
            <span className="block text-sky-400">Built for Modern Business</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
            GLAPI combines cutting-edge technology with proven accounting principles to deliver 
            an API-first general ledger that scales with your business.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <SignUpButton mode="modal">
              <button className="rounded-md bg-sky-600 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-500 transition-colors duration-200 shadow-lg hover:shadow-sky-500/50">
                Start Free Trial
              </button>
            </SignUpButton>
            <Link href="/docs" className="text-lg font-semibold leading-6 text-white flex items-center hover:text-sky-400 transition-colors">
              View Documentation <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Core Features */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the modern era
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Experience the power of a truly modern general ledger system.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Code className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">API First</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Every feature accessible via REST APIs. Build custom integrations, 
                  automate workflows, and connect with any system.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Gauge className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">High Performance</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Sub-second response times for millions of transactions. 
                  Optimized database queries and intelligent caching.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Designed for AI</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Structured data formats and APIs designed for AI integration, 
                  automation, and intelligent insights.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Architecture Features */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Lightweight & Extensible
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              A flexible architecture that grows with your business needs.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <FileCode className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Lightweight Core</h3>
                <p className="text-gray-300 mb-6">
                  Minimal dependencies and optimized codebase. Deploy quickly without bloat.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Fast deployment</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Low resource usage</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Easy maintenance</span>
                  </li>
                </ul>
              </div>
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Globe className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Highly Extensible</h3>
                <p className="text-gray-300 mb-6">
                  Plugin architecture and webhook system for custom business logic.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Custom workflows</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Integration hooks</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Plugin ecosystem</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tenancy Options */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Flexible Tenancy Options
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
                    <span className="text-gray-300">Lower operational costs</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Automatic updates</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Fast deployment</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Shared infrastructure benefits</span>
                  </li>
                </ul>
              </div>
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Server className="h-12 w-12 text-sky-400 mb-4" />
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
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Dedicated resources</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Features */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-Ready Features
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Built for scale, security, and reliability.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Data Integrity</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  ACID compliance, transaction isolation, and automatic backup ensure your data is always consistent and safe.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Security First</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  End-to-end encryption, role-based access control, and SOC 2 compliance for enterprise security.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Real-time Analytics</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Live dashboards, custom reports, and business intelligence integration for instant insights.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Integration Section */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Seamless Integrations
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Connect with your existing tools and workflows.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-semibold mb-6">Popular Integrations</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="font-semibold">ERP Systems</p>
                    <p className="text-sm text-gray-400">SAP, Oracle, NetSuite</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="font-semibold">Payment Processors</p>
                    <p className="text-sm text-gray-400">Stripe, PayPal, Square</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="font-semibold">Banks & Financial</p>
                    <p className="text-sm text-gray-400">Plaid, Yodlee, Open Banking</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="font-semibold">BI Tools</p>
                    <p className="text-sm text-gray-400">Tableau, Power BI, Looker</p>
                  </div>
                </div>
              </div>
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-semibold mb-6">Integration Methods</h3>
                <ul className="space-y-4">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">REST APIs with comprehensive documentation</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Webhooks for real-time events</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Bulk import/export capabilities</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Custom SDK libraries</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">GraphQL endpoints</span>
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
              Experience the power of a truly modern general ledger. Start your free trial today.
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
    </>
  );
}