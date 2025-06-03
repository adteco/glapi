import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from "@clerk/themes";
import NewPageSidebar from "@/components/NewPageSidebar";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GLAPI App", // Updated title
  description: "API First General Ledger", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className={`${inter.className} bg-background text-foreground`}>
          <div className="flex h-screen">
            <NewPageSidebar />
            <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-6">
              {children}
            </main>
          </div>
          <Toaster richColors closeButton position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
