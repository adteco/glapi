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
