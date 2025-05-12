'use client';

import './globals.css';
import './layout.css';

import { ReactNode } from 'react';
import StytchProvider from '../components/StytchProvider';
import Link from 'next/link';
import { useStytchB2BClient, useStytchMemberSession } from '@stytch/nextjs/b2b';
import { useRouter, usePathname } from 'next/navigation';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <StytchProvider>
      <html lang="en">
        <title>GLAPI Revenue Recognition</title>
        <meta
          name="description"
          content="GLAPI Revenue Recognition System"
        />
        <body>
          <div className="page-container">
            <SideNav />
            <main className="content-container">{children}</main>
          </div>
        </body>
      </html>
    </StytchProvider>
  );
}

const SideNav = () => {
  const stytch = useStytchB2BClient();
  const { session } = useStytchMemberSession();
  const router = useRouter();
  const pathname = usePathname();

  // Log the Stytch session data right here in the layout component
  console.log('LAYOUT - RAW STYTCH SESSION:', {
    hasSession: !!session,
    memberId: session?.member_id,
    orgId: session?.organization_id,
    rawSessionObject: session,
    authenticationFactor: session?.authentication_factors,
    roles: session?.roles
  });

  const handleLogOut = () => {
    stytch.session.revoke().then(() => {
      router.replace('/');
    });
  };

  if (!session) {
    return null;
  }

  const isActive = (path: string) => {
    return pathname?.startsWith(path) ? 'bg-blue-700 text-white' : '';
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-top">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white">GLAPI</h1>
          <p className="text-gray-400 text-sm">Revenue Recognition</p>
        </div>
      </div>
      <div className="sidebar-top-links">
        <Link 
          href="/dashboard" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/dashboard')}`}
        >
          Dashboard
        </Link>

        {/* Customer Management Section */}
        <div className="mt-4 mb-2 px-4">
          <span className="text-xs font-semibold text-gray-400 uppercase">Customer Management</span>
        </div>
        <Link 
          href="/customers" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/customers')}`}
        >
          All Customers
        </Link>
        <Link 
          href="/customers/new" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/customers/new')}`}
        >
          Add New Customer
        </Link>

        {/* Admin Section */}
        <div className="mt-4 mb-2 px-4">
          <span className="text-xs font-semibold text-gray-400 uppercase">Administration</span>
        </div>
        <Link 
          href="/members" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/members')}`}
        >
          Team Members
        </Link>
        <Link 
          href="/settings" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/settings')}`}
        >
          Settings
        </Link>
        <Link 
          href="/sso" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/sso')}`}
        >
          SSO
        </Link>
        <Link 
          href="/scim" 
          className={`block px-4 py-2 hover:bg-blue-700 ${isActive('/scim')}`}
        >
          SCIM
        </Link>
      </div>

      <div className="logout-link" onClick={handleLogOut}>
        Log out
      </div>
    </nav>
  );
};