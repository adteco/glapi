/**
 * Seed file for common approval policy templates
 *
 * This file provides pre-configured approval policies and SoD rules
 * that can be used as starting points for organizations.
 *
 * Usage:
 *   pnpm --filter database seed:approval-policies
 *
 * Templates included:
 *   - Journal Entry Approval (threshold-based)
 *   - Purchase Order Approval (multi-level)
 *   - Vendor Bill Approval (with SoD)
 *   - Bank Deposit Approval
 *   - SoD Rules for financial controls
 */

import { db } from './db';
import {
  approvalPolicies,
  approvalSteps,
  sodPolicies,
  sodRules,
} from './db/schema/approval-workflow';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ============================================================================
// Policy Templates
// ============================================================================

interface PolicyTemplate {
  policyCode: string;
  policyName: string;
  description: string;
  documentType: 'journal_entry' | 'purchase_order' | 'vendor_bill' | 'customer_payment' | 'bank_deposit';
  isDefault: boolean;
  priority: number;
  conditionRules?: Array<{
    field: string;
    operator: string;
    value: unknown;
    logicalOperator?: 'AND' | 'OR';
  }>;
  steps: Array<{
    stepNumber: number;
    stepName: string;
    approvalLevel: 'same_level' | 'next_level' | 'skip_level' | 'final';
    requiredRoleIds: string[];
    requiredApprovals: number;
    escalationHours?: number;
    escalationNotifyRoleIds?: string[];
    allowSelfApproval?: boolean;
  }>;
}

// Template: Journal Entry - Low Value (< $10,000)
const jeStandardPolicy: PolicyTemplate = {
  policyCode: 'JE_STANDARD',
  policyName: 'Journal Entry - Standard',
  description: 'Standard approval for journal entries under $10,000',
  documentType: 'journal_entry',
  isDefault: true,
  priority: 10,
  conditionRules: [
    { field: 'documentAmount', operator: 'lt', value: 10000 },
  ],
  steps: [
    {
      stepNumber: 1,
      stepName: 'Manager Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-accounting-manager'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-controller'],
      allowSelfApproval: false,
    },
  ],
};

// Template: Journal Entry - High Value (>= $10,000)
const jeHighValuePolicy: PolicyTemplate = {
  policyCode: 'JE_HIGH_VALUE',
  policyName: 'Journal Entry - High Value',
  description: 'Multi-level approval for journal entries $10,000 and above',
  documentType: 'journal_entry',
  isDefault: false,
  priority: 5,
  conditionRules: [
    { field: 'documentAmount', operator: 'gte', value: 10000 },
  ],
  steps: [
    {
      stepNumber: 1,
      stepName: 'Manager Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-accounting-manager'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-controller'],
      allowSelfApproval: false,
    },
    {
      stepNumber: 2,
      stepName: 'Controller Approval',
      approvalLevel: 'next_level',
      requiredRoleIds: ['role-controller'],
      requiredApprovals: 1,
      escalationHours: 48,
      escalationNotifyRoleIds: ['role-cfo'],
      allowSelfApproval: false,
    },
  ],
};

// Template: Purchase Order - Standard
const poStandardPolicy: PolicyTemplate = {
  policyCode: 'PO_STANDARD',
  policyName: 'Purchase Order - Standard',
  description: 'Standard approval for purchase orders under $5,000',
  documentType: 'purchase_order',
  isDefault: true,
  priority: 10,
  conditionRules: [
    { field: 'documentAmount', operator: 'lt', value: 5000 },
  ],
  steps: [
    {
      stepNumber: 1,
      stepName: 'Department Manager Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-department-manager'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-purchasing-manager'],
      allowSelfApproval: false,
    },
  ],
};

// Template: Purchase Order - High Value
const poHighValuePolicy: PolicyTemplate = {
  policyCode: 'PO_HIGH_VALUE',
  policyName: 'Purchase Order - High Value',
  description: 'Multi-level approval for purchase orders $5,000 and above',
  documentType: 'purchase_order',
  isDefault: false,
  priority: 5,
  conditionRules: [
    { field: 'documentAmount', operator: 'gte', value: 5000 },
  ],
  steps: [
    {
      stepNumber: 1,
      stepName: 'Department Manager Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-department-manager'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-purchasing-manager'],
      allowSelfApproval: false,
    },
    {
      stepNumber: 2,
      stepName: 'Purchasing Manager Approval',
      approvalLevel: 'next_level',
      requiredRoleIds: ['role-purchasing-manager'],
      requiredApprovals: 1,
      escalationHours: 48,
      escalationNotifyRoleIds: ['role-cfo'],
      allowSelfApproval: false,
    },
  ],
};

// Template: Vendor Bill - Standard
const vendorBillPolicy: PolicyTemplate = {
  policyCode: 'VB_STANDARD',
  policyName: 'Vendor Bill - Standard',
  description: 'Standard approval for vendor bills with 3-way match',
  documentType: 'vendor_bill',
  isDefault: true,
  priority: 10,
  steps: [
    {
      stepNumber: 1,
      stepName: 'AP Clerk Review',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-ap-clerk'],
      requiredApprovals: 1,
      escalationHours: 24,
      escalationNotifyRoleIds: ['role-ap-manager'],
      allowSelfApproval: false,
    },
    {
      stepNumber: 2,
      stepName: 'AP Manager Approval',
      approvalLevel: 'next_level',
      requiredRoleIds: ['role-ap-manager'],
      requiredApprovals: 1,
      escalationHours: 48,
      escalationNotifyRoleIds: ['role-controller'],
      allowSelfApproval: false,
    },
  ],
};

// Template: Bank Deposit - Standard
const bankDepositPolicy: PolicyTemplate = {
  policyCode: 'BD_STANDARD',
  policyName: 'Bank Deposit - Standard',
  description: 'Standard approval for bank deposits',
  documentType: 'bank_deposit',
  isDefault: true,
  priority: 10,
  steps: [
    {
      stepNumber: 1,
      stepName: 'Treasury Approval',
      approvalLevel: 'same_level',
      requiredRoleIds: ['role-treasury'],
      requiredApprovals: 1,
      escalationHours: 8,
      escalationNotifyRoleIds: ['role-controller'],
      allowSelfApproval: false,
    },
  ],
};

// All policy templates
const policyTemplates: PolicyTemplate[] = [
  jeStandardPolicy,
  jeHighValuePolicy,
  poStandardPolicy,
  poHighValuePolicy,
  vendorBillPolicy,
  bankDepositPolicy,
];

// ============================================================================
// SoD Rule Templates
// ============================================================================

interface SodRuleTemplate {
  ruleCode: string;
  ruleName: string;
  description: string;
  conflictType: 'same_user' | 'same_role' | 'role_pair' | 'subsidiary_based';
  documentType: 'journal_entry' | 'purchase_order' | 'vendor_bill' | 'customer_payment' | 'bank_deposit';
  action1: string;
  action2: string;
  conflictingRoleIds?: string[];
  requireDifferentSubsidiary?: boolean;
  requireDifferentDepartment?: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const sodRuleTemplates: SodRuleTemplate[] = [
  // Creator cannot approve their own transactions
  {
    ruleCode: 'JE_CREATOR_APPROVER',
    ruleName: 'JE: Creator Cannot Approve',
    description: 'The user who creates a journal entry cannot approve it',
    conflictType: 'same_user',
    documentType: 'journal_entry',
    action1: 'create',
    action2: 'approve',
    severity: 'high',
  },
  {
    ruleCode: 'PO_CREATOR_APPROVER',
    ruleName: 'PO: Creator Cannot Approve',
    description: 'The user who creates a purchase order cannot approve it',
    conflictType: 'same_user',
    documentType: 'purchase_order',
    action1: 'create',
    action2: 'approve',
    severity: 'high',
  },
  {
    ruleCode: 'VB_CREATOR_POSTER',
    ruleName: 'VB: Creator Cannot Post',
    description: 'The user who creates a vendor bill cannot post it',
    conflictType: 'same_user',
    documentType: 'vendor_bill',
    action1: 'create',
    action2: 'post',
    severity: 'high',
  },

  // Role-based segregation for vendor bills
  {
    ruleCode: 'VB_AP_SEPARATION',
    ruleName: 'VB: AP Clerk/Manager Separation',
    description: 'AP Clerks and AP Managers must be different users for entry and approval',
    conflictType: 'role_pair',
    documentType: 'vendor_bill',
    action1: 'create',
    action2: 'approve',
    conflictingRoleIds: ['role-ap-clerk', 'role-ap-manager'],
    severity: 'medium',
  },

  // Submitter cannot be the final approver
  {
    ruleCode: 'JE_SUBMIT_FINAL_APPROVE',
    ruleName: 'JE: Submitter Cannot Final Approve',
    description: 'The user who submits a journal entry cannot be the final approver',
    conflictType: 'same_user',
    documentType: 'journal_entry',
    action1: 'submit',
    action2: 'approve',
    severity: 'high',
  },

  // Bank deposit dual control
  {
    ruleCode: 'BD_DUAL_CONTROL',
    ruleName: 'BD: Dual Control Required',
    description: 'Bank deposits require approval from a different user than the creator',
    conflictType: 'same_user',
    documentType: 'bank_deposit',
    action1: 'create',
    action2: 'approve',
    severity: 'critical',
  },

  // Subsidiary-based segregation for high-value transactions
  {
    ruleCode: 'JE_INTER_SUBSIDIARY',
    ruleName: 'JE: Inter-Subsidiary Review',
    description: 'Journal entries affecting multiple subsidiaries require cross-subsidiary review',
    conflictType: 'subsidiary_based',
    documentType: 'journal_entry',
    action1: 'create',
    action2: 'approve',
    requireDifferentSubsidiary: true,
    severity: 'medium',
  },
];

// ============================================================================
// Seeding Functions
// ============================================================================

async function seedApprovalPolicies(organizationId: string) {
  console.log('Seeding approval policies...');

  for (const template of policyTemplates) {
    // Check if policy already exists
    const existing = await db.select()
      .from(approvalPolicies)
      .where(
        and(
          eq(approvalPolicies.organizationId, organizationId),
          eq(approvalPolicies.policyCode, template.policyCode)
        )
      );

    if (existing.length > 0) {
      console.log(`  Policy ${template.policyCode} already exists, skipping...`);
      continue;
    }

    // Create policy
    const policyId = createId();
    await db.insert(approvalPolicies).values({
      id: policyId,
      organizationId,
      policyCode: template.policyCode,
      policyName: template.policyName,
      description: template.description,
      documentType: template.documentType,
      isActive: true,
      isDefault: template.isDefault,
      priority: template.priority,
      conditionRules: template.conditionRules || [],
    });

    console.log(`  Created policy: ${template.policyName}`);

    // Create steps
    for (const stepTemplate of template.steps) {
      await db.insert(approvalSteps).values({
        id: createId(),
        policyId,
        stepNumber: stepTemplate.stepNumber,
        stepName: stepTemplate.stepName,
        approvalLevel: stepTemplate.approvalLevel,
        requiredRoleIds: stepTemplate.requiredRoleIds,
        requiredApprovals: stepTemplate.requiredApprovals,
        escalationHours: stepTemplate.escalationHours || null,
        escalationNotifyRoleIds: stepTemplate.escalationNotifyRoleIds || [],
        allowSelfApproval: stepTemplate.allowSelfApproval ?? false,
        isActive: true,
      });
    }

    console.log(`    Created ${template.steps.length} step(s)`);
  }
}

async function seedSodRules(organizationId: string) {
  console.log('Seeding SoD policies and rules...');

  // Check if SoD policy already exists
  const existingPolicy = await db.select()
    .from(sodPolicies)
    .where(
      and(
        eq(sodPolicies.organizationId, organizationId),
        eq(sodPolicies.policyCode, 'SOD_STANDARD')
      )
    );

  let sodPolicyId: string;

  if (existingPolicy.length > 0) {
    console.log('  SoD policy already exists, adding missing rules only...');
    sodPolicyId = existingPolicy[0].id;
  } else {
    // Create SoD policy
    sodPolicyId = createId();
    await db.insert(sodPolicies).values({
      id: sodPolicyId,
      organizationId,
      policyCode: 'SOD_STANDARD',
      policyName: 'Standard SoD Policy',
      description: 'Standard Segregation of Duties policy for financial controls',
      enforcementMode: 'block', // Block violations by default
      isActive: true,
    });
    console.log('  Created SoD policy: Standard SoD Policy');
  }

  // Create rules
  for (const ruleTemplate of sodRuleTemplates) {
    // Check if rule already exists
    const existingRule = await db.select()
      .from(sodRules)
      .where(eq(sodRules.ruleCode, ruleTemplate.ruleCode));

    if (existingRule.length > 0) {
      console.log(`    Rule ${ruleTemplate.ruleCode} already exists, skipping...`);
      continue;
    }

    await db.insert(sodRules).values({
      id: createId(),
      policyId: sodPolicyId,
      ruleCode: ruleTemplate.ruleCode,
      ruleName: ruleTemplate.ruleName,
      description: ruleTemplate.description,
      conflictType: ruleTemplate.conflictType,
      documentType: ruleTemplate.documentType,
      action1: ruleTemplate.action1,
      action2: ruleTemplate.action2,
      conflictingRoleIds: ruleTemplate.conflictingRoleIds || [],
      requireDifferentSubsidiary: ruleTemplate.requireDifferentSubsidiary ?? false,
      requireDifferentDepartment: ruleTemplate.requireDifferentDepartment ?? false,
      exemptRoleIds: [],
      exemptUserIds: [],
      isActive: true,
      severity: ruleTemplate.severity,
    });

    console.log(`    Created rule: ${ruleTemplate.ruleName}`);
  }
}

async function seedApprovalTemplates(organizationId: string) {
  console.log(`\nSeeding approval templates for organization: ${organizationId}`);
  console.log('='.repeat(60));

  try {
    await seedApprovalPolicies(organizationId);
    await seedSodRules(organizationId);

    console.log('\n='.repeat(60));
    console.log('Approval templates seeded successfully!');
    console.log(`\nCreated ${policyTemplates.length} approval policies`);
    console.log(`Created ${sodRuleTemplates.length} SoD rules`);
  } catch (error) {
    console.error('Error seeding approval templates:', error);
    throw error;
  }
}

// ============================================================================
// Export for programmatic use
// ============================================================================

export {
  policyTemplates,
  sodRuleTemplates,
  seedApprovalPolicies,
  seedSodRules,
  seedApprovalTemplates,
};

// ============================================================================
// CLI execution
// ============================================================================

async function main() {
  const organizationId = process.env.ORGANIZATION_ID || 'org-default';

  console.log('Approval Policy Seed Script');
  console.log('='.repeat(60));
  console.log(`Organization ID: ${organizationId}`);
  console.log('');

  try {
    await seedApprovalTemplates(organizationId);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.$client.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
