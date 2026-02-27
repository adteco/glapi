-- Project billing model
-- Adds a project-level billing mode used as default for task/invoice billing behavior.

CREATE TYPE project_billing_model AS ENUM ('fixed_fee', 'time_and_materials');

ALTER TABLE projects
  ADD COLUMN billing_model project_billing_model NOT NULL DEFAULT 'time_and_materials';

COMMENT ON COLUMN projects.billing_model IS 'Project-level billing model: fixed_fee or time_and_materials';
