'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { portalGet, portalPost } from '@/lib/customer-portal-client';
import {
  Clock3,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  LogOut,
  ReceiptText,
} from 'lucide-react';

type PortalSession = {
  authenticated: boolean;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
    fullName?: string | null;
    status: string;
  };
};

const navItems = [
  { href: '/customer-portal', label: 'Overview', icon: Home },
  { href: '/customer-portal/invoices', label: 'Invoices', icon: FileText },
  { href: '/customer-portal/estimates', label: 'Estimates', icon: ClipboardList },
  { href: '/customer-portal/orders', label: 'Orders', icon: ReceiptText },
  { href: '/customer-portal/projects', label: 'Projects', icon: FolderKanban },
  { href: '/customer-portal/time-entries', label: 'Time Entries', icon: Clock3 },
];

export default function CustomerPortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      try {
        const data = await portalGet<PortalSession>('/auth/session');
        if (mounted) {
          setSession(data);
        }
      } catch {
        if (mounted) {
          router.replace('/customer-portal/login');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  const pageTitle = useMemo(() => {
    const match = navItems.find((item) => item.href === pathname);
    return match?.label || 'Customer Portal';
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await portalPost('/auth/logout');
      router.replace('/customer-portal/login');
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-4 text-sm text-slate-300">
          Loading portal session...
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-slate-400">Tenant</p>
          <p className="text-sm font-semibold text-slate-100">{session.organization.name}</p>
          <p className="text-xs text-slate-400">{session.user.fullName || session.user.email}</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/customer-portal' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="outline"
          className="mt-8 w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </aside>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-6 border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
        </div>
        {children}
      </section>
    </div>
  );
}
