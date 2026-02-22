'use client';

import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import NewPageSidebar from "@/components/NewPageSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";
import { Button } from "@/components/ui/button";
import { Keyboard, Menu } from "lucide-react";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, toggleSidebar, shortcutsModalOpen, setShortcutsModalOpen, isMobileMenuOpen, setIsMobileMenuOpen } = useLayout();

  return (
    <>
      <div className="flex h-screen">
        <NewPageSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileOpen={isMobileMenuOpen}
          onMobileOpenChange={setIsMobileMenuOpen}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top header with global search */}
          <header className="h-14 border-b border-sidebar-border bg-sidebar flex items-center justify-between px-4 md:px-6 shrink-0">
            {/* Mobile hamburger menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover mr-2"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <GlobalSearch />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShortcutsModalOpen(true)}
              className="text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover ml-4"
            >
              <Keyboard className="h-4 w-4 mr-2" />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] bg-sidebar-accent px-1.5 py-0.5 rounded border border-sidebar-border">
                <span>⌘</span>
                <span>/</span>
              </kbd>
            </Button>
          </header>
          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal open={shortcutsModalOpen} onOpenChange={setShortcutsModalOpen} />
    </>
  );
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  // Define public routes that should not show the sidebar
  const publicRoutes = ['/', '/product', '/pricing', '/contact', '/terms', '/privacy', '/privacy-policy', '/terms-of-service', '/security', '/changelog'];
  const isCustomerPortalRoute = pathname.startsWith('/customer-portal');
  const isPublicRoute = publicRoutes.includes(pathname) || isCustomerPortalRoute;

  // Show sidebar only if user is signed in AND not on a public route
  const showSidebar = isSignedIn && !isPublicRoute;

  if (showSidebar) {
    // Authenticated layout with sidebar, global search, and keyboard shortcuts
    return (
      <LayoutProvider>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </LayoutProvider>
    );
  }

  // Public layout without sidebar
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
