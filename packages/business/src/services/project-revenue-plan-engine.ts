export type ProjectRecognitionMethod =
  | 'right_to_invoice'
  | 'cost_to_cost'
  | 'labor_hours'
  | 'units_delivered'
  | 'elapsed_time'
  | 'manual_output';

export interface ProjectRevenuePlanLineInput {
  id: string;
  itemId?: string | null;
  description: string;
  transactionPrice: string;
  sspAmount?: string | null;
  fallbackSspAmount?: string | null;
  revenueTiming: 'point_in_time' | 'over_time';
  recognitionMethod: ProjectRecognitionMethod;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
}

export interface ProjectRevenuePlanInput {
  projectContractId: string;
  projectContractVersionId: string;
  transactionPrice: string;
  currencyCode: string;
  contractStartDate: string;
  contractEndDate?: string | null;
  lines: ProjectRevenuePlanLineInput[];
}

export interface ProjectRevenuePlanObligation {
  lineId: string;
  itemId: string | null;
  name: string;
  revenueTiming: 'point_in_time' | 'over_time';
  recognitionMethod: ProjectRecognitionMethod;
  startDate: string;
  endDate: string;
  sspAmount: string;
  allocatedAmount: string;
  allocationPercentage: string;
  allocationMethod: 'proportional';
  schedules: Array<{
    scheduleDate: string;
    periodStartDate: string;
    periodEndDate: string;
    scheduledAmount: string;
    recognitionPattern: ProjectRecognitionMethod | 'immediate';
    status: 'scheduled' | 'deferred';
  }>;
}

export interface ProjectRevenuePlan {
  projectContractId: string;
  projectContractVersionId: string;
  currencyCode: string;
  transactionPrice: string;
  totalSsp: string;
  totalAllocated: string;
  obligations: ProjectRevenuePlanObligation[];
}

export class ProjectRevenuePlanError extends Error {
  constructor(
    public readonly code:
      | 'PROJECT_REVENUE_LINES_REQUIRED'
      | 'PROJECT_REVENUE_DATE_REQUIRED'
      | 'PROJECT_SSP_MISSING'
      | 'INVALID_PROJECT_TRANSACTION_PRICE',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectRevenuePlanError';
  }
}

function scaled(value: string, scale: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new ProjectRevenuePlanError(
      'INVALID_PROJECT_TRANSACTION_PRICE',
      `Invalid non-negative decimal amount: ${value}`,
    );
  }
  const [whole, fraction = ''] = normalized.split('.');
  const padded = `${fraction}${'0'.repeat(scale + 1)}`;
  let result = BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded.slice(0, scale));
  if (padded[scale] >= '5') result += 1n;
  return result;
}

function cents(value: string): bigint {
  return scaled(value, 2);
}

function formatCents(value: bigint): string {
  const whole = value / 100n;
  return `${whole}.${(value % 100n).toString().padStart(2, '0')}`;
}

function allocateByWeights(
  total: bigint,
  weights: bigint[],
  stableIds: string[],
): bigint[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightTotal <= 0n) {
    throw new ProjectRevenuePlanError('PROJECT_SSP_MISSING', 'Allocation weights must be positive');
  }
  const values = weights.map((weight) => (total * weight) / weightTotal);
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (total * weight) % weightTotal,
    stableId: stableIds[index],
  }));
  let remaining = total - values.reduce((sum, value) => sum + value, 0n);
  remainders.sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    return left.stableId.localeCompare(right.stableId);
  });
  for (let index = 0; remaining > 0n; index += 1) {
    values[remainders[index % remainders.length].index] += 1n;
    remaining -= 1n;
  }
  return values;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

function monthlyPeriods(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) {
    throw new ProjectRevenuePlanError(
      'PROJECT_REVENUE_DATE_REQUIRED',
      'Revenue service end date cannot precede its start date',
    );
  }
  const periods: Array<{ start: string; end: string; weight: bigint; id: string }> = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = endOfMonth(year, month);
    const periodStart = start > monthStart ? start : monthStart;
    const periodEnd = end < monthEnd ? end : monthEnd;
    const activeDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
    const monthDays = monthEnd.getUTCDate();
    periods.push({
      start: isoDate(periodStart),
      end: isoDate(periodEnd),
      weight: BigInt(Math.round((activeDays / monthDays) * 1_000_000)),
      id: isoDate(periodEnd),
    });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return periods;
}

function percentage(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return '0.000000';
  const millionths = (numerator * 100_000_000n + denominator / 2n) / denominator;
  return `${millionths / 1_000_000n}.${(millionths % 1_000_000n)
    .toString()
    .padStart(6, '0')}`;
}

/** Pure ASC 606 project-plan calculation; billing records are deliberately absent. */
export function generateProjectRevenuePlan(input: ProjectRevenuePlanInput): ProjectRevenuePlan {
  if (!input.lines.length) {
    throw new ProjectRevenuePlanError(
      'PROJECT_REVENUE_LINES_REQUIRED',
      'An approved project contract version requires at least one promised good or service',
    );
  }
  const transactionPrice = cents(input.transactionPrice);
  const singleLine = input.lines.length === 1;
  const sspWeights = input.lines.map((line) => {
    const resolved = line.sspAmount ?? line.fallbackSspAmount;
    if (resolved && scaled(resolved, 4) > 0n) return scaled(resolved, 4);
    if (singleLine) {
      const fallback = cents(line.transactionPrice) > 0n ? line.transactionPrice : input.transactionPrice;
      if (scaled(fallback, 4) > 0n) return scaled(fallback, 4);
    }
    throw new ProjectRevenuePlanError(
      'PROJECT_SSP_MISSING',
      `Standalone selling price is required for project contract line ${line.id}`,
    );
  });
  const totalSspScaled = sspWeights.reduce((sum, value) => sum + value, 0n);
  const allocations = allocateByWeights(
    transactionPrice,
    sspWeights,
    input.lines.map((line) => line.id),
  );

  const obligations = input.lines.map<ProjectRevenuePlanObligation>((line, index) => {
    const startDate = line.serviceStartDate ?? input.contractStartDate;
    const endDate = line.serviceEndDate ?? input.contractEndDate ?? startDate;
    if (!startDate || !endDate) {
      throw new ProjectRevenuePlanError(
        'PROJECT_REVENUE_DATE_REQUIRED',
        `Service dates are required for project contract line ${line.id}`,
      );
    }
    const allocation = allocations[index];
    let schedules: ProjectRevenuePlanObligation['schedules'];
    if (line.revenueTiming === 'point_in_time') {
      schedules = [
        {
          scheduleDate: endDate,
          periodStartDate: endDate,
          periodEndDate: endDate,
          scheduledAmount: formatCents(allocation),
          recognitionPattern: 'immediate',
          status: 'scheduled',
        },
      ];
    } else if (line.recognitionMethod === 'elapsed_time') {
      const periods = monthlyPeriods(startDate, endDate);
      const amounts = allocateByWeights(
        allocation,
        periods.map((period) => period.weight),
        periods.map((period) => period.id),
      );
      schedules = periods.map((period, periodIndex) => ({
        scheduleDate: period.end,
        periodStartDate: period.start,
        periodEndDate: period.end,
        scheduledAmount: formatCents(amounts[periodIndex]),
        recognitionPattern: line.recognitionMethod,
        status: 'scheduled',
      }));
    } else {
      schedules = [
        {
          scheduleDate: endDate,
          periodStartDate: startDate,
          periodEndDate: endDate,
          scheduledAmount: formatCents(allocation),
          recognitionPattern: line.recognitionMethod,
          status: 'deferred',
        },
      ];
    }
    return {
      lineId: line.id,
      itemId: line.itemId ?? null,
      name: line.description,
      revenueTiming: line.revenueTiming,
      recognitionMethod: line.recognitionMethod,
      startDate,
      endDate,
      sspAmount: formatCents((sspWeights[index] + 50n) / 100n),
      allocatedAmount: formatCents(allocation),
      allocationPercentage: percentage(sspWeights[index], totalSspScaled),
      allocationMethod: 'proportional',
      schedules,
    };
  });

  return {
    projectContractId: input.projectContractId,
    projectContractVersionId: input.projectContractVersionId,
    currencyCode: input.currencyCode,
    transactionPrice: formatCents(transactionPrice),
    totalSsp: formatCents((totalSspScaled + 50n) / 100n),
    totalAllocated: formatCents(allocations.reduce((sum, value) => sum + value, 0n)),
    obligations,
  };
}
