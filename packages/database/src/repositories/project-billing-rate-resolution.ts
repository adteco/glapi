import type { ProjectBillingRate } from '../db/schema/project-contracts';

export interface BillingRateResolutionContext {
  serviceDate: string;
  entityId?: string;
  roleKey?: string;
  projectTaskId?: string;
  itemId?: string;
  projectCostCodeId?: string;
}

const RATE_SCOPE_SPECIFICITY: Record<ProjectBillingRate['rateScope'], number> = {
  person: 600,
  role: 500,
  task: 400,
  item: 300,
  cost_code: 200,
  default: 100,
};

function isRateEffective(rate: ProjectBillingRate, serviceDate: string): boolean {
  return (
    rate.effectiveStartDate <= serviceDate &&
    (rate.effectiveEndDate === null || rate.effectiveEndDate >= serviceDate)
  );
}

function rateMatchesContext(
  rate: ProjectBillingRate,
  context: BillingRateResolutionContext,
): boolean {
  switch (rate.rateScope) {
    case 'person':
      return !!context.entityId && rate.entityId === context.entityId;
    case 'role':
      return !!context.roleKey && rate.roleKey === context.roleKey;
    case 'task':
      return !!context.projectTaskId && rate.projectTaskId === context.projectTaskId;
    case 'item':
      return !!context.itemId && rate.itemId === context.itemId;
    case 'cost_code':
      return !!context.projectCostCodeId && rate.projectCostCodeId === context.projectCostCodeId;
    case 'default':
      return true;
  }
}

/**
 * Deterministically select a rate from already tenant/rule-scoped candidates.
 * Scope specificity wins, then explicit priority, effective date, and stable id.
 */
export function selectEffectiveBillingRate(
  rates: ProjectBillingRate[],
  context: BillingRateResolutionContext,
): ProjectBillingRate | null {
  return (
    rates
      .filter((rate) => isRateEffective(rate, context.serviceDate))
      .filter((rate) => rateMatchesContext(rate, context))
      .sort((left, right) => {
        const specificity =
          RATE_SCOPE_SPECIFICITY[right.rateScope] - RATE_SCOPE_SPECIFICITY[left.rateScope];
        if (specificity !== 0) return specificity;
        if (right.priority !== left.priority) return right.priority - left.priority;
        const effectiveDate = right.effectiveStartDate.localeCompare(left.effectiveStartDate);
        if (effectiveDate !== 0) return effectiveDate;
        return left.id.localeCompare(right.id);
      })[0] ?? null
  );
}
