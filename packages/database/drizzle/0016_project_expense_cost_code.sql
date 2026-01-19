ALTER TABLE "project_expense_entries"
  ADD COLUMN IF NOT EXISTS "cost_code_id" uuid REFERENCES "project_cost_codes"("id");

CREATE INDEX IF NOT EXISTS "idx_project_expenses_cost_code"
  ON "project_expense_entries" ("cost_code_id");
