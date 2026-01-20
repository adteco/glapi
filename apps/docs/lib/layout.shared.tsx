import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="GLAPI Logo"
          >
            {/* Ledger book icon */}
            <rect x="4" y="3" width="20" height="22" rx="2" fill="currentColor" opacity="0.9" />
            <rect x="6" y="6" width="10" height="2" rx="1" fill="white" opacity="0.8" />
            <rect x="6" y="10" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="13" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="16" width="14" height="1" rx="0.5" fill="white" opacity="0.5" />
            <rect x="6" y="19" width="8" height="1" rx="0.5" fill="white" opacity="0.5" />
            {/* API indicator */}
            <circle cx="21" cy="21" r="5" fill="#10B981" />
            <path d="M19 21h4M21 19v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold">GLAPI Docs</span>
        </>
      ),
    },
    links: [
      {
        text: 'API Reference',
        url: '/api-reference',
      },
      {
        text: 'Quickstart',
        url: '/docs/quickstart',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/glapi/glapi',
        external: true,
      },
    ],
    githubUrl: 'https://github.com/glapi/glapi',
  };
}
