import type { ProjectStatus } from '@glapi/types';

const projectStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

const legacyProjectStatusMap: Record<string, ProjectStatus> = {
  planning: 'DRAFT',
  draft: 'DRAFT',
  active: 'ACTIVE',
  on_hold: 'ON_HOLD',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  archived: 'ARCHIVED',
};

export const projectStatusOptions: { value: ProjectStatus; label: string }[] = (
  Object.entries(projectStatusLabels) as [ProjectStatus, string][]
).map(([value, label]) => ({ value, label }));

export function normalizeProjectStatus(status?: string | null): ProjectStatus {
  if (!status) {
    return 'DRAFT';
  }

  const normalized = status.trim().toUpperCase().replace(/\s+/g, '_');

  if (normalized in projectStatusLabels) {
    return normalized as ProjectStatus;
  }

  return legacyProjectStatusMap[status.trim().toLowerCase()] ?? 'DRAFT';
}

export function getProjectStatusLabel(status?: string | null): string {
  return projectStatusLabels[normalizeProjectStatus(status)];
}

export function getProjectStatusBadgeVariant(
  status?: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (normalizeProjectStatus(status)) {
    case 'ACTIVE':
      return 'default';
    case 'COMPLETED':
      return 'secondary';
    case 'CANCELLED':
    case 'ARCHIVED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function getProjectStatusToneClass(status?: string | null): string {
  switch (normalizeProjectStatus(status)) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-800';
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800';
    case 'ON_HOLD':
      return 'bg-orange-100 text-orange-800';
    case 'CANCELLED':
    case 'ARCHIVED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
