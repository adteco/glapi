'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Mail,
  FileText,
  GitBranch,
  BarChart3,
  History,
  UserX,
} from 'lucide-react';

const navigationItems = [
  {
    name: 'Overview',
    href: '/admin/communications',
    icon: Mail,
    exact: true,
  },
  {
    name: 'Templates',
    href: '/admin/communications/templates',
    icon: FileText,
  },
  {
    name: 'Workflows',
    href: '/admin/communications/workflows',
    icon: GitBranch,
  },
  {
    name: 'Communication Log',
    href: '/admin/communications/log',
    icon: History,
  },
  {
    name: 'Analytics',
    href: '/admin/communications/analytics',
    icon: BarChart3,
  },
  {
    name: 'Unsubscribes',
    href: '/admin/communications/unsubscribes',
    icon: UserX,
  },
];

export default function CommunicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r bg-muted/30">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Communications</h2>
          <p className="text-sm text-muted-foreground">
            Email templates, workflows & analytics
          </p>
        </div>
        <nav className="px-3 pb-6">
          {navigationItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
