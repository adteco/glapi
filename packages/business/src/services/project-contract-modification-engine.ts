export type ProjectModificationMethod =
  | 'prospective'
  | 'cumulative_catch_up'
  | 'separate_contract';

export interface ProjectModificationCalculationInput {
  method: ProjectModificationMethod;
  priorAllocatedAmount: string;
  revisedAllocatedAmount: string;
  priorRecognizedAmount: string;
  progressPercentage?: string;
}

export interface ProjectModificationCalculation {
  method: ProjectModificationMethod;
  priorAllocatedAmount: string;
  revisedAllocatedAmount: string;
  priorRecognizedAmount: string;
  revisedCumulativeRevenue: string;
  catchUpAdjustment: string;
  remainingAllocation: string;
  supersedeUnrecognizedSchedules: boolean;
}

export interface ProjectModificationFutureSchedule {
  scheduleDate: string;
  scheduledAmount: string;
}

export interface ProjectModificationPlan<TSchedule extends ProjectModificationFutureSchedule> {
  obligations: Array<{
    schedules: TSchedule[];
  }>;
}

export class ProjectModificationCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectModificationCalculationError';
  }
}

function scaled(value: string, scale: number): bigint {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new ProjectModificationCalculationError(`Invalid decimal amount: ${value}`);
  }
  const negative = value.startsWith('-');
  const normalized = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = normalized.split('.');
  const padded = `${fraction}${'0'.repeat(scale + 1)}`;
  let result = BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded.slice(0, scale));
  if (padded[scale] >= '5') result += 1n;
  return negative ? -result : result;
}

function money(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n)
    .toString()
    .padStart(2, '0')}`;
}

function allocateCents(total: bigint, weights: bigint[]): bigint[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightTotal <= 0n) {
    throw new ProjectModificationCalculationError(
      'A revised plan requires at least one positive future schedule',
    );
  }
  const allocations = weights.map((weight) => (total * weight) / weightTotal);
  let remainder = total - allocations.reduce((sum, amount) => sum + amount, 0n);
  for (let index = 0; remainder > 0n; index = (index + 1) % allocations.length) {
    if (weights[index] > 0n) {
      allocations[index] += 1n;
      remainder -= 1n;
    }
  }
  return allocations;
}

export function calculateProjectContractModification(
  input: ProjectModificationCalculationInput,
): ProjectModificationCalculation {
  const priorAllocated = scaled(input.priorAllocatedAmount, 2);
  const revisedAllocated = scaled(input.revisedAllocatedAmount, 2);
  const priorRecognized = scaled(input.priorRecognizedAmount, 2);
  if (priorAllocated < 0n || revisedAllocated < 0n || priorRecognized < 0n) {
    throw new ProjectModificationCalculationError('Contract modification amounts cannot be negative');
  }
  let revisedCumulative = priorRecognized;
  let catchUp = 0n;
  if (input.method === 'cumulative_catch_up') {
    if (input.progressPercentage === undefined) {
      throw new ProjectModificationCalculationError(
        'Cumulative catch-up modifications require a progress percentage',
      );
    }
    const progress = scaled(input.progressPercentage, 6);
    if (progress < 0n || progress > 100_000_000n) {
      throw new ProjectModificationCalculationError('Progress percentage must be between 0 and 100');
    }
    revisedCumulative = (revisedAllocated * progress + 50_000_000n) / 100_000_000n;
    catchUp = revisedCumulative - priorRecognized;
  }
  const remaining = revisedAllocated - revisedCumulative;
  if (remaining < 0n) {
    throw new ProjectModificationCalculationError(
      'Revised allocation cannot be less than cumulative recognized revenue',
    );
  }
  return {
    method: input.method,
    priorAllocatedAmount: money(priorAllocated),
    revisedAllocatedAmount: money(revisedAllocated),
    priorRecognizedAmount: money(priorRecognized),
    revisedCumulativeRevenue: money(revisedCumulative),
    catchUpAdjustment: money(catchUp),
    remainingAllocation: money(remaining),
    supersedeUnrecognizedSchedules: input.method !== 'separate_contract',
  };
}

/** Recasts only future schedules to the unrecognized revised allocation. */
export function recastProjectModificationSchedules<
  TSchedule extends ProjectModificationFutureSchedule,
  TPlan extends ProjectModificationPlan<TSchedule>,
>(plan: TPlan, calculation: ProjectModificationCalculation, effectiveDate: string): TPlan {
  if (!calculation.supersedeUnrecognizedSchedules) return plan;
  const positions: Array<{ obligationIndex: number; scheduleIndex: number; weight: bigint }> = [];
  plan.obligations.forEach((obligation, obligationIndex) => {
    obligation.schedules.forEach((schedule, scheduleIndex) => {
      if (schedule.scheduleDate >= effectiveDate) {
        positions.push({
          obligationIndex,
          scheduleIndex,
          weight: scaled(schedule.scheduledAmount, 2),
        });
      }
    });
  });
  const allocated = allocateCents(
    scaled(calculation.remainingAllocation, 2),
    positions.map((position) => position.weight),
  );
  const amountByPosition = new Map(
    positions.map((position, index) => [
      `${position.obligationIndex}:${position.scheduleIndex}`,
      allocated[index],
    ]),
  );
  return {
    ...plan,
    obligations: plan.obligations.map((obligation, obligationIndex) => ({
      ...obligation,
      schedules: obligation.schedules.flatMap((schedule, scheduleIndex) => {
        const amount = amountByPosition.get(`${obligationIndex}:${scheduleIndex}`);
        if (amount === undefined || amount === 0n) return [];
        return [{ ...schedule, scheduledAmount: money(amount) }];
      }),
    })),
  } as TPlan;
}
