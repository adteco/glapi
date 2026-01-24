'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface LayoutContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const LayoutContext = React.createContext<LayoutContextValue | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = 'glapi-sidebar-collapsed';

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsedState] = React.useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Load sidebar state from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setSidebarCollapsedState(stored === 'true');
    }
  }, []);

  // Persist sidebar state to localStorage
  const setSidebarCollapsed = React.useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const key = e.key.toLowerCase();

      // ⌘+/ or Ctrl+/ - Show keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsModalOpen((open) => !open);
        return;
      }

      // ⌘+B or Ctrl+B - Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Two-key navigation shortcuts (G + letter)
      // Check if previous key was 'g' within 500ms
      if (lastKey === 'g' && now - lastKeyTime < 500) {
        e.preventDefault();

        switch (key) {
          case 'h':
            router.push('/dashboard');
            break;
          case 'p':
            router.push('/projects');
            break;
          case 'c':
            router.push('/relationships/customers');
            break;
          case 'i':
            router.push('/transactions/sales/invoices');
            break;
          case 's':
            router.push('/admin/settings');
            break;
        }

        lastKey = '';
        return;
      }

      // Store the current key for two-key combos
      lastKey = key;
      lastKeyTime = now;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, toggleSidebar]);

  const value = React.useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      shortcutsModalOpen,
      setShortcutsModalOpen,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
    }),
    [sidebarCollapsed, setSidebarCollapsed, toggleSidebar, shortcutsModalOpen, isMobileMenuOpen]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const context = React.useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
