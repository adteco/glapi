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
