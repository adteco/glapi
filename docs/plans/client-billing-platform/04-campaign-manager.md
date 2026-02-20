# Phase 5: Campaign Manager

## Objective

Allow teams to move identified prospects into structured marketing/sales campaigns and measure movement through the funnel.

## Current State

Foundations already exist:

- Prospects CRUD and conversion:
  - `packages/trpc/src/routers/prospects.ts`
  - `apps/web/src/app/relationships/prospects/*`
- Communication automation/event history:
  - `packages/trpc/src/routers/communication-workflows.ts`
  - `packages/trpc/src/routers/communication-events.ts`
  - `packages/database/src/db/schema/communication-workflows.ts`

Missing:

- first-class campaign objects
- campaign member progression model
- campaign-level analytics

## Data Model Additions

1. `campaigns`
   - `id`, `organization_id`, `name`, `type`, `status`, `budget`, `start_date`, `end_date`, `metadata`

2. `campaign_members`
   - `id`, `campaign_id`, `entity_id`, `stage`, `score`, `owner_id`, `entered_at`, `exited_at`, `metadata`

3. `campaign_activities` (optional first release)
   - links communication events and responses back to campaign/member

## Workflow

1. Add prospect to campaign
2. Run communication workflow sequence
3. Track engagement signals and stage movement
4. Promote qualified member to opportunity or lead
5. Measure campaign-to-revenue conversion

## Consent and Compliance Guardrails

1. Campaign sends must respect unsubscribe and suppression lists
2. Member-level communication eligibility is evaluated before each send
3. Frequency caps prevent over-contact
4. Consent source and timestamp are stored for each member when required
5. Jurisdiction-specific policy hooks are supported via metadata-driven rules

## API

New router: `campaigns`

1. `campaigns.list`
2. `campaigns.create`
3. `campaigns.addMembers`
4. `campaigns.advanceStage`
5. `campaigns.analytics`

## UI

1. Campaign list + detail pages
2. Member pipeline board by stage
3. Integration panel:
   - attach communication workflow
   - send one-off campaign messages
4. Analytics widgets:
   - member count by stage
   - progression rate
   - opportunity conversion rate
5. Compliance indicators:
   - suppressed members
   - consent coverage
   - frequency-cap violations

## Acceptance Criteria

1. Users can create campaigns and add prospects
2. Members move through configured stages with audit trail
3. Campaign engagement and progression are visible in analytics
4. Campaign members can be converted into opportunities/leads
5. Suppression and unsubscribe policies are enforced on campaign sends
6. Campaign event trail is auditable per member

## Complexity and Estimate

- Complexity: Medium-High
- Estimate: 2-4 weeks
