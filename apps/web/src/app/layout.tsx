import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from "@clerk/themes";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { Toaster } from 'sonner';
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { ConversationalLedger } from "@/components/chat/conversational-ledger";
import { clerkRedirects } from "@/lib/clerk-redirects";
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GLAPI App", // Updated title
  description: "API First General Ledger", // Updated description
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  // Only apply satellite domain configuration if explicitly requested AND not running on localhost
  const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true' && !isLocal;

  return (
    <ClerkProvider
      appearance={{ baseTheme: dark }}
      signInFallbackRedirectUrl={clerkRedirects.signInFallbackRedirectUrl}
      signUpFallbackRedirectUrl={clerkRedirects.signUpFallbackRedirectUrl}
      {...(isSatellite && {
        isSatellite: true,
        domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,         // e.g., "https://glapi.net"
        signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL, // e.g., "https://adteco.com/sign-in"
        signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL, // e.g., "https://adteco.com/sign-up"
      })}
    >
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className={`${inter.className} bg-background text-foreground`}>
          <PostHogProvider>
            <TRPCProvider>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </TRPCProvider>
          </PostHogProvider>
          <Toaster richColors closeButton position="top-right" />
          <ConversationalLedger />
        </body>
      </html>
    </ClerkProvider>
  );
}
