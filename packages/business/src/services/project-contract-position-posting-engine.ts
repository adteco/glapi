export type ProjectPostingAccountRole =
  | 'accounts_receivable'
  | 'contract_asset'
  | 'contract_liability'
  | 'revenue';

export interface ProjectContractPositionState {
  cumulativeRecognized: string;
  cumulativeBilled: string;
}

export interface ProjectContractPositionEvent {
  kind: 'revenue_recognition' | 'billing';
  amount: string;
}

export interface ProjectContractPostingLine {
  accountRole: ProjectPostingAccountRole;
  debitAmount: string;
  creditAmount: string;
}

export interface ProjectContractPositionPosting {
  event: ProjectContractPositionEvent;
  prior: ProjectContractPositionState & {
    contractAsset: string;
    contractLiability: string;
  };
  next: ProjectContractPositionState & {
    contractAsset: string;
    contractLiability: string;
  };
  lines: ProjectContractPostingLine[];
  totalDebits: string;
  totalCredits: string;
}

export class ProjectContractPositionPostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectContractPositionPostingError';
  }
}

function cents(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new ProjectContractPositionPostingError(`Invalid non-negative currency amount: ${value}`);
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function signedCents(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
    throw new ProjectContractPositionPostingError(`Invalid currency adjustment: ${value}`);
  }
  const negative = value.startsWith('-');
  const absolute = negative ? value.slice(1) : value;
  const amount = cents(absolute);
  return negative ? -amount : amount;
}

function money(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function position(recognized: bigint, billed: bigint) {
  const net = recognized - billed;
  return {
    contractAsset: money(net > 0n ? net : 0n),
    contractLiability: money(net < 0n ? -net : 0n),
  };
}

function line(
  accountRole: ProjectPostingAccountRole,
  debit: bigint,
  credit: bigint,
): ProjectContractPostingLine {
  return { accountRole, debitAmount: money(debit), creditAmount: money(credit) };
}

/**
 * Calculates the balanced posting delta for one contract unit of account.
 * It never presents a contract asset and liability simultaneously.
 */
export function calculateProjectContractPositionPosting(
  state: ProjectContractPositionState,
  event: ProjectContractPositionEvent,
): ProjectContractPositionPosting {
  const priorRecognized = cents(state.cumulativeRecognized);
  const priorBilled = cents(state.cumulativeBilled);
  const amount = cents(event.amount);
  if (amount <= 0n) {
    throw new ProjectContractPositionPostingError('Posting amount must be greater than zero');
  }
  const priorNet = priorRecognized - priorBilled;
  const lines: ProjectContractPostingLine[] = [];
  let nextRecognized = priorRecognized;
  let nextBilled = priorBilled;

  if (event.kind === 'revenue_recognition') {
    const liabilityConsumed = priorNet < 0n ? (amount < -priorNet ? amount : -priorNet) : 0n;
    const assetCreated = amount - liabilityConsumed;
    if (liabilityConsumed) lines.push(line('contract_liability', liabilityConsumed, 0n));
    if (assetCreated) lines.push(line('contract_asset', assetCreated, 0n));
    lines.push(line('revenue', 0n, amount));
    nextRecognized += amount;
  } else {
    const assetConsumed = priorNet > 0n ? (amount < priorNet ? amount : priorNet) : 0n;
    const liabilityCreated = amount - assetConsumed;
    lines.push(line('accounts_receivable', amount, 0n));
    if (assetConsumed) lines.push(line('contract_asset', 0n, assetConsumed));
    if (liabilityCreated) lines.push(line('contract_liability', 0n, liabilityCreated));
    nextBilled += amount;
  }

  const totalDebits = lines.reduce((sum, row) => sum + cents(row.debitAmount), 0n);
  const totalCredits = lines.reduce((sum, row) => sum + cents(row.creditAmount), 0n);
  if (totalDebits !== totalCredits) {
    throw new ProjectContractPositionPostingError('Generated project posting is not balanced');
  }
  return {
    event,
    prior: {
      cumulativeRecognized: money(priorRecognized),
      cumulativeBilled: money(priorBilled),
      ...position(priorRecognized, priorBilled),
    },
    next: {
      cumulativeRecognized: money(nextRecognized),
      cumulativeBilled: money(nextBilled),
      ...position(nextRecognized, nextBilled),
    },
    lines,
    totalDebits: money(totalDebits),
    totalCredits: money(totalCredits),
  };
}

/** Balanced signed catch-up posting that moves the net contract position from prior R-B to revised R-B. */
export function calculateProjectContractRevenueAdjustment(
  state: ProjectContractPositionState,
  adjustmentAmount: string,
): ProjectContractPositionPosting {
  const priorRecognized = cents(state.cumulativeRecognized);
  const billed = cents(state.cumulativeBilled);
  const adjustment = signedCents(adjustmentAmount);
  if (adjustment === 0n || priorRecognized + adjustment < 0n) {
    throw new ProjectContractPositionPostingError(
      'Revenue adjustment must be non-zero and cannot reduce cumulative revenue below zero',
    );
  }
  const nextRecognized = priorRecognized + adjustment;
  const priorPosition = position(priorRecognized, billed);
  const nextPosition = position(nextRecognized, billed);
  const priorAsset = cents(priorPosition.contractAsset);
  const nextAsset = cents(nextPosition.contractAsset);
  const priorLiability = cents(priorPosition.contractLiability);
  const nextLiability = cents(nextPosition.contractLiability);
  const lines: ProjectContractPostingLine[] = [];
  if (nextAsset > priorAsset) lines.push(line('contract_asset', nextAsset - priorAsset, 0n));
  if (nextAsset < priorAsset) lines.push(line('contract_asset', 0n, priorAsset - nextAsset));
  if (nextLiability > priorLiability) lines.push(line('contract_liability', 0n, nextLiability - priorLiability));
  if (nextLiability < priorLiability) lines.push(line('contract_liability', priorLiability - nextLiability, 0n));
  if (adjustment > 0n) lines.push(line('revenue', 0n, adjustment));
  else lines.push(line('revenue', -adjustment, 0n));
  const totalDebits = lines.reduce((sum, row) => sum + cents(row.debitAmount), 0n);
  const totalCredits = lines.reduce((sum, row) => sum + cents(row.creditAmount), 0n);
  if (totalDebits !== totalCredits) {
    throw new ProjectContractPositionPostingError('Generated revenue adjustment is not balanced');
  }
  return {
    event: { kind: 'revenue_recognition', amount: money(adjustment < 0n ? -adjustment : adjustment) },
    prior: { cumulativeRecognized: money(priorRecognized), cumulativeBilled: money(billed), ...priorPosition },
    next: { cumulativeRecognized: money(nextRecognized), cumulativeBilled: money(billed), ...nextPosition },
    lines,
    totalDebits: money(totalDebits),
    totalCredits: money(totalCredits),
  };
}
