import '@/app/global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.glapi.io'
  ),
  title: {
    default: 'GLAPI Documentation',
    template: '%s | GLAPI Docs',
  },
  description: 'API-first General Ledger with revenue recognition, multi-entity support, and real-time reporting. Complete documentation for integrating GLAPI into your applications.',
  keywords: ['GLAPI', 'API', 'General Ledger', 'Accounting', 'Revenue Recognition', 'ASC 606', 'Documentation'],
  authors: [{ name: 'GLAPI Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'GLAPI Documentation',
    title: 'GLAPI Documentation',
    description: 'API-first General Ledger documentation and API reference',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GLAPI Documentation',
    description: 'API-first General Ledger documentation and API reference',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          theme={{
            enabled: true,
            defaultTheme: 'system',
            attribute: 'class',
          }}
          search={{
            enabled: true,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
