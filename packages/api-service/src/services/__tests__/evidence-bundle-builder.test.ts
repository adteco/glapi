import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { buildEvidenceBundleArchive } from '../evidence-bundle-builder';
import type {
  AuditEvidencePackageRecord,
  UnifiedAuditLogRecord,
  ApprovalInstance,
  WorkflowApprovalAction,
} from '@glapi/database/schema';

function createPackage(): AuditEvidencePackageRecord {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'pkg-123',
    organizationId: 'org-1',
    packageName: 'SOX Q1 Controls',
    description: 'Quarterly review',
    startDate: now,
    endDate: new Date(now.getTime() + 1000),
    filters: {
      resourceTypes: ['journal_entry'],
    },
    logCount: '2',
    contentHash: 'placeholder',
    status: 'PENDING',
    createdBy: 'auditor-1',
    accessibleBy: ['auditor-1'],
    createdAt: now,
    expiresAt: null,
    downloadedAt: null,
    storageLocation: null,
    errorMessage: null,
  };
}

function createLogs(): UnifiedAuditLogRecord[] {
  return [
    {
      id: 'log-1',
      organizationId: 'org-1',
      eventId: null,
      correlationId: null,
      causationId: null,
      actorId: 'user-1',
      actorType: 'USER',
      actorEmail: 'user@example.com',
      actorName: 'User One',
      sessionId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'cli',
      actionType: 'CREATE',
      actionDescription: 'Created journal entry',
      severity: 'INFO',
      resourceType: 'journal_entry',
      resourceId: 'je-1',
      resourceName: 'JE-1',
      previousState: null,
      newState: { amount: 100 },
      changedFields: ['amount'],
      payloadHash: 'hash',
      metadata: {
        codeReferences: [
          {
            repository: 'glapi/ledger',
            commit: 'abc123',
            file: 'services/journal-entry.ts',
            description: 'Posting rules',
          },
        ],
      },
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      recordedAt: new Date('2026-01-01T00:00:01.000Z'),
      exported: false,
      exportedAt: null,
    },
    {
      id: 'log-2',
      organizationId: 'org-1',
      eventId: null,
      correlationId: null,
      causationId: null,
      actorId: 'user-2',
      actorType: 'USER',
      actorEmail: 'user2@example.com',
      actorName: 'User Two',
      sessionId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'cli',
      actionType: 'APPROVE',
      actionDescription: 'Approved journal entry',
      severity: 'INFO',
      resourceType: 'journal_entry',
      resourceId: 'je-1',
      resourceName: 'JE-1',
      previousState: null,
      newState: { status: 'approved' },
      changedFields: ['status'],
      payloadHash: 'hash',
      metadata: {},
      occurredAt: new Date('2026-01-01T00:10:00.000Z'),
      recordedAt: new Date('2026-01-01T00:10:01.000Z'),
      exported: false,
      exportedAt: null,
    },
  ];
}

function createApprovalDetails(): Array<{
  instance: ApprovalInstance;
  actions: WorkflowApprovalAction[];
}> {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const instance: ApprovalInstance = {
    id: 'approval-1',
    organizationId: 'org-1',
    documentType: 'journal_entry',
    documentId: 'je-1',
    documentNumber: 'JE-1',
    policyId: null,
    policySnapshot: null,
    status: 'approved',
    currentStepNumber: 1,
    totalSteps: 1,
    submittedAt: now,
    submittedBy: 'user-1',
    requiredByDate: null,
    completedAt: new Date('2026-01-01T00:30:00.000Z'),
    finalApprovedBy: 'user-2',
    finalRejectedBy: null,
    finalComments: 'Looks good',
    documentAmount: '100.00',
    subsidiaryId: null,
    departmentId: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  const action: WorkflowApprovalAction = {
    id: 'action-1',
    approvalInstanceId: 'approval-1',
    stepNumber: 1,
    action: 'approve',
    actionBy: 'user-2',
    actionByName: 'User Two',
    actionByRoleId: null,
    actionAt: new Date('2026-01-01T00:25:00.000Z'),
    comments: 'Approved',
    conditions: null,
    delegatedFrom: null,
    delegatedTo: null,
    delegationReason: null,
    wasEscalated: false,
    escalatedFrom: null,
    escalationReason: null,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date('2026-01-01T00:25:01.000Z'),
  };

  return [{ instance, actions: [action] }];
}

describe('buildEvidenceBundleArchive', () => {
  it('creates a compressed payload with manifest + artifacts', () => {
    const pkg = createPackage();
    const logs = createLogs();
    const approvals = createApprovalDetails();

    const result = buildEvidenceBundleArchive({
      pkg,
      logs,
      approvals,
      options: {
        includeApprovals: true,
        includeCodeReferences: true,
        includeRawLogs: true,
      },
    });

    expect(result.manifest.totals.auditLogs).toBe(2);
    expect(result.manifest.totals.approvals).toBe(1);
    expect(result.manifest.totals.codeReferences).toBe(1);
    expect(result.bundle.length).toBeGreaterThan(0);

    const decoded = JSON.parse(gunzipSync(result.bundle).toString('utf-8'));
    expect(Array.isArray(decoded.auditLogs)).toBe(true);
    expect(decoded.auditLogs).toHaveLength(2);
    expect(decoded.approvals[0].actions).toHaveLength(1);
    expect(decoded.codeReferences).toHaveLength(1);
  });

  it('allows sections to be omitted', () => {
    const result = buildEvidenceBundleArchive({
      pkg: createPackage(),
      logs: createLogs(),
      approvals: createApprovalDetails(),
      options: {
        includeApprovals: false,
        includeRawLogs: false,
        includeCodeReferences: false,
      },
    });

    const decoded = JSON.parse(gunzipSync(result.bundle).toString('utf-8'));
    expect(decoded.auditLogs).toBeUndefined();
    expect(decoded.approvals).toBeUndefined();
    expect(decoded.codeReferences).toBeUndefined();
    expect(result.manifest.includes.approvals).toBe(false);
  });
});
