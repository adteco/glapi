'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

/**
 * Interactive API Reference using Scalar
 *
 * This page provides an interactive playground for testing GLAPI endpoints.
 * The OpenAPI specification is automatically generated from the tRPC routers.
 */
export default function ApiReferencePage() {
  return (
    <div className="w-full h-screen">
      <ApiReferenceReact
        configuration={{
          spec: {
            url: '/api/openapi.json',
          },
          theme: 'default',
          layout: 'modern',
          hideModels: false,
          hideDownloadButton: false,
          darkMode: true,
          searchHotKey: 'k',
          servers: [
            {
              url: 'http://localhost:3031',
              description: 'Development Server',
            },
            {
              url: 'https://api.glapi.io',
              description: 'Production Server',
            },
          ],
          authentication: {
            preferredSecurityScheme: 'ClerkAuth',
            apiKey: {
              token: '',
            },
          },
          customCss: `
            .scalar-api-reference {
              --scalar-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
          `,
        }}
      />
    </div>
  );
}
