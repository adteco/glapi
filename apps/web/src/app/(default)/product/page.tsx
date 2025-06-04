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
              Built for Scale and Compliance
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Handle millions of transactions monthly with real-time insights and complete audit trails.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Gauge className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Enterprise Scale</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Process 1,000,000+ transactions monthly with sub-second response times. 
                  Real-time balance calculations and instant financial reporting.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">GAAP Compliant</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Built-in compliance with GAAP standards. Complete audit trails, 
                  immutable transaction records, and SOX-ready reporting.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Multi-Currency</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Native multi-currency support with automatic exchange rate updates 
                  and real-time currency conversion for global operations.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Business Transaction Management */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Complete Business Transaction Lifecycle
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Manage every aspect of your business from opportunity to cash collection.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-4">
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Sales Management</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Track opportunities, create estimates, manage sales orders, and automate invoicing 
                  with complete visibility into your sales pipeline.
                </dd>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <FileCode className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Project Tracking</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Monitor project profitability with time tracking, expense management, 
                  and real-time budget vs. actual analysis.
                </dd>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <Rocket className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Subscription Billing</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Automate recurring revenue with flexible billing schedules, usage tracking, 
                  and automatic invoice generation.
                </dd>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Contract Management</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Track contract lifecycles, monitor renewal dates, and ensure compliance 
                  with automated alerts and reporting.
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Features */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Event-Driven Architecture
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Built on modern event sourcing principles for complete auditability and flexibility.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Database className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Complete Audit Trail</h3>
                <p className="text-gray-300 mb-6">
                  Every change captured as an immutable event. Travel back in time to see exact state at any moment.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Immutable transaction history</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">SOX compliance built-in</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Complete causation tracking</span>
                  </li>
                </ul>
              </div>
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Zap className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Real-time Processing</h3>
                <p className="text-gray-300 mb-6">
                  Event-driven architecture enables instant updates and real-time analytics across your entire system.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Instant balance updates</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Real-time reporting</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Live dashboard updates</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Intelligence */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Financial Intelligence & Insights
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Turn your financial data into actionable insights with powerful analytics and reporting.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Real-time Dashboards</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Monitor cash flow, project profitability, sales pipelines, and subscription metrics 
                  with live dashboards that update instantly.
                </dd>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <FileCode className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Activity-Based Costing</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Track profitability by activity, project, customer, or department. 
                  Understand true costs and margins across your business.
                </dd>
              </div>
              <div className="flex flex-col">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <dt className="text-lg font-semibold leading-7">Predictive Analytics</dt>
                <dd className="mt-1 text-sm leading-6 text-gray-300">
                  Leverage AI-ready data structures for forecasting, trend analysis, 
                  and intelligent alerts on budget overruns or payment delays.
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Features */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-Ready Platform
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Built from the ground up for modern finance teams and developers.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Code className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">API-First Design</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Every feature accessible via RESTful APIs. Build custom integrations, 
                  automate workflows, and connect with any modern tech stack.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Security & Compliance</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Role-based access control, audit logging, data encryption, and 
                  built-in compliance with SOX, GAAP, and data privacy regulations.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Cloud className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Cloud-Native</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Microservices architecture with auto-scaling, high availability, 
                  and disaster recovery built into the platform.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Integration Section */}
      <div className="py-24 sm:py-32">
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