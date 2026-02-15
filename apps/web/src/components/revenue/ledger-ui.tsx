'use client';

import { type ReactNode, useMemo, useState } from 'react';

const C = {
  bg: '#06090f',
  surface: '#0d1117',
  card: '#131921',
  cardHover: '#1a2130',
  border: '#1e2a3a',
  borderLight: '#2a3a52',
  text: '#e2e8f0',
  textMuted: '#8899b0',
  textDim: '#4a5a6e',
  white: '#f8fafc',
  blue: '#3b82f6',
  blueDim: '#3b82f620',
  green: '#10b981',
  greenDim: '#10b98120',
  amber: '#f59e0b',
  amberDim: '#f59e0b20',
  purple: '#a78bfa',
  purpleDim: '#a78bfa20',
  red: '#ef4444',
  redDim: '#ef444420',
} as const;

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const mono = "'JetBrains Mono', 'Fira Code', monospace";

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtK = (n: number): string => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : fmt(n));
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIODS = MONTHS.map((m) => `${m} '25`);

type ObligationType = 'point_in_time' | 'over_time';
type ObligationStatus = 'satisfied' | 'partial';

interface Obligation {
  id: string;
  name: string;
  type: ObligationType;
  ssp: number;
  allocated: number;
  recognized: number;
  deferred: number;
  color: string;
  method: string;
  status: ObligationStatus;
}

const CONTRACT = {
  id: 'ARR-2025-00142',
  customer: 'Meridian Health Systems',
  sfOrderId: 'SF-OPP-78432',
  totalValue: 486000,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  status: 'active',
  currentVersion: 3,
  obligations: [
    {
      id: 'OB-001',
      name: 'Platform License',
      type: 'point_in_time',
      ssp: 180000,
      allocated: 172800,
      recognized: 172800,
      deferred: 0,
      color: C.blue,
      method: 'Point-in-time',
      status: 'satisfied',
    },
    {
      id: 'OB-002',
      name: 'SaaS Subscription',
      type: 'over_time',
      ssp: 240000,
      allocated: 230400,
      recognized: 76800,
      deferred: 153600,
      color: C.green,
      method: 'Rateable (straight-line)',
      status: 'partial',
    },
    {
      id: 'OB-003',
      name: 'Implementation Services',
      type: 'over_time',
      ssp: 90000,
      allocated: 82800,
      recognized: 55200,
      deferred: 27600,
      color: C.amber,
      method: '% Complete (milestones)',
      status: 'partial',
    },
  ] satisfies Obligation[],
};

interface ScheduleRow extends Obligation {
  periods: number[];
}

const SCHEDULE: ScheduleRow[] = CONTRACT.obligations.map((ob) => ({
  ...ob,
  periods: PERIODS.map((_, i) => {
    if (ob.type === 'point_in_time') return i === 0 ? ob.allocated : 0;
    if (ob.id === 'OB-002') return ob.allocated / 12;
    if (ob.id === 'OB-003') {
      const profile = [0.15, 0.2, 0.25, 0.15, 0.1, 0.08, 0.04, 0.02, 0.01, 0, 0, 0];
      return ob.allocated * profile[i];
    }
    return 0;
  }),
}));

interface MutationImpactDetail {
  obligation: string;
  before: number;
  after: number;
  delta: number;
}

interface MutationImpact {
  revenueShift: number;
  periodsAffected: number;
  reallocation: boolean;
  details: MutationImpactDetail[];
  catchUp?: {
    period: string;
    amount: number;
  };
}

interface Mutation {
  version: number;
  date: string;
  type: 'created' | 'amended';
  label: string;
  description: string;
  totalValue: number;
  obligationCount: number;
  impact: MutationImpact | null;
}

const MUTATIONS: Mutation[] = [
  {
    version: 1,
    date: '2025-01-01',
    type: 'created',
    label: 'Contract Created',
    description: 'Initial 12-month agreement: Platform License + SaaS + Implementation',
    totalValue: 450000,
    obligationCount: 3,
    impact: null,
  },
  {
    version: 2,
    date: '2025-03-15',
    type: 'amended',
    label: 'Mid-Term Upsell',
    description:
      'Added 10 additional SaaS seats ($36,000 ACV). Triggered SSP reallocation across all remaining obligations.',
    totalValue: 486000,
    obligationCount: 3,
    impact: {
      revenueShift: 4200,
      periodsAffected: 9,
      reallocation: true,
      details: [
        { obligation: 'Platform License', before: 170100, after: 172800, delta: 2700 },
        { obligation: 'SaaS Subscription', before: 201600, after: 230400, delta: 28800 },
        { obligation: 'Implementation Services', before: 78300, after: 82800, delta: 4500 },
      ],
    },
  },
  {
    version: 3,
    date: '2025-04-01',
    type: 'amended',
    label: 'Milestone Acceleration',
    description:
      'Implementation Phase 2 milestone achieved early. Recognition schedule accelerated - catch-up adjustment posted.',
    totalValue: 486000,
    obligationCount: 3,
    impact: {
      revenueShift: 8280,
      periodsAffected: 6,
      reallocation: false,
      details: [{ obligation: 'Implementation Services', before: 49680, after: 57960, delta: 8280 }],
      catchUp: { period: "Apr '25", amount: 8280 },
    },
  },
];

interface PortfolioRow {
  customer: string;
  arrangements: number;
  totalCV: number;
  recognized: number;
  deferred: number;
  nextInvoice: string;
}

const PORTFOLIO: PortfolioRow[] = [
  {
    customer: 'Meridian Health',
    arrangements: 3,
    totalCV: 1240000,
    recognized: 620000,
    deferred: 620000,
    nextInvoice: '2025-05-01',
  },
  {
    customer: 'Apex Financial',
    arrangements: 1,
    totalCV: 860000,
    recognized: 287000,
    deferred: 573000,
    nextInvoice: '2025-05-01',
  },
  {
    customer: 'Coastal Dynamics',
    arrangements: 2,
    totalCV: 540000,
    recognized: 405000,
    deferred: 135000,
    nextInvoice: '2025-05-15',
  },
  {
    customer: 'NovaTech Labs',
    arrangements: 1,
    totalCV: 320000,
    recognized: 80000,
    deferred: 240000,
    nextInvoice: '2025-05-01',
  },
  {
    customer: 'Summit Retail',
    arrangements: 2,
    totalCV: 275000,
    recognized: 183000,
    deferred: 92000,
    nextInvoice: '2025-06-01',
  },
  {
    customer: 'Parkview Medical',
    arrangements: 1,
    totalCV: 190000,
    recognized: 158000,
    deferred: 32000,
    nextInvoice: '2025-05-01',
  },
];

type QueueStatus = 'ready' | 'pending_approval' | 'review';
type QueueType = 'Recognition' | 'Catch-up JE' | 'Invoice';

interface QueueItem {
  customer: string;
  arrangement: string;
  type: QueueType;
  amount: number;
  status: QueueStatus;
  obligations: number;
}

const PERIOD_CLOSE = {
  period: 'Apr 2025',
  totalToRecognize: 148200,
  totalToInvoice: 312000,
  pendingJEs: 14,
  items: [
    {
      customer: 'Meridian Health',
      arrangement: 'ARR-2025-00142',
      type: 'Recognition',
      amount: 42800,
      status: 'ready',
      obligations: 2,
    },
    {
      customer: 'Meridian Health',
      arrangement: 'ARR-2025-00142',
      type: 'Catch-up JE',
      amount: 8280,
      status: 'ready',
      obligations: 1,
    },
    {
      customer: 'Apex Financial',
      arrangement: 'ARR-2025-00089',
      type: 'Recognition',
      amount: 35800,
      status: 'ready',
      obligations: 3,
    },
    {
      customer: 'Apex Financial',
      arrangement: 'ARR-2025-00089',
      type: 'Invoice',
      amount: 71600,
      status: 'pending_approval',
      obligations: 1,
    },
    {
      customer: 'Coastal Dynamics',
      arrangement: 'ARR-2025-00201',
      type: 'Recognition',
      amount: 28400,
      status: 'ready',
      obligations: 2,
    },
    {
      customer: 'NovaTech Labs',
      arrangement: 'ARR-2025-00177',
      type: 'Recognition',
      amount: 26700,
      status: 'review',
      obligations: 1,
    },
    {
      customer: 'Summit Retail',
      arrangement: 'ARR-2025-00156',
      type: 'Recognition',
      amount: 14500,
      status: 'ready',
      obligations: 1,
    },
  ] satisfies QueueItem[],
};

const Badge = ({ children, color, bg }: { children: ReactNode; color: string; bg: string }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 700,
      color,
      background: bg,
      padding: '2px 8px',
      borderRadius: 4,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </span>
);

const StatusDot = ({ color }: { color: string }) => (
  <span
    style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      marginRight: 6,
      flexShrink: 0,
    }}
  />
);

const Stat = ({
  label,
  value,
  sub,
  color = C.white,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) => (
  <div style={{ minWidth: 120 }}>
    <div
      style={{
        fontSize: 11,
        color: C.textDim,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: mono }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const BarSegment = ({
  width,
  color,
  label,
  amount,
}: {
  width: number;
  color: string;
  label: string;
  amount: number;
}) => (
  <div
    style={{
      position: 'relative',
      width: `${width}%`,
      height: 32,
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transition: 'width 0.4s ease',
    }}
    title={`${label}: ${fmt(amount)}`}
  >
    {width > 12 && <span style={{ fontSize: 10, fontWeight: 700, color: '#000', opacity: 0.7 }}>{fmtK(amount)}</span>}
  </div>
);

const WaterfallBar = ({ periods, color, maxVal }: { periods: number[]; color: string; maxVal: number }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
    {periods.map((val, i) => {
      const h = maxVal > 0 ? (val / maxVal) * 70 : 0;
      return (
        <div
          key={`${i}-${val}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 40,
              height: Math.max(h, val > 0 ? 3 : 0),
              background: val > 0 ? color : 'transparent',
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.3s ease',
            }}
            title={`${PERIODS[i]}: ${fmt(val)}`}
          />
        </div>
      );
    })}
  </div>
);

type LedgerView = 'contract' | 'mutation' | 'portfolio' | 'close';

const views: { id: LedgerView; label: string; icon: string }[] = [
  { id: 'contract', label: 'Contract Deep-Dive', icon: 'CD' },
  { id: 'mutation', label: 'Mutation Timeline', icon: 'MT' },
  { id: 'portfolio', label: 'Portfolio Roll-Up', icon: 'PR' },
  { id: 'close', label: 'Period Close', icon: 'PC' },
];

interface LedgerUIProps {
  initialView?: LedgerView;
  showHeader?: boolean;
}

export default function LedgerUI({ initialView = 'contract', showHeader = true }: LedgerUIProps) {
  const [view, setView] = useState<LedgerView>(initialView);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [whatIfMode, setWhatIfMode] = useState(false);

  const maxPeriodVal = useMemo(() => {
    const totals = PERIODS.map((_, i) => SCHEDULE.reduce((sum, ob) => sum + ob.periods[i], 0));
    return Math.max(...totals);
  }, []);

  const currentMonth = 3;

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: font, minHeight: '100%', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {showHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${C.amber}, ${C.amber}80)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#000',
                }}
              >
                6
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>606 Ledger</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Real-time Revenue Recognition</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 3, background: C.surface, padding: 3, borderRadius: 8 }}>
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: view === v.id ? C.blue : 'transparent',
                    color: view === v.id ? C.white : C.textMuted,
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'contract' && (
          <div>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: mono, color: C.textDim }}>{CONTRACT.id}</span>
                    <Badge color="#000" bg={C.green}>
                      Active
                    </Badge>
                    <Badge color={C.amber} bg={C.amberDim}>
                      v{CONTRACT.currentVersion}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{CONTRACT.customer}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    SF Order: {CONTRACT.sfOrderId} | Jan 2025 - Dec 2025 | {CONTRACT.obligations.length} obligations
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 28 }}>
                  <Stat label="Contract Value" value={fmt(CONTRACT.totalValue)} />
                  <Stat
                    label="Recognized"
                    value={fmt(CONTRACT.obligations.reduce((s, o) => s + o.recognized, 0))}
                    color={C.green}
                    sub={pct(CONTRACT.obligations.reduce((s, o) => s + o.recognized, 0) / CONTRACT.totalValue)}
                  />
                  <Stat
                    label="Deferred"
                    value={fmt(CONTRACT.obligations.reduce((s, o) => s + o.deferred, 0))}
                    color={C.amber}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '16px 24px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: C.textDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                SSP Allocation
              </div>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                {CONTRACT.obligations.map((ob) => (
                  <BarSegment
                    key={ob.id}
                    width={(ob.allocated / CONTRACT.totalValue) * 100}
                    color={ob.color}
                    label={ob.name}
                    amount={ob.allocated}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {CONTRACT.obligations.map((ob) => (
                  <div key={ob.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <StatusDot color={ob.color} />
                    <span style={{ color: C.textMuted }}>{ob.name}</span>
                    <span style={{ fontFamily: mono, color: C.text, fontWeight: 600 }}>{fmt(ob.allocated)}</span>
                    <span style={{ color: C.textDim, fontSize: 11 }}>({pct(ob.allocated / CONTRACT.totalValue)})</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              {CONTRACT.obligations.map((ob) => (
                <div
                  key={ob.id}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    borderLeft: `3px solid ${ob.color}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{ob.name}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{ob.method}</div>
                    </div>
                    <Badge color={ob.status === 'satisfied' ? '#000' : ob.color} bg={ob.status === 'satisfied' ? ob.color : `${ob.color}20`}>
                      {ob.status}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>SSP</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: C.textMuted }}>{fmt(ob.ssp)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>Allocated</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: C.white, fontWeight: 700 }}>{fmt(ob.allocated)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>Recognized</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: C.green }}>{fmt(ob.recognized)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>Deferred</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: C.amber }}>{fmt(ob.deferred)}</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(ob.recognized / ob.allocated) * 100}%`,
                        background: ob.color,
                        borderRadius: 2,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '20px 24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: C.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                  }}
                >
                  Recognition Waterfall - 2025
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {CONTRACT.obligations.map((ob) => (
                    <div key={ob.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
                      <StatusDot color={ob.color} />
                      {ob.name}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                {SCHEDULE.map((ob) => (
                  <div key={ob.id} style={{ marginBottom: 2 }}>
                    <WaterfallBar periods={ob.periods} color={ob.color} maxVal={maxPeriodVal} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {PERIODS.map((p, i) => (
                    <div
                      key={p}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: 10,
                        color: i <= currentMonth ? C.textMuted : C.textDim,
                        fontWeight: i === currentMonth ? 700 : 400,
                      }}
                    >
                      {p}
                      {i === currentMonth && (
                        <div style={{ width: '100%', height: 2, background: C.blue, borderRadius: 1, marginTop: 3 }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {PERIODS.map((p, i) => {
                    const total = SCHEDULE.reduce((sum, ob) => sum + ob.periods[i], 0);
                    return (
                      <div
                        key={`${p}-total`}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: 10,
                          fontFamily: mono,
                          color: i <= currentMonth ? C.text : C.textDim,
                          fontWeight: 600,
                        }}
                      >
                        {total > 0 ? fmtK(total) : '--'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'mutation' && (
          <div>
            <div
              style={{
                background: `linear-gradient(135deg, ${C.amberDim}, ${C.blueDim})`,
                border: `1px solid ${C.amber}30`,
                borderRadius: 12,
                padding: '16px 24px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>Instant Mutation Impact</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Every contract change recalculates in real-time. No batch jobs. No waiting for overnight ARM recalc.
                  Click any version to see the full before/after impact.
                </div>
              </div>
              <button
                onClick={() => setWhatIfMode(!whatIfMode)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${whatIfMode ? C.purple : C.borderLight}`,
                  background: whatIfMode ? C.purpleDim : 'transparent',
                  color: whatIfMode ? C.purple : C.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {whatIfMode ? 'What-If Mode ON' : 'What-If Mode'}
              </button>
            </div>

            {whatIfMode && (
              <div
                style={{
                  background: C.purpleDim,
                  border: `1px solid ${C.purple}30`,
                  borderRadius: 12,
                  padding: '16px 24px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 8 }}>What-If Scenario Builder</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                  Model a potential change and see the full revenue impact before committing. Nothing posts until approved.
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {['Add 5 SaaS seats ($18k)', 'Cancel Implementation', 'Extend term 6 months', 'Apply 10% discount'].map(
                    (scenario) => (
                      <button
                        key={scenario}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: `1px solid ${C.purple}40`,
                          background: C.card,
                          color: C.textMuted,
                          fontSize: 11,
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {scenario}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            <div style={{ position: 'relative', paddingLeft: 24 }}>
              <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: C.border }} />

              {MUTATIONS.map((m) => {
                const isSelected = selectedVersion === m.version;
                const typeColor = m.type === 'created' ? C.green : C.amber;
                return (
                  <div key={m.version} style={{ marginBottom: 20, position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: -18,
                        top: 6,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: typeColor,
                        border: `3px solid ${C.bg}`,
                        zIndex: 1,
                      }}
                    />

                    <div
                      onClick={() => setSelectedVersion(isSelected ? null : m.version)}
                      style={{
                        background: isSelected ? C.cardHover : C.surface,
                        border: `1px solid ${isSelected ? `${typeColor}60` : C.border}`,
                        borderRadius: 12,
                        padding: '16px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge color={typeColor === C.green ? '#000' : typeColor} bg={typeColor === C.green ? typeColor : `${typeColor}20`}>
                            {m.type}
                          </Badge>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{m.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, fontFamily: mono, color: C.textDim }}>{m.date}</span>
                          <span style={{ fontSize: 11, fontFamily: mono, color: C.textDim }}>v{m.version}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>{m.description}</div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                        <span style={{ color: C.textDim }}>
                          Contract Value: <span style={{ color: C.text, fontFamily: mono, fontWeight: 600 }}>{fmt(m.totalValue)}</span>
                        </span>
                        <span style={{ color: C.textDim }}>
                          Obligations: <span style={{ color: C.text, fontWeight: 600 }}>{m.obligationCount}</span>
                        </span>
                        {m.impact && (
                          <span style={{ color: C.textDim }}>
                            Revenue Shift:{' '}
                            <span
                              style={{
                                color: m.impact.revenueShift > 0 ? C.green : C.red,
                                fontFamily: mono,
                                fontWeight: 600,
                              }}
                            >
                              {m.impact.revenueShift > 0 ? '+' : ''}
                              {fmt(m.impact.revenueShift)}
                            </span>
                          </span>
                        )}
                      </div>

                      {isSelected && m.impact && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: C.textDim,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              fontWeight: 600,
                              marginBottom: 12,
                            }}
                          >
                            Allocation Impact - Before vs After
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {m.impact.details.map((d) => (
                              <div key={d.obligation} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 180, fontSize: 12, color: C.textMuted }}>{d.obligation}</div>
                                <div style={{ fontFamily: mono, fontSize: 12, color: C.textDim, width: 80, textAlign: 'right' }}>
                                  {fmt(d.before)}
                                </div>
                                <div style={{ color: C.textDim, fontSize: 12 }}>{'->'}</div>
                                <div
                                  style={{
                                    fontFamily: mono,
                                    fontSize: 12,
                                    color: C.white,
                                    fontWeight: 600,
                                    width: 80,
                                    textAlign: 'right',
                                  }}
                                >
                                  {fmt(d.after)}
                                </div>
                                <div
                                  style={{
                                    fontFamily: mono,
                                    fontSize: 12,
                                    color: d.delta > 0 ? C.green : d.delta < 0 ? C.red : C.textDim,
                                    width: 70,
                                    textAlign: 'right',
                                  }}
                                >
                                  {d.delta > 0 ? '+' : ''}
                                  {fmt(d.delta)}
                                </div>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 6,
                                    background: C.border,
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                    maxWidth: 120,
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.min((Math.abs(d.delta) / d.after) * 100 * 3, 100)}%`,
                                      background: d.delta > 0 ? C.green : C.red,
                                      borderRadius: 3,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {m.impact.catchUp && (
                            <div
                              style={{
                                marginTop: 12,
                                padding: '10px 14px',
                                background: C.amberDim,
                                border: `1px solid ${C.amber}30`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            >
                              <span style={{ fontWeight: 700, color: C.amber }}>Catch-Up Adjustment:</span>{' '}
                              <span style={{ color: C.textMuted }}>
                                {fmt(m.impact.catchUp.amount)} recognized in {m.impact.catchUp.period} to reflect cumulative
                                change
                              </span>
                            </div>
                          )}
                          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: C.textDim }}>
                            <span>
                              Calculated in <span style={{ color: C.green, fontWeight: 700 }}>47ms</span>
                            </span>
                            <span>{m.impact.periodsAffected} periods affected</span>
                            {m.impact.reallocation && <span>SSP reallocation triggered</span>}
                            <span>Ready to post</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '20px 24px',
                marginTop: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 10 }}>Why This Matters vs. ARM</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '12px 16px', background: C.redDim, border: `1px solid ${C.red}20`, borderRadius: 8 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.red,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Legacy ARM
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    Amendments trigger manual re-arrangement and delayed batch recalculation. Catch-up adjustments require
                    review and close windows can block changes.
                  </div>
                </div>
                <div
                  style={{ padding: '12px 16px', background: C.greenDim, border: `1px solid ${C.green}20`, borderRadius: 8 }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.green,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    606 Ledger
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    Amendment impact is visible instantly, catch-up entries are generated automatically, and what-if scenarios
                    can be modeled before posting.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'portfolio' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                {
                  label: 'Total Contract Value',
                  value: fmt(PORTFOLIO.reduce((s, p) => s + p.totalCV, 0)),
                  color: C.white,
                },
                {
                  label: 'Total Recognized',
                  value: fmt(PORTFOLIO.reduce((s, p) => s + p.recognized, 0)),
                  color: C.green,
                  sub: pct(
                    PORTFOLIO.reduce((s, p) => s + p.recognized, 0) /
                      PORTFOLIO.reduce((s, p) => s + p.totalCV, 0)
                  ),
                },
                { label: 'Total Deferred', value: fmt(PORTFOLIO.reduce((s, p) => s + p.deferred, 0)), color: C.amber },
                {
                  label: 'Active Arrangements',
                  value: String(PORTFOLIO.reduce((s, p) => s + p.arrangements, 0)),
                  color: C.blue,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    flex: 1,
                    minWidth: 160,
                  }}
                >
                  <Stat label={s.label} value={s.value} color={s.color} sub={s.sub} />
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>All Arrangements</div>
                <div style={{ fontSize: 11, color: C.textDim }}>
                  {PORTFOLIO.length} customers | {PORTFOLIO.reduce((s, p) => s + p.arrangements, 0)} arrangements
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.7fr 1.2fr 1.2fr 1.2fr 1.5fr 1fr',
                  padding: '10px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10,
                  color: C.textDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                <div>Customer</div>
                <div style={{ textAlign: 'center' }}>Arr.</div>
                <div style={{ textAlign: 'right' }}>Contract Value</div>
                <div style={{ textAlign: 'right' }}>Recognized</div>
                <div style={{ textAlign: 'right' }}>Deferred</div>
                <div style={{ textAlign: 'center' }}>Progress</div>
                <div style={{ textAlign: 'right' }}>Next Invoice</div>
              </div>

              {PORTFOLIO.map((row) => {
                const pctRecognized = row.recognized / row.totalCV;
                return (
                  <div
                    key={row.customer}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 0.7fr 1.2fr 1.2fr 1.2fr 1.5fr 1fr',
                      padding: '12px 20px',
                      borderBottom: `1px solid ${C.border}`,
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{row.customer}</div>
                    <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted }}>{row.arrangements}</div>
                    <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: C.text }}>{fmt(row.totalCV)}</div>
                    <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: C.green }}>
                      {fmt(row.recognized)}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: C.amber }}>
                      {fmt(row.deferred)}
                    </div>
                    <div style={{ padding: '0 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pctRecognized * 100}%`,
                              background: `linear-gradient(90deg, ${C.green}, ${C.blue})`,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: mono, color: C.textMuted, minWidth: 36 }}>
                          {pct(pctRecognized)}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, fontFamily: mono, color: C.textDim }}>{row.nextInvoice}</div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '20px 24px',
                marginTop: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: C.textDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                Portfolio Revenue by Period - 2025
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                {PERIODS.map((p, i) => {
                  const recognized = 85000 + Math.sin(i * 0.5) * 30000 + i * 8000;
                  const deferred = 180000 - i * 14000;
                  const maxH = 300000;
                  const recH = (recognized / maxH) * 120;
                  const defH = (Math.max(deferred, 0) / maxH) * 120;
                  return (
                    <div
                      key={p}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                    >
                      <div
                        style={{
                          width: '80%',
                          maxWidth: 50,
                          height: defH,
                          background: C.amberDim,
                          border: `1px solid ${C.amber}30`,
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <div
                        style={{
                          width: '80%',
                          maxWidth: 50,
                          height: recH,
                          background: i <= currentMonth ? C.green : `${C.green}40`,
                          borderRadius: '0 0 4px 4px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {PERIODS.map((p, i) => (
                  <div
                    key={`${p}-label`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 10,
                      color: i === currentMonth ? C.text : C.textDim,
                      fontWeight: i === currentMonth ? 700 : 400,
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted }}>
                  <StatusDot color={C.green} />Recognized
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted }}>
                  <StatusDot color={C.amber} />Deferred
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'close' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Period', value: PERIOD_CLOSE.period, color: C.white },
                { label: 'Revenue to Recognize', value: fmt(PERIOD_CLOSE.totalToRecognize), color: C.green },
                { label: 'Invoices to Post', value: fmt(PERIOD_CLOSE.totalToInvoice), color: C.blue },
                { label: 'Pending JEs', value: String(PERIOD_CLOSE.pendingJEs), color: C.amber },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    flex: 1,
                    minWidth: 160,
                  }}
                >
                  <Stat label={s.label} value={s.value} color={s.color} />
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
                  Posting Queue - {PERIOD_CLOSE.period}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: `1px solid ${C.green}40`,
                      background: C.greenDim,
                      color: C.green,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Post All Ready
                  </button>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.textMuted,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Export Review
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.2fr 1fr 1fr 0.8fr 0.8fr',
                  padding: '10px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10,
                  color: C.textDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                <div>Customer</div>
                <div>Arrangement</div>
                <div>Type</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
                <div style={{ textAlign: 'center' }}>Obligations</div>
                <div style={{ textAlign: 'center' }}>Status</div>
              </div>

              {PERIOD_CLOSE.items.map((item) => {
                const statusMap: Record<QueueStatus, { color: string; bg: string; label: string }> = {
                  ready: { color: C.green, bg: C.greenDim, label: 'Ready' },
                  pending_approval: { color: C.amber, bg: C.amberDim, label: 'Pending' },
                  review: { color: C.purple, bg: C.purpleDim, label: 'Review' },
                };
                const st = statusMap[item.status];
                const typeColorMap: Record<QueueType, string> = {
                  Recognition: C.green,
                  'Catch-up JE': C.amber,
                  Invoice: C.blue,
                };

                return (
                  <div
                    key={`${item.arrangement}-${item.type}-${item.amount}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1.2fr 1fr 1fr 0.8fr 0.8fr',
                      padding: '12px 20px',
                      borderBottom: `1px solid ${C.border}`,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{item.customer}</div>
                    <div style={{ fontSize: 11, fontFamily: mono, color: C.textDim }}>{item.arrangement}</div>
                    <div>
                      <Badge color={typeColorMap[item.type]} bg={`${typeColorMap[item.type]}20`}>
                        {item.type}
                      </Badge>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 13, color: C.white, fontWeight: 600 }}>
                      {fmt(item.amount)}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted }}>{item.obligations}</div>
                    <div style={{ textAlign: 'center' }}>
                      <Badge color={st.color} bg={st.bg}>
                        {st.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '20px 24px',
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 14 }}>Period Close Checklist</div>
              {[
                { label: 'All arrangements calculated for period', done: true },
                { label: 'Mutation catch-up JEs generated', done: true },
                { label: 'SSP allocation variances reviewed', done: true },
                { label: 'Recognition amounts approved by controller', done: false },
                { label: 'JEs posted to accounting system', done: false },
                { label: 'Deferred revenue reconciliation complete', done: false },
                { label: 'Period locked in 606 Ledger', done: false },
              ].map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: i < 6 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: `2px solid ${item.done ? C.green : C.border}`,
                      background: item.done ? C.greenDim : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: C.green,
                    }}
                  >
                    {item.done && 'OK'}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: item.done ? C.textMuted : C.text,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
