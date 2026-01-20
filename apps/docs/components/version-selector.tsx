'use client';

import { usePathname, useRouter } from 'next/navigation';
import { DOC_VERSIONS, type DocVersion, getLatestVersion } from '@/lib/versions';

interface VersionSelectorProps {
  /** Current version slug */
  currentVersion?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Version selector dropdown for switching between documentation versions.
 * Automatically updates the URL to maintain the same page in a different version.
 */
export function VersionSelector({
  currentVersion,
  className = '',
}: VersionSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current version from props or URL
  const version =
    currentVersion || extractVersionFromPath(pathname) || getLatestVersion().slug;

  const handleVersionChange = (newVersion: string) => {
    const newPath = replaceVersionInPath(pathname, version, newVersion);
    router.push(newPath);
  };

  const selectedVersion = DOC_VERSIONS.find((v) => v.slug === version);

  return (
    <div className={`relative ${className}`}>
      <select
        value={version}
        onChange={(e) => handleVersionChange(e.target.value)}
        className="appearance-none bg-fd-muted border border-fd-border rounded-md px-3 py-1.5 pr-8 text-sm font-medium cursor-pointer hover:bg-fd-accent transition-colors focus:outline-none focus:ring-2 focus:ring-fd-primary"
        aria-label="Select documentation version"
      >
        {DOC_VERSIONS.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.label}
            {v.isDeprecated ? ' (Deprecated)' : ''}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fd-muted-foreground pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
      {/* Show deprecation warning if needed */}
      {selectedVersion?.isDeprecated && (
        <DeprecationBanner version={selectedVersion} />
      )}
    </div>
  );
}

/**
 * Banner shown when viewing deprecated documentation
 */
function DeprecationBanner({ version }: { version: DocVersion }) {
  const latestVersion = getLatestVersion();

  return (
    <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
      <p className="text-yellow-800 dark:text-yellow-200">
        <strong>Warning:</strong> You&apos;re viewing documentation for {version.label},
        which is deprecated.
        {version.endOfSupportDate && (
          <> End of support: {version.endOfSupportDate}.</>
        )}
      </p>
      <a
        href={`/docs/${latestVersion.slug}`}
        className="text-yellow-700 dark:text-yellow-300 underline hover:no-underline mt-1 inline-block"
      >
        View latest documentation ({latestVersion.label})
      </a>
    </div>
  );
}

/**
 * Extract version slug from a documentation path
 * e.g., "/docs/v1/getting-started" -> "v1"
 */
function extractVersionFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/docs\/(v\d+)/);
  return match ? match[1] : null;
}

/**
 * Replace version in path while maintaining the rest of the URL
 * e.g., "/docs/v1/api/endpoints" -> "/docs/v2/api/endpoints"
 */
function replaceVersionInPath(
  pathname: string,
  currentVersion: string,
  newVersion: string
): string {
  // If path has version, replace it
  if (pathname.includes(`/docs/${currentVersion}`)) {
    return pathname.replace(`/docs/${currentVersion}`, `/docs/${newVersion}`);
  }
  // If path doesn't have version, add it
  if (pathname.startsWith('/docs')) {
    return pathname.replace('/docs', `/docs/${newVersion}`);
  }
  return `/docs/${newVersion}`;
}

/**
 * Version badge component for inline use
 */
export function VersionBadge({
  version,
  className = '',
}: {
  version: string;
  className?: string;
}) {
  const versionInfo = DOC_VERSIONS.find((v) => v.slug === version);

  if (!versionInfo) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        versionInfo.isDeprecated
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          : versionInfo.isLatest
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      } ${className}`}
    >
      {versionInfo.label}
      {versionInfo.isLatest && ' (Latest)'}
    </span>
  );
}
