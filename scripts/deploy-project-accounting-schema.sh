#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${EXPECTED_DATABASE_NAME:-}" ]]; then
  echo "EXPECTED_DATABASE_NAME is required" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL_DATABASE_URL="${DATABASE_URL/sslmode=no-verify/sslmode=require}"

actual_database="$(psql "$PSQL_DATABASE_URL" -X -Atc 'select current_database()')"
if [[ "$actual_database" != "$EXPECTED_DATABASE_NAME" ]]; then
  echo "Refusing schema deployment: expected database '$EXPECTED_DATABASE_NAME', connected to '$actual_database'" >&2
  exit 1
fi

required_base_tables=(
  organizations
  entities
  subsidiaries
  projects
  project_tasks
  time_entries
  items
  performance_obligations
  contract_ssp_allocations
  revenue_schedules
  revenue_journal_entries
  accounting_periods
  gl_transactions
  gl_transaction_lines
)

for table_name in "${required_base_tables[@]}"; do
  exists="$(psql "$PSQL_DATABASE_URL" -X -Atc "select to_regclass('public.${table_name}') is not null")"
  if [[ "$exists" != "t" ]]; then
    echo "Refusing schema deployment: required base table public.${table_name} is missing" >&2
    exit 1
  fi
done

psql "$PSQL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '
  CREATE TABLE IF NOT EXISTS public.glapi_schema_migrations (
    migration_tag text PRIMARY KEY,
    checksum_sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
' >/dev/null

migrations=(
  packages/database/drizzle/0016_invoice_foundation.sql
  packages/database/drizzle/0027_expense_entries_foundation.sql
  packages/database/drizzle/0070_task_billing_enhancement.sql
  packages/database/drizzle/0071_item_revenue_defaults.sql
  packages/database/drizzle/0073_unify_606_ledger_obligations.sql
  packages/database/drizzle/0074_invoice_source_allocations.sql
  packages/database/drizzle/0075_organization_stripe_connect.sql
  packages/database/drizzle/0076_invoice_payment_link_fields.sql
  packages/database/drizzle/0077_external_event_receipts.sql
  packages/database/drizzle/0078_customer_portal_auth.sql
  packages/database/drizzle/0079_project_billing_model.sql
  packages/database/drizzle/0080_better_auth_schema.sql
  packages/database/drizzle/0080_project_contract_billing_rules.sql
  packages/database/drizzle/0081_project_billing_idempotency.sql
  packages/database/drizzle/0082_project_revenue_plan_lineage.sql
  packages/database/drizzle/0083_atomic_revenue_recognition_runs.sql
  packages/database/drizzle/0084_project_gl_posting_lineage.sql
  packages/database/drizzle/0085_project_revenue_adjustments.sql
)

required_feature_tables=(
  invoices
  invoice_line_items
  expense_entries
  invoice_source_allocations
  project_contracts
  project_contract_versions
  project_billing_rules
  project_billing_requests
  revenue_recognition_runs
  revenue_recognition_run_items
  project_contract_modifications
  project_revenue_recognition_reversals
)

if [[ "${BASELINE_EXISTING_SCHEMA:-false}" == "true" ]]; then
  for table_name in "${required_feature_tables[@]}"; do
    exists="$(psql "$PSQL_DATABASE_URL" -X -Atc "select to_regclass('public.${table_name}') is not null")"
    if [[ "$exists" != "t" ]]; then
      echo "Cannot baseline: public.${table_name} is missing" >&2
      exit 1
    fi
  done

  for relative_path in "${migrations[@]}"; do
    migration_path="${REPO_ROOT}/${relative_path}"
    migration_tag="$(basename "$migration_path" .sql)"
    checksum="$(shasum -a 256 "$migration_path" | awk '{print $1}')"
    psql "$PSQL_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
      -c "insert into public.glapi_schema_migrations (migration_tag, checksum_sha256) values ('${migration_tag}', '${checksum}') on conflict (migration_tag) do nothing" \
      >/dev/null
    echo "Baselined: ${migration_tag}"
  done
fi

for relative_path in "${migrations[@]}"; do
  migration_path="${REPO_ROOT}/${relative_path}"
  migration_tag="$(basename "$migration_path" .sql)"
  checksum="$(shasum -a 256 "$migration_path" | awk '{print $1}')"
  applied_checksum="$(
    psql "$PSQL_DATABASE_URL" -X -At \
      -c "select checksum_sha256 from public.glapi_schema_migrations where migration_tag = '${migration_tag}'" \
  )"

  if [[ -n "$applied_checksum" ]]; then
    if [[ "$applied_checksum" != "$checksum" ]]; then
      echo "Migration checksum mismatch for ${migration_tag}" >&2
      exit 1
    fi
    echo "Already applied: ${migration_tag}"
    continue
  fi

  echo "Applying: ${migration_tag}"
  psql "$PSQL_DATABASE_URL" -X --single-transaction -v ON_ERROR_STOP=1 \
    -f "$migration_path" \
    -c "insert into public.glapi_schema_migrations (migration_tag, checksum_sha256) values ('${migration_tag}', '${checksum}')" \
    >/dev/null
done

for table_name in "${required_feature_tables[@]}"; do
  exists="$(psql "$PSQL_DATABASE_URL" -X -Atc "select to_regclass('public.${table_name}') is not null")"
  if [[ "$exists" != "t" ]]; then
    echo "Schema verification failed: public.${table_name} is missing" >&2
    exit 1
  fi
done

echo "Project accounting schema is current on database '${actual_database}'"
