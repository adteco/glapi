'use client';

import { useState } from 'react';

const COLORS = {
  bg: '#0a0e17',
  surface: '#111827',
  border: '#2a3a52',
  borderActive: '#3b82f6',
  text: '#e2e8f0',
  textMuted: '#8899b0',
  textDim: '#5a6a80',
  salesforce: '#00a1e0',
  salesforceBg: '#00a1e015',
  engine: '#f59e0b',
  engineBg: '#f59e0b12',
  netsuite: '#10b981',
  netsuiteBg: '#10b98112',
  audit: '#a78bfa',
  auditBg: '#a78bfa10',
  danger: '#ef4444',
  white: '#ffffff',
} as const;

type ArchitectureTab = 'flow' | 'data' | 'changes' | 'audit';

const tabs: { id: ArchitectureTab; label: string }[] = [
  { id: 'flow', label: 'System Flow' },
  { id: 'data', label: 'Data Requirements' },
  { id: 'changes', label: 'Changes & Cancellations' },
  { id: 'audit', label: 'Audit Trail' },
];

const Section = ({
  title,
  color,
  bg,
  children,
  icon,
}: {
  title: string;
  color: string;
  bg: string;
  children: React.ReactNode;
  icon: string;
}) => (
  <div
    style={{
      background: bg,
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: '20px 24px',
      flex: 1,
      minWidth: 280,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const DataField = ({
  label,
  required,
  note,
}: {
  label: string;
  required?: boolean;
  note?: string;
}) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <code
        style={{
          fontSize: 12,
          color: COLORS.text,
          background: '#ffffff08',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {label}
      </code>
      {required && (
        <span
          style={{
            fontSize: 9,
            color: COLORS.danger,
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          REQ
        </span>
      )}
    </div>
    {note && (
      <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2, paddingLeft: 8 }}>{note}</div>
    )}
  </div>
);

const FlowArrow = ({
  label,
  sublabel,
  color = COLORS.textMuted,
}: {
  label: string;
  sublabel?: string;
  color?: string;
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 60,
      padding: '0 4px',
    }}
  >
    <div
      style={{
        fontSize: 10,
        color,
        fontWeight: 600,
        textAlign: 'center',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </div>
    <div style={{ width: 40, height: 2, background: `linear-gradient(90deg, ${color}60, ${color})`, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          right: -4,
          top: -3,
          width: 0,
          height: 0,
          borderLeft: `6px solid ${color}`,
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
        }}
      />
    </div>
    {sublabel && (
      <div style={{ fontSize: 9, color: COLORS.textDim, textAlign: 'center', marginTop: 4, maxWidth: 80 }}>{sublabel}</div>
    )}
  </div>
);

interface RevenueArchitectureProps {
  initialTab?: ArchitectureTab;
}

export default function RevenueArchitecture({ initialTab = 'flow' }: RevenueArchitectureProps) {
  const [activeTab, setActiveTab] = useState<ArchitectureTab>(initialTab);

  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'DM Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        minHeight: '100%',
        padding: '32px 28px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              color: COLORS.textDim,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Architecture Proposal
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: COLORS.white, lineHeight: 1.2 }}>
            ASC-606 Revenue Recognition Pipeline
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: COLORS.textMuted, lineHeight: 1.5, maxWidth: 780 }}>
            Salesforce (source of truth) -&gt; 606 Ledger (obligation calculation and invoice scheduling) -&gt; NetSuite
            (posting and GL). This gives you one intermediary layer that owns ASC 606 logic while keeping accounting
            posting downstream.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 28,
            background: COLORS.surface,
            padding: 4,
            borderRadius: 10,
            width: 'fit-content',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === tab.id ? COLORS.borderActive : 'transparent',
                color: activeTab === tab.id ? COLORS.white : COLORS.textMuted,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'flow' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 28, flexWrap: 'wrap' }}>
              <Section title="Salesforce" color={COLORS.salesforce} bg={COLORS.salesforceBg} icon="SF">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Source of Truth
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
                  <div>- Sales Order / Opportunity</div>
                  <div>- Contract terms and dates</div>
                  <div>- Line items, quantity, pricing</div>
                  <div>- Customer and billing info</div>
                  <div>- Amendments and renewals</div>
                  <div>- Cancellation requests</div>
                </div>
              </Section>

              <FlowArrow label="Event" sublabel="SO created / amended / cancelled" color={COLORS.salesforce} />

              <Section title="606 Ledger" color={COLORS.engine} bg={COLORS.engineBg} icon="606">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Intermediary Engine
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
                  <div>1. Identify performance obligations</div>
                  <div>2. Determine transaction price</div>
                  <div>3. Allocate price via SSP ratios</div>
                  <div>4. Generate invoice schedule</div>
                  <div>5. Determine recognition timing</div>
                  <div>6. Handle modifications and true-ups</div>
                </div>
              </Section>

              <FlowArrow label="Post" sublabel="Invoice + rev schedule + JEs" color={COLORS.engine} />

              <Section title="NetSuite" color={COLORS.netsuite} bg={COLORS.netsuiteBg} icon="NS">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  General Ledger and Posting
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
                  <div>- Invoice (AR posting)</div>
                  <div>- Deferred Revenue (liability)</div>
                  <div>- Revenue Recognition JEs</div>
                  <div>- Credit Memos (cancellations)</div>
                  <div>- Custom records (audit link)</div>
                  <div>- Period-end close support</div>
                </div>
              </Section>
            </div>

            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: COLORS.white }}>Key Design Principles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  {
                    title: 'Single Direction of Truth',
                    desc: 'Salesforce initiates changes. 606 Ledger calculates. NetSuite posts. No system writes upstream.',
                  },
                  {
                    title: '606 Ledger Owns the Math',
                    desc: 'All ASC 606 logic lives in the intermediary layer. NetSuite receives posting-ready output.',
                  },
                  {
                    title: 'Immutable Audit Log',
                    desc: 'Every create/modify/cancel event stores before/after state and all calculation inputs.',
                  },
                  {
                    title: 'Idempotent Posting',
                    desc: 'Transactions carry 606 IDs so replaying events does not create duplicates or drift.',
                  },
                ].map((p) => (
                  <div key={p.title}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.engine, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <Section title="Salesforce -> 606 Ledger" color={COLORS.salesforce} bg={COLORS.salesforceBg} icon="IN">
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, fontStyle: 'italic' }}>
                Sent on SO create, amend, or cancel
              </div>
              <DataField label="sf_order_id" required note="Salesforce SO ID - primary key" />
              <DataField label="event_type" required note="created | amended | cancelled" />
              <DataField label="customer_id" required />
              <DataField label="contract_start_date" required />
              <DataField label="contract_end_date" required />
              <DataField label="lines[]" required note="Array of line items" />
              <div style={{ paddingLeft: 16, borderLeft: `2px solid ${COLORS.salesforce}30`, marginTop: 4 }}>
                <DataField label="lines[].item_id" required />
                <DataField label="lines[].description" required />
                <DataField label="lines[].quantity" required />
                <DataField label="lines[].unit_price" required />
                <DataField label="lines[].total_amount" required />
                <DataField label="lines[].service_start" required note="Obligation period start" />
                <DataField label="lines[].service_end" required note="Obligation period end" />
                <DataField label="lines[].delivery_type" required note="point_in_time | over_time | milestone" />
                <DataField label="lines[].standalone_selling_price" note="SSP override if known" />
                <DataField label="lines[].discount_amount" />
              </div>
              <div style={{ marginTop: 12 }}>
                <DataField label="payment_terms" note="Net 30, etc." />
                <DataField label="billing_frequency" note="monthly | quarterly | annual | one_time" />
                <DataField label="amendment_reference" note="Prior version ID if amended" />
              </div>
            </Section>

            <Section title="606 Ledger -> NetSuite" color={COLORS.netsuite} bg={COLORS.netsuiteBg} icon="OUT">
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, fontStyle: 'italic' }}>
                Sent for each scheduled invoice or JE payload
              </div>
              <DataField label="engine_transaction_id" required note="Idempotency key" />
              <DataField label="engine_arrangement_id" required note="Links back to arrangement" />
              <DataField label="sf_order_id" required note="Cross-reference to Salesforce" />
              <DataField label="entity" required note="NetSuite customer internal ID" />
              <DataField label="trandate" required note="Invoice date per schedule" />
              <DataField label="subsidiary" required note="If OneWorld" />
              <DataField label="currency" />
              <DataField label="lines[]" required note="One row per performance obligation" />
              <div style={{ paddingLeft: 16, borderLeft: `2px solid ${COLORS.netsuite}30`, marginTop: 4 }}>
                <DataField label="lines[].item" required note="NetSuite item internal ID" />
                <DataField label="lines[].quantity" required />
                <DataField label="lines[].rate" required note="Allocated price from SSP" />
                <DataField label="lines[].amount" required />
                <DataField label="lines[].revrecstartdate" required />
                <DataField label="lines[].revrecenddate" required />
              </div>
              <div style={{ marginTop: 12 }}>
                <DataField label="rev_schedule[]" note="Pre-calculated recognition schedule" />
                <DataField label="memo" note="Arrangement ID + version for traceability" />
              </div>
            </Section>

            <Section title="Stored in 606 Ledger" color={COLORS.engine} bg={COLORS.engineBg} icon="DB">
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, fontStyle: 'italic' }}>
                Persistent state owned by the intermediary
              </div>
              <DataField label="arrangement_id" required note="Unique per contract" />
              <DataField label="arrangement_version" required note="Incremented on each change" />
              <DataField label="sf_order_id" required />
              <DataField label="obligations[]" required note="Identified performance obligations" />
              <div style={{ paddingLeft: 16, borderLeft: `2px solid ${COLORS.engine}30`, marginTop: 4 }}>
                <DataField label="obligations[].id" required />
                <DataField label="obligations[].type" required note="point_in_time | over_time" />
                <DataField label="obligations[].standalone_selling_price" required />
                <DataField label="obligations[].allocated_price" required note="After SSP ratio" />
                <DataField label="obligations[].recognition_method" />
                <DataField label="obligations[].status" note="pending | partial | satisfied" />
              </div>
              <div style={{ marginTop: 12 }}>
                <DataField label="invoice_schedule[]" note="Generated billing plan" />
                <DataField label="recognition_schedule[]" note="Revenue schedule" />
                <DataField label="posted_to_netsuite[]" note="Array of NS transaction IDs" />
                <DataField label="audit_log[]" note="Every event with timestamp and payload" />
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'changes' && (
          <div>
            {[
              {
                title: 'Contract Modification (Amendment)',
                color: COLORS.engine,
                steps: [
                  {
                    system: 'Salesforce',
                    color: COLORS.salesforce,
                    action:
                      'Sales rep amends the SO (line adds/removals, quantity, pricing, term changes). Event includes full current state and amendment_reference.',
                  },
                  {
                    system: '606 Ledger',
                    color: COLORS.engine,
                    action:
                      'Creates a new version, determines ASC 606 method (separate contract, cumulative catch-up, or prospective), recalculates SSP allocation, and generates deltas.',
                  },
                  {
                    system: 'NetSuite',
                    color: COLORS.netsuite,
                    action:
                      'Posts credit/reversal and catch-up entries as needed plus updated invoices forward, all tagged by arrangement_version.',
                  },
                ],
              },
              {
                title: 'Full Cancellation',
                color: COLORS.danger,
                steps: [
                  {
                    system: 'Salesforce',
                    color: COLORS.salesforce,
                    action: 'SO cancelled with effective_date and cancellation_reason.',
                  },
                  {
                    system: '606 Ledger',
                    color: COLORS.engine,
                    action:
                      'Freezes arrangement, compares recognized vs earned amounts, computes refund or AR delta, and generates cancellation transactions.',
                  },
                  {
                    system: 'NetSuite',
                    color: COLORS.netsuite,
                    action:
                      'Posts credit memo, unearned revenue reversal, deferred revenue cleanup, and suppresses future invoices.',
                  },
                ],
              },
              {
                title: 'Partial Cancellation (Line Removal)',
                color: COLORS.audit,
                steps: [
                  {
                    system: 'Salesforce',
                    color: COLORS.salesforce,
                    action: 'Amendment event marks removed lines explicitly.',
                  },
                  {
                    system: '606 Ledger',
                    color: COLORS.engine,
                    action:
                      'Removes affected obligations, reallocates remaining transaction price via updated SSP, and recalculates schedules with catch-up/prospective treatment.',
                  },
                  {
                    system: 'NetSuite',
                    color: COLORS.netsuite,
                    action: 'Posts credits for removed lines and updates future schedules with reallocation JEs where needed.',
                  },
                ],
              },
            ].map((scenario) => (
              <div
                key={scenario.title}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: scenario.color }}>{scenario.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {scenario.steps.map((step) => (
                    <div key={`${scenario.title}-${step.system}`} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div
                        style={{
                          minWidth: 110,
                          fontSize: 11,
                          fontWeight: 700,
                          color: step.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          paddingTop: 2,
                        }}
                      >
                        {step.system}
                      </div>
                      <div style={{ width: 2, minHeight: 20, background: `${step.color}40`, borderRadius: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>{step.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <div
              style={{
                background: COLORS.auditBg,
                border: `1px solid ${COLORS.audit}30`,
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: COLORS.audit }}>Full Traceability Chain</h3>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>
                Every NetSuite transaction links to a 606 Ledger transaction, which links to the exact originating
                Salesforce event and calculation inputs.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '20px 24px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: COLORS.white }}>Cross-Reference Keys</h4>
                <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 2 }}>
                  <div><code style={{ color: COLORS.salesforce }}>sf_order_id</code>: carried through all systems</div>
                  <div><code style={{ color: COLORS.engine }}>engine_arrangement_id</code>: groups all contract outputs</div>
                  <div><code style={{ color: COLORS.engine }}>engine_transaction_id</code>: idempotency key per posting</div>
                  <div><code style={{ color: COLORS.engine }}>arrangement_version</code>: identifies calc version</div>
                  <div><code style={{ color: COLORS.netsuite }}>ns_transaction_id</code>: posted record written back</div>
                </div>
              </div>

              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '20px 24px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: COLORS.white }}>606 Ledger Audit Log</h4>
                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <DataField label="timestamp" required />
                  <DataField label="event_type" required note="created | amended | cancelled | posted | reposted" />
                  <DataField label="sf_order_id" required />
                  <DataField label="arrangement_version" required />
                  <DataField label="input_payload" required note="Source payload" />
                  <DataField label="calculation_inputs" required note="SSP table and rules used" />
                  <DataField label="calculation_outputs" required note="Obligations and schedules" />
                  <DataField label="delta_from_prior" note="Version difference" />
                  <DataField label="ns_transactions_created" note="Posted IDs" />
                </div>
              </div>

              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '20px 24px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: COLORS.white }}>NetSuite Audit Surface</h4>
                <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 10 }}><strong style={{ color: COLORS.text }}>Custom fields on Invoice/JE/Credit Memo:</strong></div>
                  <DataField label="custbody_engine_txn_id" note="Idempotency and lookup" />
                  <DataField label="custbody_engine_arrangement_id" note="Group related entries" />
                  <DataField label="custbody_sf_order_id" note="Trace back to Salesforce" />
                  <DataField label="custbody_arrangement_version" note="Calc version stamp" />
                </div>
              </div>
            </div>

            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: COLORS.white }}>Audit Walkthrough</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {[
                  { label: 'NS Invoice', color: COLORS.netsuite },
                  { label: '606 Ledger Log', color: COLORS.engine },
                  { label: 'SF Order', color: COLORS.salesforce },
                  { label: 'SSP Table', color: COLORS.engine },
                  { label: 'Rev Schedule', color: COLORS.engine },
                  { label: 'NS Rev JEs', color: COLORS.netsuite },
                ].map((item, idx) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: `${item.color}15`, border: `1px solid ${item.color}30`, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.label}</div>
                    </div>
                    {idx < 5 && <div style={{ color: COLORS.textDim, fontSize: 16 }}>-&gt;</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
