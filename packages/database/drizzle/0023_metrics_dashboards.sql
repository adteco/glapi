-- ==========================================
-- Custom Metrics Table
-- ==========================================

CREATE TABLE IF NOT EXISTS custom_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  formula TEXT NOT NULL,
  unit TEXT NOT NULL,
  aggregation TEXT NOT NULL DEFAULT 'sum',
  is_percentage BOOLEAN DEFAULT FALSE,
  precision INTEGER DEFAULT 2,
  thresholds TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for custom_metrics
CREATE INDEX IF NOT EXISTS idx_custom_metrics_org ON custom_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_category ON custom_metrics(organization_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_metrics_org_name ON custom_metrics(organization_id, name);

-- ==========================================
-- Saved Views Table
-- ==========================================

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  view_type TEXT NOT NULL,
  configuration TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for saved_views
CREATE INDEX IF NOT EXISTS idx_saved_views_org ON saved_views(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_type ON saved_views(organization_id, view_type);
CREATE INDEX IF NOT EXISTS idx_saved_views_default ON saved_views(organization_id, view_type, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_views_created_by ON saved_views(created_by);

-- ==========================================
-- Metric Snapshots Table
-- ==========================================

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  period_id UUID NOT NULL,
  subsidiary_id UUID,
  class_id UUID,
  department_id UUID,
  location_id UUID,
  value TEXT NOT NULL,
  previous_value TEXT,
  change_percent TEXT,
  calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Indexes for metric_snapshots
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_org ON metric_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_metric ON metric_snapshots(organization_id, metric_id, period_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_dimensions ON metric_snapshots(
  organization_id, metric_id, period_id, subsidiary_id, class_id, department_id, location_id
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_expires ON metric_snapshots(expires_at) WHERE expires_at IS NOT NULL;

-- ==========================================
-- Dashboard Layouts Table
-- ==========================================

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_view_id UUID NOT NULL REFERENCES saved_views(id) ON DELETE CASCADE,
  widget_id TEXT NOT NULL,
  widget_type TEXT NOT NULL,
  position INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 2,
  configuration TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for dashboard_layouts
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_view ON dashboard_layouts(saved_view_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_layouts_widget ON dashboard_layouts(saved_view_id, widget_id);

-- ==========================================
-- Triggers for updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custom_metrics_updated_at ON custom_metrics;
CREATE TRIGGER trigger_custom_metrics_updated_at
  BEFORE UPDATE ON custom_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_metrics_updated_at();

DROP TRIGGER IF EXISTS trigger_saved_views_updated_at ON saved_views;
CREATE TRIGGER trigger_saved_views_updated_at
  BEFORE UPDATE ON saved_views
  FOR EACH ROW
  EXECUTE FUNCTION update_metrics_updated_at();

DROP TRIGGER IF EXISTS trigger_dashboard_layouts_updated_at ON dashboard_layouts;
CREATE TRIGGER trigger_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_metrics_updated_at();

-- ==========================================
-- Comments
-- ==========================================

COMMENT ON TABLE custom_metrics IS 'User-defined KPI and metric definitions';
COMMENT ON TABLE saved_views IS 'Saved dashboard and report view configurations';
COMMENT ON TABLE metric_snapshots IS 'Historical metric value cache for trend analysis';
COMMENT ON TABLE dashboard_layouts IS 'Widget layout configuration for saved views';

COMMENT ON COLUMN custom_metrics.formula IS 'SQL expression or formula definition for calculating the metric';
COMMENT ON COLUMN custom_metrics.thresholds IS 'JSON: {good, warning, critical, direction, target}';
COMMENT ON COLUMN saved_views.configuration IS 'JSON configuration including filters, metrics, layout';
COMMENT ON COLUMN metric_snapshots.expires_at IS 'Cache invalidation timestamp';
