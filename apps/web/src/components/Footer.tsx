'use client';

import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.glapi.net';
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <ShieldCheck className="h-8 w-8 text-sky-400" />
              <span className="text-xl font-bold text-white">GLAPI</span>
            </div>
            <p className="text-gray-400 text-sm">
              API-first general ledger built for modern business. 
              High-performance, AI-ready, and designed to scale.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/product" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <a 
                  href={docsUrl} 
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a 
                  href={docsUrl} 
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  API Reference
                </a>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Security
                </Link>
              </li>
              <li>
                <a href="mailto:support@glapi.com" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="mailto:legal@glapi.com" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Legal
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 GLAPI. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}