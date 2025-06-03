'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { 
  ShieldCheck, 
  Lock, 
  Shield, 
  Key, 
  Database, 
  Eye, 
  FileCheck, 
  Server,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function SecurityPage() {
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

      {/* Hero Section */}
      <div className="relative px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Enterprise-Grade Security
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Your financial data deserves the highest level of protection. GLAPI implements 
            industry-leading security measures to keep your information safe.
          </p>
        </div>
      </div>

      {/* Security Features */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comprehensive Security Framework
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Multi-layered security architecture designed for financial services.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">End-to-End Encryption</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  AES-256 encryption in transit and at rest. All data is encrypted before storage 
                  and during transmission using industry-standard protocols.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Key className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Access Control</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Role-based access control (RBAC) with multi-factor authentication. 
                  Granular permissions ensure users only access what they need.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Audit & Monitoring</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Comprehensive audit trails and real-time monitoring. 
                  Every action is logged with 24/7 security monitoring.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Compliance & Certifications */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Compliance & Certifications
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Meeting the highest industry standards for financial data protection.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <FileCheck className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">SOC 2 Type II</h3>
                <p className="text-gray-300 mb-6">
                  Independently audited for security, availability, processing integrity, 
                  confidentiality, and privacy controls.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Annual third-party audits</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Continuous monitoring</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Detailed compliance reporting</span>
                  </li>
                </ul>
              </div>
              <div className="relative p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
                <Shield className="h-12 w-12 text-sky-400 mb-4" />
                <h3 className="text-xl font-semibold mb-4">Data Protection</h3>
                <p className="text-gray-300 mb-6">
                  GDPR, CCPA, and other privacy regulation compliance with data 
                  residency options and privacy by design.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">GDPR compliant</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Data residency controls</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Right to be forgotten</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Security */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Infrastructure Security
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Built on secure, scalable cloud infrastructure with enterprise-grade protection.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Server className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Secure Data Centers</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Tier IV data centers with 24/7 physical security, biometric access controls, 
                  and environmental monitoring.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Data Backup & Recovery</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  Automated backups with point-in-time recovery. Geographically distributed 
                  backup storage with 99.99% durability.
                </dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-600">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <dt className="text-xl font-semibold leading-7">Incident Response</dt>
                <dd className="mt-1 text-base leading-7 text-gray-300">
                  24/7 security operations center with automated threat detection 
                  and rapid incident response procedures.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Security Practices */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security Best Practices
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Proactive security measures and continuous improvement.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-semibold mb-6">Development Security</h3>
                <ul className="space-y-4">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Secure coding practices</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Automated security testing</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Code review and approval process</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Vulnerability scanning</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Dependency monitoring</span>
                  </li>
                </ul>
              </div>
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-semibold mb-6">Operational Security</h3>
                <ul className="space-y-4">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Regular security training</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Penetration testing</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Security incident drills</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Background checks</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    <span className="text-gray-300">Vendor security assessments</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Contact */}
      <div className="py-24 sm:py-32 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security Questions?
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Our security team is here to help with any questions or concerns.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link 
                href="/contact" 
                className="rounded-md bg-sky-600 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-500 transition-colors duration-200 shadow-lg"
              >
                Contact Security Team
              </Link>
              <a 
                href="mailto:security@glapi.com" 
                className="text-lg font-semibold leading-6 text-white hover:text-sky-400 transition-colors"
              >
                security@glapi.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}