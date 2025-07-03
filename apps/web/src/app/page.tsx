'use client';

import { SignUpButton } from '@clerk/nextjs';
import { MessageCircle, Sparkles, Network, Database, ArrowRight, CheckCircle, TrendingUp, Building, DollarSign, FileText, Clock, History, GitBranch, Zap } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white">
      <Header />

      {/* Hero Section */}
      <div className="relative px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-400/10 to-purple-600/10 blur-3xl" />
        <div className="mx-auto max-w-7xl pt-20 pb-32 sm:pt-32 sm:pb-40 relative">
          <div className="text-center">
            <div className="inline-flex items-center rounded-full px-4 py-1.5 mb-8 bg-sky-500/10 text-sky-400 text-sm font-semibold border border-sky-500/20">
              <Sparkles className="h-4 w-4 mr-2" />
              Introducing the Conversational General Ledger
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your Financial Data
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-600">
                Finally Speaks Your Language
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-300 max-w-3xl mx-auto">
              Ask questions in plain English. Get instant insights. Track complex relationships effortlessly.
              The general ledger that understands your business the way you do.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <SignUpButton mode="modal">
                <button className="rounded-md bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-4 text-lg font-semibold text-white hover:from-sky-500 hover:to-sky-400 transition-all duration-200 shadow-lg hover:shadow-sky-500/50 transform hover:scale-105">
                  See It In Action
                </button>
              </SignUpButton>
              <Link
                href="/product"
                className="text-lg font-semibold leading-6 text-white flex items-center hover:text-sky-400 transition-colors group"
              >
                Watch Demo <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Natural Language Examples Section */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ask Your GL Anything
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              No more complex queries or reports. Just ask questions the way you think about your business.
            </p>
          </div>
          
          {/* Query Examples */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <MessageCircle className="h-8 w-8 text-sky-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"Show me all revenue from customers who signed up in Q3 but haven't made a purchase in 30 days"</p>
              <p className="text-sm text-gray-400">Instantly identify at-risk customers and revenue patterns</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <TrendingUp className="h-8 w-8 text-green-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"What's my cash position across all subsidiaries, excluding restricted funds?"</p>
              <p className="text-sm text-gray-400">Complex consolidations answered in seconds</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Building className="h-8 w-8 text-purple-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"Which departments exceeded budget last month and what vendors drove the overage?"</p>
              <p className="text-sm text-gray-400">Multi-dimensional analysis made simple</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <DollarSign className="h-8 w-8 text-yellow-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"Show me all transactions between our European entities that need intercompany elimination"</p>
              <p className="text-sm text-gray-400">Navigate complex entity relationships naturally</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <FileText className="h-8 w-8 text-orange-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"What's the revenue recognition schedule for contracts signed with enterprise customers this year?"</p>
              <p className="text-sm text-gray-400">Track complex revenue streams effortlessly</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-sky-500/50 transition-colors">
              <Network className="h-8 w-8 text-blue-400 mb-4" />
              <p className="text-gray-100 font-medium mb-2">"Trace the complete flow of funds from customer payment to vendor disbursement for order #12345"</p>
              <p className="text-sm text-gray-400">Follow money through your entire system</p>
            </div>
          </div>
        </div>
      </div>

      {/* Our Story Section */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            We Worked on Accounting Systems for Years
          </h2>
          <p className="text-lg leading-8 text-gray-300 mb-8">
            The technology never changed. While we did.
          </p>
          <div className="prose prose-invert max-w-3xl mx-auto text-left">
            <p className="text-gray-300">
              After decades building and maintaining traditional GLs, we realized something profound: 
              accounting systems were stuck in the 1980s. Batch processing. Rigid structures. 
              Complex queries that required specialized knowledge.
            </p>
            <p className="text-gray-300 mt-4">
              Meanwhile, the rest of technology evolved. Natural language processing. Real-time systems. 
              Event-driven architectures. Intelligent data structures that understand relationships.
            </p>
            <p className="text-gray-300 mt-4">
              So we asked ourselves: <span className="text-sky-400 font-semibold">What if we rebuilt the general ledger 
              from scratch, using everything we've learned?</span>
            </p>
          </div>
          
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <MessageCircle className="h-10 w-10 text-sky-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Conversational Interface</h3>
              <p className="text-sm text-gray-400">
                Ask questions naturally. No SQL, no report builders.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <Clock className="h-10 w-10 text-purple-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Event-Sourced Architecture</h3>
              <p className="text-sm text-gray-400">
                Every change is an event. Complete history, perfect audit trails.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <Network className="h-10 w-10 text-green-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Relationship Intelligence</h3>
              <p className="text-sm text-gray-400">
                Understands how everything connects. Traces any transaction.
              </p>
            </div>
          </div>
          
          <p className="text-xl font-semibold text-sky-400 mt-12">
            It's time for a modern accounting system.
          </p>
        </div>
      </div>

      {/* Complex Relationships Section */}
      <div className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Handle Complex Financial Relationships
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                That Traditional GLs Can't
              </span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Your business isn't just debits and credits. It's a web of relationships, contracts, and obligations.
            </p>
          </div>
          
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-8">
              <div className="bg-gray-800/30 rounded-lg p-6 border border-purple-500/20">
                <h3 className="text-xl font-semibold mb-3 flex items-center">
                  <Sparkles className="h-6 w-6 text-purple-400 mr-3" />
                  Multi-Entity Consolidations
                </h3>
                <p className="text-gray-300 mb-4">
                  Track transactions across unlimited subsidiaries, joint ventures, and partnerships. Automatically handle eliminations, minority interests, and currency translations.
                </p>
                <div className="bg-gray-900/50 rounded p-3 font-mono text-sm text-purple-300">
                  "Show me the consolidated P&L eliminating all intercompany transactions between US and EU entities"
                </div>
              </div>
              
              <div className="bg-gray-800/30 rounded-lg p-6 border border-pink-500/20">
                <h3 className="text-xl font-semibold mb-3 flex items-center">
                  <Network className="h-6 w-6 text-pink-400 mr-3" />
                  Transaction Genealogy
                </h3>
                <p className="text-gray-300 mb-4">
                  Trace any transaction through its entire lifecycle. See how a customer payment flows through revenue recognition, tax calculations, and commission splits.
                </p>
                <div className="bg-gray-900/50 rounded p-3 font-mono text-sm text-pink-300">
                  "Trace invoice #1234 from creation through payment, including all related journal entries"
                </div>
              </div>
              
              <div className="bg-gray-800/30 rounded-lg p-6 border border-sky-500/20">
                <h3 className="text-xl font-semibold mb-3 flex items-center">
                  <Building className="h-6 w-6 text-sky-400 mr-3" />
                  Dynamic Hierarchies
                </h3>
                <p className="text-gray-300 mb-4">
                  Reorganize your business without breaking your books. Move departments, reassign cost centers, or restructure entities while maintaining historical accuracy.
                </p>
                <div className="bg-gray-900/50 rounded p-3 font-mono text-sm text-sky-300">
                  "Show Q3 results as if the EMEA reorganization had happened at the beginning of the year"
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl" />
              <div className="relative bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
                <h3 className="text-2xl font-bold mb-6 text-center">
                  Why This Matters
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-100">Real-time Insights</p>
                      <p className="text-gray-400 text-sm mt-1">
                        No more waiting for month-end reports. Get answers instantly as your business operates.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-100">Audit-Ready Always</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Every transaction is traceable. Every relationship is documented. Every change is tracked.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-100">Scale Without Limits</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Add entities, dimensions, or currencies without performance degradation or system redesign.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-100">Business-Centric Design</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Model your actual business relationships, not force them into rigid chart of accounts structures.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Benefits Section */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the Way You Actually Work
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Stop adapting to your GL's limitations. Start working the way that makes sense for your business.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-sky-600">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Natural Language</h3>
              <p className="text-gray-400 text-sm">
                Ask questions in plain English. No SQL, no complex report builders.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-purple-600">
                <Database className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Intelligent Structure</h3>
              <p className="text-gray-400 text-sm">
                Understands relationships between entities, transactions, and time.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Analysis</h3>
              <p className="text-gray-400 text-sm">
                Instant insights without waiting for batch processes or reports.
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600">
                <Network className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Complete Visibility</h3>
              <p className="text-gray-400 text-sm">
                Trace any transaction through its entire lifecycle and relationships.
              </p>
            </div>
          </div>
          
          <div className="mt-16 bg-gradient-to-r from-sky-900/50 to-purple-900/50 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">
              The Power of Understanding Context
            </h3>
            <p className="text-gray-300 max-w-3xl mx-auto">
              Traditional GLs store data. GLAPI understands it. By modeling the real relationships in your business - 
              between customers, contracts, entities, and transactions - we enable queries and insights that would take 
              weeks of manual work in traditional systems.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A New Standard for General Ledgers
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              See how GLAPI compares to traditional accounting systems
            </p>
          </div>
          
          <div className="max-w-6xl mx-auto">
            <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900/50">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr className="bg-gray-800/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Traditional GL</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-sky-400">GLAPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Query Interface</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">SQL/Report Builder</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Natural Language</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Data Architecture</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">Tables & Joins</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Event-Sourced</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Transaction History</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-yellow-400">~</span>
                      <span className="text-xs text-gray-500 block">Limited Audit Trail</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Complete Timeline</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Relationship Tracking</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">Foreign Keys Only</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Full Context</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Multi-Entity Support</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-yellow-400">~</span>
                      <span className="text-xs text-gray-500 block">Manual Setup</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Native Support</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Real-time Processing</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">Batch Updates</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Instant</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Time Travel</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">Not Possible</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Any Point in Time</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">Learning Curve</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400">✗</span>
                      <span className="text-xs text-gray-500 block">Weeks/Months</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400">✓</span>
                      <span className="text-xs text-gray-400 block">Minutes</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400">
                <span className="text-green-400">✓</span> Full Support
                <span className="mx-4 text-yellow-400">~</span> Partial/Manual
                <span className="mx-4 text-red-400">✗</span> Not Available
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-sky-600 to-purple-600">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Experience the Future of Financial Data
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-sky-100">
              See how natural language transforms the way you interact with your general ledger. 
              Get insights in seconds, not days.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <SignUpButton mode="modal">
                <button className="rounded-md bg-white px-8 py-4 text-lg font-semibold text-gray-900 hover:bg-gray-100 transition-all duration-200 shadow-lg transform hover:scale-105">
                  Try It Free for 30 Days
                </button>
              </SignUpButton>
              <Link href="/contact" className="text-lg font-semibold leading-6 text-white hover:text-sky-200 transition-colors group">
                Schedule a Demo <ArrowRight className="ml-2 h-4 w-4 inline group-hover:translate-x-1 transition-transform" />
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
