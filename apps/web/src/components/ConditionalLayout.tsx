'use client';

import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import NewPageSidebar from "@/components/NewPageSidebar";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { isSignedIn } = useUser();
  const pathname = usePathname();
  
  // Define public routes that should not show the sidebar
  const publicRoutes = ['/', '/product', '/pricing', '/contact', '/terms', '/privacy', '/privacy-policy', '/terms-of-service', '/security'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  // Show sidebar only if user is signed in AND not on a public route
  const showSidebar = isSignedIn && !isPublicRoute;
  
  if (showSidebar) {
    // Authenticated layout with sidebar
    return (
      <div className="flex h-screen">
        <NewPageSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-6">
          {children}
        </main>
      </div>
    );
  }
  
  // Public layout without sidebar
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}