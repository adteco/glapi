import {
  and,
  entities,
  eq,
  sql,
  type ContextualDatabase,
  db as defaultDb,
} from '@glapi/database';
import type { PendingDocument, PendingDocumentStatusValue } from '@glapi/database';
import { BaseService } from './base-service';

export interface VendorBillApprovalRulesServiceOptions {
  db?: ContextualDatabase;
}

export interface VendorBillApprovalDecision {
  status: PendingDocumentStatusValue;
  ruleId: string;
  reason: string;
}

interface VendorMetadata {
  trustedForBills?: boolean;
  billApproval?: {
    mode?: 'auto_approve' | 'manual_review';
    maxAutoApproveAmount?: number;
  };
}

interface ApprovalRuleContext {
  document: PendingDocument;
  vendor: {
    id: string;
    name: string;
    metadata?: VendorMetadata | null;
  } | null;
}

interface VendorBillApprovalRuleStrategy {
  readonly id: string;
  evaluate(context: ApprovalRuleContext): VendorBillApprovalDecision | null;
}

class TrustedVendorAutoApprovalStrategy implements VendorBillApprovalRuleStrategy {
  readonly id = 'trusted-vendor-auto-approval';

  evaluate(context: ApprovalRuleContext): VendorBillApprovalDecision | null {
    const metadata = context.vendor?.metadata;
    const isTrusted =
      metadata?.trustedForBills === true ||
      metadata?.billApproval?.mode === 'auto_approve';

    if (!context.vendor || !isTrusted) {
      return null;
    }

    const maxAutoApproveAmount = metadata?.billApproval?.maxAutoApproveAmount;
    const totalAmount = context.document.extractedData?.invoice?.totalAmount;

    if (
      typeof maxAutoApproveAmount === 'number' &&
      typeof totalAmount === 'number' &&
      totalAmount > maxAutoApproveAmount
    ) {
      return {
        status: 'PENDING_REVIEW',
        ruleId: this.id,
        reason: `Trusted vendor bill exceeds auto-approval limit of ${maxAutoApproveAmount}.`,
      };
    }

    return {
      status: 'APPROVED',
      ruleId: this.id,
      reason: `Vendor ${context.vendor.name} is trusted for bill auto-approval.`,
    };
  }
}

export class VendorBillApprovalRulesService extends BaseService {
  private db: ContextualDatabase | typeof defaultDb;
  private strategies: VendorBillApprovalRuleStrategy[];

  constructor(context = {}, options: VendorBillApprovalRulesServiceOptions = {}) {
    super(context);
    this.db = options.db || defaultDb;
    this.strategies = [new TrustedVendorAutoApprovalStrategy()];
  }

  async evaluate(document: PendingDocument): Promise<VendorBillApprovalDecision> {
    const organizationId = this.requireOrganizationContext();
    const vendor = document.matchedVendorId
      ? await this.getVendor(document.matchedVendorId, organizationId)
      : null;

    for (const strategy of this.strategies) {
      const decision = strategy.evaluate({ document, vendor });
      if (decision) {
        return decision;
      }
    }

    return {
      status: 'PENDING_REVIEW',
      ruleId: 'manual-review-default',
      reason: 'No auto-approval rule matched.',
    };
  }

  private async getVendor(id: string, organizationId: string) {
    const [vendor] = await this.db
      .select({
        id: entities.id,
        name: entities.name,
        metadata: entities.metadata,
      })
      .from(entities)
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId),
          sql`(${entities.entityTypes} @> ARRAY['Vendor']::text[] OR ${entities.entityTypes} @> ARRAY['vendor']::text[])`
        )
      )
      .limit(1);

    return vendor
      ? {
          id: vendor.id,
          name: vendor.name,
          metadata: vendor.metadata as VendorMetadata | null,
        }
      : null;
  }
}

export const vendorBillApprovalRulesService = {
  create: (context = {}, options: VendorBillApprovalRulesServiceOptions = {}) =>
    new VendorBillApprovalRulesService(context, options),
};
