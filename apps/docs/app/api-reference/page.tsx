'use client';

import { useEffect, useRef } from 'react';

/**
 * Interactive API Reference using Scalar
 *
 * This page provides an interactive playground for testing GLAPI endpoints.
 * The OpenAPI specification is automatically generated from the tRPC routers.
 */
export default function ApiReferencePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Dynamically import Scalar
    import('@scalar/api-reference').then(({ ApiReference }) => {
      if (containerRef.current && !containerRef.current.hasChildNodes()) {
        const el = document.createElement('div');
        el.id = 'api-reference';
        containerRef.current.appendChild(el);

        // @ts-ignore
        ApiReference(el, {
          spec: {
            url: '/api/openapi.json',
          },
          configuration: {
            theme: 'default',
            layout: 'modern',
            hideModels: false,
            hideDownloadButton: false,
            darkMode: true,
          },
        });
      }
    });
  }, []);

  return <div ref={containerRef} className="w-full h-screen" />;
}
