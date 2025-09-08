export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export interface ARRCalculation {
  totalARR: number;
  newARR: number;
  expansionARR: number;
  contractionARR: number;
  churnARR: number;
  netARRGrowth: number;
  arrByCustomer: CustomerARR[];
  arrByProduct: ProductARR[];
}

export interface CustomerARR {
  entityId: string;
  customerName: string;
  arr: number;
  subscriptionCount: number;
}

export interface ProductARR {
  itemId: string;
  productName: string;
  arr: number;
  subscriptionCount: number;
}

export interface MRRCalculation {
  totalMRR: number;
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnMRR: number;
  netMRRGrowth: number;
  mrrCohorts: MRRCohort[];
}

export interface MRRCohort {
  cohortMonth: Date;
  monthsSinceStart: number;
  customersCount: number;
  mrr: number;
  retentionRate: number;
}

export interface DeferredBalanceReport {
  totalDeferred: number;
  currentPortion: number; // Due within 12 months
  longTermPortion: number; // Due after 12 months
  deferredByCustomer: CustomerDeferred[];
  agingBuckets: DeferredAging[];
  expectedRecognitionSchedule: ExpectedRecognition[];
}

export interface CustomerDeferred {
  entityId: string;
  customerName: string;
  deferredAmount: number;
  scheduleCount: number;
}

export interface DeferredAging {
  period: string;
  amount: number;
}

export interface ExpectedRecognition {
  period: Date;
  amount: number;
}

export interface RevenueWaterfallReport {
  period: { startDate: Date; endDate: Date };
  waterfall: RevenueWaterfallComponent[];
  totalRecognizedRevenue: number;
  asc605Comparison?: ASC605Comparison;
  keyMetrics: {
    recognitionRate: number;
    averageDaysToRecognition: number;
  };
}

export interface RevenueWaterfallComponent {
  component: string;
  amount: number;
  type: 'opening' | 'addition' | 'subtraction' | 'adjustment' | 'closing';
}

export interface ASC605Comparison {
  asc605Revenue: number;
  asc606Revenue: number;
  difference: number;
  percentageDifference: number;
}

export interface ASC605vs606Comparison {
  subscriptionId: string;
  comparisonDate: Date;
  asc605: {
    totalRecognized: number;
    recognitionPattern: string;
    keyAssumptions: string[];
  };
  asc606: {
    totalRecognized: number;
    recognitionPattern: string;
    keyAssumptions: string[];
  };
  variance: {
    amount: number;
    percentage: number;
    explanation: string[];
  };
  impactAnalysis: any;
}

export interface RevenueSummaryInput {
  startDate: Date | string;
  endDate: Date | string;
  groupBy?: 'month' | 'quarter' | 'year';
  entityId?: string;
}

export interface RevenueSummaryResult {
  startDate: Date;
  endDate: Date;
  groupBy: 'month' | 'quarter' | 'year';
  recognized: number;
  deferred: number;
  scheduled: number;
  periods: Array<{
    period: string;
    recognized: number;
    deferred: number;
    scheduled: number;
  }>;
}

export interface RevenueWaterfallInput {
  startDate: Date | string;
  endDate: Date | string;
  compareToASC605?: boolean;
}

export interface SubscriptionARR {
  subscriptionId: string;
  annualValue: number;
  itemBreakdown: ItemARR[];
}

export interface ItemARR {
  itemId: string;
  annualValue: number;
}

export interface ValidationResult {
  isReady: boolean;
  errors: string[];
  warnings: string[];
}