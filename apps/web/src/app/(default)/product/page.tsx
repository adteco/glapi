'use client';

import { SignUpButton } from '@clerk/nextjs';
import { 
  MessageCircle,
  Brain,
  Sparkles,
  Network,
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
  Gauge,
  TrendingUp,
  Search,
  GitBranch,
  Clock,
  Layers,
  LightbulbIcon,
  History,
  Zap
} from 'lucide-react';
import Link from 'next/link';

export default function ProductPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="relative px-6 lg:px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-400/10 to-purple-600/10 blur-3xl" />
        <div className="mx-auto max-w-5xl text-center relative">
          <div className="inline-flex items-center rounded-full px-4 py-1.5 mb-8 bg-purple-500/10 text-purple-400 text-sm font-semibold border border-purple-500/20">
            <Sparkles className="h-4 w-4 mr-2" />
            Introducing the Conversational General Ledger
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            A General Ledger That
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-600">
              Understands Your Business
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300 max-w-3xl mx-auto">
            Ask questions in plain English. Get instant answers. Navigate complex financial relationships naturally. 
            GLAPI is the first general ledger that truly speaks your language.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <SignUpButton mode="modal">
              <button className="rounded-md bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-4 text-lg font-semibold text-white hover:from-sky-500 hover:to-sky-400 transition-all duration-200 shadow-lg hover:shadow-sky-500/50 transform hover:scale-105">
                See It In Action
              </button>
            </SignUpButton>
            <Link href="/docs" className="text-lg font-semibold leading-6 text-white flex items-center hover:text-sky-400 transition-colors group">
              Technical Documentation <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works - Conversational Interface */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How the Conversational GL Works
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Stop navigating complex menus and reports. Just ask what you need to know.
            </p>
          </div>
          
          {/* Demo Examples */}
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <MessageCircle className="h-8 w-8 text-sky-400" />
                </div>
                <div className="flex-grow">
                  <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <p className="text-gray-100 font-mono text-sm">
                      "What's our burn rate for the last 3 months, broken down by department?"
                    </p>
                  </div>
                  <div className="bg-sky-900/20 rounded-lg p-4 border border-sky-800/30">
                    <p className="text-sky-300 mb-2 font-semibold">GLAPI responds instantly:</p>
                    <div className="text-gray-300 space-y-2 text-sm">
                      <p>Average monthly burn rate: $487,000</p>
                      <p>• Engineering: $210,000 (43%)</p>
                      <p>• Sales & Marketing: $156,000 (32%)</p>
                      <p>• Operations: $73,000 (15%)</p>
                      <p>• Admin: $48,000 (10%)</p>
                      <p className="text-xs text-gray-400 mt-2">Trending up 8% vs prior quarter</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Brain className="h-8 w-8 text-purple-400" />
                </div>
                <div className="flex-grow">
                  <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <p className="text-gray-100 font-mono text-sm">
                      "Show me all customers with overdue invoices who also have active subscriptions"
                    </p>
                  </div>
                  <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                    <p className="text-purple-300 mb-2 font-semibold">GLAPI understands relationships:</p>
                    <div className="text-gray-300 space-y-2 text-sm">
                      <p>Found 14 customers matching criteria:</p>
                      <p>• Total overdue: $124,500</p>
                      <p>• Active subscription value: $45,000/month</p>
                      <p>• Average days overdue: 47</p>
                      <p className="text-xs text-gray-400 mt-2">Suggested action: Review subscription continuity risk</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Network className="h-8 w-8 text-green-400" />
                </div>
                <div className="flex-grow">
                  <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <p className="text-gray-100 font-mono text-sm">
                      "Trace the flow of payment from invoice INV-2024-1234"
                    </p>
                  </div>
                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-800/30">
                    <p className="text-green-300 mb-2 font-semibold">GLAPI traces the complete journey:</p>
                    <div className="text-gray-300 space-y-1 text-sm font-mono">
                      <p>→ Invoice created: Jan 15 ($25,000)</p>
                      <p>→ Payment received: Feb 2 (Wire transfer)</p>
                      <p>→ Applied to AR: Feb 2</p>
                      <p>→ Revenue recognized: Feb 3 (deferred 30%)</p>
                      <p>→ Commission calculated: Feb 3 ($2,500)</p>
                      <p>→ Tax withheld: Feb 3 ($4,250)</p>
                      <p className="text-xs text-gray-400 mt-2">All entries verified and balanced</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Capabilities */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Revolutionary Architecture, Revolutionary Capabilities
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Three innovations that change everything about working with financial data
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Natural Language Processing */}
            <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-2xl p-8 border border-purple-800/30">
              <MessageCircle className="h-12 w-12 text-purple-400 mb-6" />
              <h3 className="text-xl font-semibold mb-4">Conversational Interface</h3>
              <p className="text-gray-300 mb-6">
                Ask questions the way you think about your business. No SQL, no complex report builders, 
                just natural conversation.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Plain English queries</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Contextual understanding</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">No training required</span>
                </li>
              </ul>
            </div>
            
            {/* Event Sourcing */}
            <div className="bg-gradient-to-br from-sky-900/20 to-sky-800/10 rounded-2xl p-8 border border-sky-800/30">
              <Clock className="h-12 w-12 text-sky-400 mb-6" />
              <h3 className="text-xl font-semibold mb-4">Event-Sourced Design</h3>
              <p className="text-gray-300 mb-6">
                Every change is an immutable event. Travel through time, understand causality, 
                and never lose history.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-sky-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Complete audit trail</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-sky-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Time-travel queries</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-sky-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Immutable history</span>
                </li>
              </ul>
            </div>
            
            {/* Relationship Intelligence */}
            <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-2xl p-8 border border-green-800/30">
              <Network className="h-12 w-12 text-green-400 mb-6" />
              <h3 className="text-xl font-semibold mb-4">Relationship Intelligence</h3>
              <p className="text-gray-300 mb-6">
                Understands how everything connects. Customers to contracts, invoices to payments, 
                entities to transactions.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Automatic mapping</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Transaction genealogy</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">Impact analysis</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Event Sourcing Benefits */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The Power of Event-Sourced Accounting
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Traditional GLs update balances. We record everything that happens.
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="flex items-center mb-6">
                <History className="h-10 w-10 text-orange-400 mr-4" />
                <h3 className="text-xl font-semibold">Time Travel Queries</h3>
              </div>
              <p className="text-gray-300 mb-4">
                See your books exactly as they were at any point in time. Perfect for audits, 
                historical analysis, and understanding how your business evolved.
              </p>
              <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-orange-300">"What was our cash position on March 15th at 3:47 PM?"</p>
                <p className="text-gray-400 mt-2">→ Instant, accurate answer</p>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="flex items-center mb-6">
                <GitBranch className="h-10 w-10 text-blue-400 mr-4" />
                <h3 className="text-xl font-semibold">Complete Causality</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Understand not just what happened, but why. Every transaction links to its cause, 
                creating a complete story of your financial data.
              </p>
              <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-blue-300">"Why did revenue drop in April?"</p>
                <p className="text-gray-400 mt-2">→ Traces all contributing events</p>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="flex items-center mb-6">
                <Shield className="h-10 w-10 text-green-400 mr-4" />
                <h3 className="text-xl font-semibold">Immutable Audit Trail</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Every event is permanent and traceable. Changes don't overwrite history—they add to it. 
                Perfect compliance, always.
              </p>
              <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-green-300">"Show all changes to customer credit limits"</p>
                <p className="text-gray-400 mt-2">→ Complete history with who, what, when, why</p>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <div className="flex items-center mb-6">
                <Zap className="h-10 w-10 text-purple-400 mr-4" />
                <h3 className="text-xl font-semibold">Real-time Everything</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Events flow through the system instantly. No batch processing, no delays. 
                Your data is always current, always accurate.
              </p>
              <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-purple-300">"Current cash position across all accounts?"</p>
                <p className="text-gray-400 mt-2">→ Real-time, to the second</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Perfect for Complex Financial Operations
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Whether you're managing multiple entities, complex revenue recognition, or intricate cost allocations
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <GitBranch className="h-10 w-10 text-orange-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Multi-Entity Organizations</h3>
              <p className="text-gray-300 text-sm mb-4">
                Perfect for holding companies, franchises, or any business with complex entity structures.
              </p>
              <p className="text-xs text-gray-400 italic">
                "Show me consolidated cash flow across all entities, eliminating intercompany transactions"
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Clock className="h-10 w-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">SaaS & Subscriptions</h3>
              <p className="text-gray-300 text-sm mb-4">
                Handle complex revenue recognition, deferred revenue, and multi-year contracts effortlessly.
              </p>
              <p className="text-xs text-gray-400 italic">
                "What's our MRR growth excluding churned customers from last quarter?"
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Layers className="h-10 w-10 text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project-Based Business</h3>
              <p className="text-gray-300 text-sm mb-4">
                Track profitability by project, client, or department with automatic cost allocations.
              </p>
              <p className="text-xs text-gray-400 italic">
                "Which projects are over budget and what's driving the variance?"
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Globe className="h-10 w-10 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Global Operations</h3>
              <p className="text-gray-300 text-sm mb-4">
                Multi-currency support with automatic FX handling and consolidated reporting.
              </p>
              <p className="text-xs text-gray-400 italic">
                "What's our exposure to EUR/USD fluctuations across all subsidiaries?"
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <TrendingUp className="h-10 w-10 text-sky-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">High-Growth Companies</h3>
              <p className="text-gray-300 text-sm mb-4">
                Scale without limits. Add entities, dimensions, or currencies without system redesign.
              </p>
              <p className="text-xs text-gray-400 italic">
                "How has our unit economics changed since we expanded to new markets?"
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Search className="h-10 w-10 text-pink-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Audit & Compliance</h3>
              <p className="text-gray-300 text-sm mb-4">
                Complete transaction genealogy and immutable audit trails for regulatory compliance.
              </p>
              <p className="text-xs text-gray-400 italic">
                "Show me all journal entries affecting revenue recognition in Q2"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why GLAPI vs Traditional GLs?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              See the difference a conversational approach makes
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <div className="overflow-hidden rounded-2xl border border-gray-700">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Challenge</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Traditional GL</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-400">GLAPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Getting insights</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Navigate menus, build reports, export to Excel</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">"What's our burn rate?" - instant answer</td>
                  </tr>
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Complex queries</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Write SQL or hire consultants</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">Ask in plain English</td>
                  </tr>
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Multi-entity consolidation</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Manual eliminations, Excel reconciliation</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">Automatic with full traceability</td>
                  </tr>
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Audit trail</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Limited to journal entries</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">Complete transaction genealogy</td>
                  </tr>
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Relationship tracking</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Rigid chart of accounts</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">Dynamic, contextual relationships</td>
                  </tr>
                  <tr className="bg-gray-900/50 hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">Real-time visibility</td>
                    <td className="px-6 py-4 text-sm text-gray-400">Wait for batch processes</td>
                    <td className="px-6 py-4 text-sm text-gray-100 font-medium">Instant, always current</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Architecture */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for Modern Teams
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Whether you're a CFO, controller, or developer, GLAPI speaks your language
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-sky-600">
                <LightbulbIcon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">For Finance Teams</h3>
              <p className="text-gray-400 text-sm">
                Get answers instantly. No more waiting for reports or IT support. Just ask and know.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-purple-600">
                <Code className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">For Developers</h3>
              <p className="text-gray-400 text-sm">
                RESTful APIs, webhooks, and SDKs. Build on top of a GL that understands your business logic.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">For Compliance</h3>
              <p className="text-gray-400 text-sm">
                SOX, GAAP, and audit-ready by design. Every change tracked, every relationship documented.
              </p>
            </div>
          </div>
          
          <div className="mt-16 grid gap-8 lg:grid-cols-4 text-center">
            <div>
              <div className="text-3xl font-bold text-sky-400">99.9%</div>
              <div className="text-sm text-gray-400 mt-1">Uptime SLA</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400">&lt;100ms</div>
              <div className="text-sm text-gray-400 mt-1">Query response time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400">SOC 2</div>
              <div className="text-sm text-gray-400 mt-1">Type II Certified</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-400">24/7</div>
              <div className="text-sm text-gray-400 mt-1">Support available</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-r from-sky-600 to-purple-600">
          <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Ready to Experience the Future?
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-sky-100">
                Join forward-thinking companies who are transforming how they interact with financial data. 
                See what it's like when your GL finally understands you.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <SignUpButton mode="modal">
                  <button className="rounded-md bg-white px-8 py-4 text-lg font-semibold text-gray-900 hover:bg-gray-100 transition-all duration-200 shadow-lg transform hover:scale-105">
                    Start Your 30-Day Free Trial
                  </button>
                </SignUpButton>
                <Link href="/contact" className="text-lg font-semibold leading-6 text-white hover:text-sky-200 transition-colors group">
                  Talk to an Expert <ArrowRight className="ml-2 h-4 w-4 inline group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <p className="mt-8 text-sm text-sky-200">
                No credit card required • Full access • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}