/**
 * GLAPI Documentation Versioning Configuration
 *
 * This file defines the available documentation versions and their metadata.
 * When a new API version is released, add it to the versions array.
 */

export interface DocVersion {
  /** Version identifier (used in URLs and folder names) */
  slug: string;
  /** Display name for the version */
  label: string;
  /** Whether this is the latest/default version */
  isLatest?: boolean;
  /** Whether this version is deprecated */
  isDeprecated?: boolean;
  /** Release date for this version */
  releaseDate?: string;
  /** End of support date (if deprecated) */
  endOfSupportDate?: string;
  /** Brief description of what changed in this version */
  description?: string;
}

/**
 * All available documentation versions.
 * Listed in reverse chronological order (newest first).
 */
export const DOC_VERSIONS: DocVersion[] = [
  {
    slug: 'v1',
    label: 'v1.0 (Latest)',
    isLatest: true,
    releaseDate: '2026-01-01',
    description: 'Initial stable release with full API coverage',
  },
  // Future versions will be added here:
  // {
  //   slug: 'v2',
  //   label: 'v2.0 (Latest)',
  //   isLatest: true,
  //   releaseDate: '2026-06-01',
  //   description: 'Enhanced subscription management and bulk operations',
  // },
  // {
  //   slug: 'v1',
  //   label: 'v1.0',
  //   isLatest: false,
  //   isDeprecated: true,
  //   releaseDate: '2026-01-01',
  //   endOfSupportDate: '2027-01-01',
  //   description: 'Initial stable release',
  // },
];

/**
 * Get the latest (default) version
 */
export function getLatestVersion(): DocVersion {
  return DOC_VERSIONS.find((v) => v.isLatest) || DOC_VERSIONS[0];
}

/**
 * Get a version by its slug
 */
export function getVersionBySlug(slug: string): DocVersion | undefined {
  return DOC_VERSIONS.find((v) => v.slug === slug);
}

/**
 * Get all non-deprecated versions
 */
export function getActiveVersions(): DocVersion[] {
  return DOC_VERSIONS.filter((v) => !v.isDeprecated);
}

/**
 * Check if a version slug is valid
 */
export function isValidVersion(slug: string): boolean {
  return DOC_VERSIONS.some((v) => v.slug === slug);
}
