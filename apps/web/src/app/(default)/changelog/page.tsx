'use client';

import React from 'react';
import { Calendar, Sparkles, Bug, Zap, AlertTriangle } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  features?: string[];
  improvements?: string[];
  fixes?: string[];
  breaking?: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: 'December 2024',
    features: [
      'Added MCP server integration for enhanced AI capabilities',
      'New SSPML Training Service for machine learning workflows',
      'Comprehensive API documentation with OpenAPI support',
    ],
    improvements: [
      'Improved TypeScript build process and type safety',
      'Enhanced error handling across all services',
    ],
    fixes: [
      'Resolved MCP server TypeScript build errors',
      'Fixed SSPMLTrainingService wrapper implementation',
    ],
  },
  {
    version: '1.1.0',
    date: 'November 2024',
    features: [
      'Revenue recognition dashboard with real-time metrics',
      'Contract management system for performance obligations',
      'Accounting dimensions API (customers, organizations, subsidiaries)',
    ],
    improvements: [
      'Streamlined authentication flow with Clerk integration',
      'Enhanced data validation with Zod schemas',
    ],
    fixes: [
      'Fixed database migration scripts for PostgreSQL',
      'Resolved API endpoint routing issues',
    ],
  },
  {
    version: '1.0.0',
    date: 'October 2024',
    features: [
      'Initial release of GLAPI platform',
      'Core accounting dimensions: classes, departments, locations',
      'Express.js REST API with authentication middleware',
      'Next.js web application with shadcn/ui components',
      'Drizzle ORM integration with PostgreSQL',
    ],
    improvements: [
      'Monorepo structure with Turborepo for optimal builds',
    ],
  },
];

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="relative pl-8 pb-12 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-sky-500 to-purple-500" />

      {/* Timeline dot */}
      <div className="absolute left-0 top-0 w-2 h-2 -translate-x-[3px] rounded-full bg-sky-500 ring-4 ring-gray-900" />

      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-sky-500/30 transition-colors">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <span className="px-3 py-1 bg-sky-500/20 text-sky-400 rounded-full text-sm font-semibold">
            v{entry.version}
          </span>
          <span className="flex items-center gap-2 text-gray-400 text-sm">
            <Calendar className="w-4 h-4" />
            {entry.date}
          </span>
        </div>

        {/* Features */}
        {entry.features && entry.features.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-green-400 font-semibold mb-2">
              <Sparkles className="w-4 h-4" />
              New Features
            </h3>
            <ul className="space-y-1">
              {entry.features.map((feature, i) => (
                <li key={i} className="text-gray-300 text-sm pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-green-400">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {entry.improvements && entry.improvements.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sky-400 font-semibold mb-2">
              <Zap className="w-4 h-4" />
              Improvements
            </h3>
            <ul className="space-y-1">
              {entry.improvements.map((improvement, i) => (
                <li key={i} className="text-gray-300 text-sm pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-sky-400">
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bug Fixes */}
        {entry.fixes && entry.fixes.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
              <Bug className="w-4 h-4" />
              Bug Fixes
            </h3>
            <ul className="space-y-1">
              {entry.fixes.map((fix, i) => (
                <li key={i} className="text-gray-300 text-sm pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-orange-400">
                  {fix}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Breaking Changes */}
        {entry.breaking && entry.breaking.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-red-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4" />
              Breaking Changes
            </h3>
            <ul className="space-y-1">
              {entry.breaking.map((change, i) => (
                <li key={i} className="text-gray-300 text-sm pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-red-400">
                  {change}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <section className="relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          {/* Page header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-purple-400 mb-4">
              Changelog
            </h1>
            <p className="text-xl text-gray-400">
              Stay up to date with the latest features, improvements, and fixes.
            </p>
          </div>

          {/* Changelog timeline */}
          <div className="max-w-3xl mx-auto">
            {changelog.map((entry, index) => (
              <ChangelogCard key={index} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
