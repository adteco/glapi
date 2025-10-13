export type ObligationType = 
  | 'product_license'
  | 'maintenance_support'
  | 'professional_services'
  | 'hosting_services'
  | 'other';

export type SatisfactionMethod = 'point_in_time' | 'over_time';

export type RecognitionPattern = 
  | 'immediate'
  | 'straight_line'
  | 'usage_based'
  | 'milestone'
  | 'percentage_of_completion';

export type AllocationMethod = 
  | 'ssp_proportional'
  | 'residual'
  | 'adjusted_market'
  | 'expected_cost_plus_margin';

export type RevenueStatus = 
  | 'scheduled'
  | 'recognized'
  | 'deferred'
  | 'cancelled';

export type CalculationType = 
  | 'initial'
  | 'modification'
  | 'renewal'
  | 'termination';

export interface SSPEvidence {
  itemId: string;
  amount: number;
  evidenceType: 'standalone_sale' | 'competitor_pricing' | 'cost_plus_margin' | 'market_assessment';
  confidenceLevel: 'high' | 'medium' | 'low';
  evidenceDate: Date;
  source?: string;
}

export interface ContractTerms {
  startDate: Date;
  endDate: Date;
  paymentTerms: number; // days
  earlyTerminationClause?: boolean;
  autoRenewal?: boolean;
  renewalTermMonths?: number;
}

export interface VariableConsideration {
  type: 'discount' | 'rebate' | 'performance_bonus' | 'penalty' | 'price_concession';
  estimatedAmount: number;
  probability: number; // 0-100%
  constraintApplied: boolean;
}

export interface FinancingComponent {
  hasSignificantComponent: boolean;
  discountRate?: number;
  adjustmentAmount?: number;
  reason?: string;
}

export interface ModificationAssessment {
  isDistinct: boolean;
  reflectsStandalonePrice: boolean;
  treatmentMethod: 'separate_contract' | 'termination_new' | 'cumulative_catchup' | 'prospective';
}

export interface RevenueMetrics {
  arr: number; // Annual Recurring Revenue
  mrr: number; // Monthly Recurring Revenue
  deferredRevenue: number;
  recognizedToDate: number;
  remainingObligation: number;
}

export interface ASC606Step {
  stepNumber: 1 | 2 | 3 | 4 | 5;
  stepName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  errors?: string[];
}

export interface CalculationAudit {
  calculationId: string;
  subscriptionId: string;
  calculationType: CalculationType;
  performedAt: Date;
  performedBy: string;
  steps: ASC606Step[];
  totalDuration: number; // milliseconds
  success: boolean;
}

export interface RevenueAllocationMatrix {
  itemId: string;
  itemName: string;
  listPrice: number;
  discountAmount: number;
  netPrice: number;
  sspAmount: number;
  sspSource: string;
  allocationPercentage: number;
  allocatedRevenue: number;
  variance: number; // allocated vs net price
}

export interface RecognitionScheduleDetail {
  scheduleId: string;
  period: string; // YYYY-MM
  daysInPeriod: number;
  percentComplete: number;
  scheduledAmount: number;
  recognizedAmount: number;
  deferredAmount: number;
  adjustments: Array<{
    date: Date;
    amount: number;
    reason: string;
  }>;
}

export interface ComplianceCheck {
  rule: string;
  description: string;
  passed: boolean;
  details?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface RevenueCalculationSummary {
  subscriptionId: string;
  customerId: string;
  calculationDate: Date;
  contractValue: number;
  transactionPrice: number;
  performanceObligationCount: number;
  recognitionStartDate: Date;
  recognitionEndDate: Date;
  recognitionMethod: string;
  complianceChecks: ComplianceCheck[];
  warnings: string[];
}