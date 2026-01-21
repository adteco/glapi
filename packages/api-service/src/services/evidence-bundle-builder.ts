import { gzipSync } from 'node:zlib';
import type {
  AuditEvidencePackageRecord,
  UnifiedAuditLogRecord,
  ApprovalInstance,
  WorkflowApprovalAction,
} from '@glapi/database/schema';

export interface EvidenceApprovalDetail {
  instance: ApprovalInstance;
  actions: WorkflowApprovalAction[];
}

export interface EvidenceCodeReference {
  sourceLogId: string;
  repository?: string | null;
  commit?: string | null;
  filePath?: string | null;
  link?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EvidenceBundleManifest {
  packageId: string;
  packageName: string;
  organizationId: string;
  generatedAt: string;
  range: {
    start: string;
    end: string;
  };
  filters?: Record<string, unknown> | null;
  compression: 'gzip';
  formatVersion: string;
  includes: {
    auditLogs: boolean;
    approvals: boolean;
    codeReferences: boolean;
  };
  totals: {
    auditLogs: number;
    approvals: number;
    approvalActions: number;
    codeReferences: number;
  };
  breakdowns: {
    severity: Record<string, number>;
    actionTypes: Record<string, number>;
    resourceTypes: Record<string, number>;
    actors: Array<{ actorId: string; actorName?: string | null; actionCount: number }>;
  };
}

export interface EvidenceBundleBuilderOptions {
  includeRawLogs?: boolean;
  includeApprovals?: boolean;
  includeCodeReferences?: boolean;
}

export interface EvidenceBundleBuildResult {
  manifest: EvidenceBundleManifest;
  bundle: Buffer;
  payloadSize: number;
  codeReferences: EvidenceCodeReference[];
}

const BUNDLE_VERSION = '2026-01-18';

export function buildEvidenceBundleArchive(params: {
  pkg: AuditEvidencePackageRecord;
  logs: UnifiedAuditLogRecord[];
  approvals: EvidenceApprovalDetail[];
  options?: EvidenceBundleBuilderOptions;
}): EvidenceBundleBuildResult {
  const { pkg, logs, approvals, options } = params;
  const includeRawLogs = options?.includeRawLogs !== false;
  const includeApprovals = options?.includeApprovals !== false;
  const includeCodeReferences = options?.includeCodeReferences !== false;

  const codeReferences = includeCodeReferences ? extractCodeReferences(logs) : [];
  const approvalActionCount = approvals.reduce((total, detail) => total + detail.actions.length, 0);

  const severityBreakdown = aggregateBy(logs, (log) => log.severity || 'UNKNOWN');
  const actionBreakdown = aggregateBy(logs, (log) => log.actionType);
  const resourceBreakdown = aggregateBy(logs, (log) => log.resourceType);
  const actorBreakdown = Array.from(
    logs.reduce<Map<string, { actorId: string; actorName?: string | null; actionCount: number }>>(
      (map, log) => {
        const key = log.actorId;
        const existing = map.get(key);
        if (existing) {
          existing.actionCount += 1;
        } else {
          map.set(key, {
            actorId: key,
            actorName: log.actorName,
            actionCount: 1,
          });
        }
        return map;
      },
      new Map()
    ).values()
  );

  const manifest: EvidenceBundleManifest = {
    packageId: pkg.id,
    packageName: pkg.packageName,
    organizationId: pkg.organizationId,
    generatedAt: new Date().toISOString(),
    range: {
      start: new Date(pkg.startDate).toISOString(),
      end: new Date(pkg.endDate).toISOString(),
    },
    filters: (pkg.filters as Record<string, unknown> | null) || null,
    compression: 'gzip',
    formatVersion: BUNDLE_VERSION,
    includes: {
      auditLogs: includeRawLogs,
      approvals: includeApprovals,
      codeReferences: includeCodeReferences,
    },
    totals: {
      auditLogs: logs.length,
      approvals: approvals.length,
      approvalActions: approvalActionCount,
      codeReferences: codeReferences.length,
    },
    breakdowns: {
      severity: severityBreakdown,
      actionTypes: actionBreakdown,
      resourceTypes: resourceBreakdown,
      actors: actorBreakdown,
    },
  };

  const payload: Record<string, unknown> = {
    manifest,
  };

  if (includeRawLogs) {
    payload.auditLogs = logs;
  }
  if (includeApprovals) {
    payload.approvals = approvals;
  }
  if (includeCodeReferences) {
    payload.codeReferences = codeReferences;
  }

  const jsonBuffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
  const compressed = gzipSync(jsonBuffer);

  return {
    manifest,
    bundle: compressed,
    payloadSize: jsonBuffer.length,
    codeReferences,
  };
}

function aggregateBy<T>(
  items: T[],
  selector: (item: T) => string | null | undefined
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = selector(item) || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function extractCodeReferences(logs: UnifiedAuditLogRecord[]): EvidenceCodeReference[] {
  const results = new Map<string, EvidenceCodeReference>();

  for (const log of logs) {
    const metadata = (log.metadata as Record<string, unknown> | null) || {};
    const rawCodeRefs = resolveCodeReferenceEntries(metadata);

    for (const ref of rawCodeRefs) {
      const key = `${ref.repository || ''}:${ref.commit || ''}:${ref.filePath || ''}:${ref.link || ''}`;
      if (!results.has(key)) {
        results.set(key, {
          ...ref,
          sourceLogId: log.id,
        });
      }
    }
  }

  return Array.from(results.values());
}

function resolveCodeReferenceEntries(
  metadata: Record<string, unknown>
): Array<Omit<EvidenceCodeReference, 'sourceLogId'>> {
  const refs: Array<Omit<EvidenceCodeReference, 'sourceLogId'>> = [];

  const explicit = metadata.codeReferences;
  if (Array.isArray(explicit)) {
    for (const entry of explicit) {
      if (entry && typeof entry === 'object') {
        refs.push({
          repository: (entry as any).repository ?? null,
          commit: (entry as any).commit ?? null,
          filePath: (entry as any).file ?? (entry as any).filePath ?? null,
          link: (entry as any).link ?? null,
          description: (entry as any).description ?? null,
          metadata: entry as Record<string, unknown>,
        });
      }
    }
  }

  if (typeof metadata.codeRef === 'string') {
    refs.push({
      repository: null,
      commit: metadata.codeRef,
      filePath: null,
      link: null,
      description: metadata.codeRef,
      metadata: { hint: 'codeRef' },
    });
  }

  return refs;
}
