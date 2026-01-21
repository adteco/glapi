import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from '../metrics-service';

// Mock the repositories
vi.mock('@glapi/database', () => ({
  GlReportingRepository: vi.fn().mockImplementation(() => ({})),
  MetricsRepository: vi.fn().mockImplementation(() => ({
    getPeriodFinancials: vi.fn(),
    getSegmentBreakdown: vi.fn(),
    findCustomMetrics: vi.fn(),
    findCustomMetricById: vi.fn(),
    createCustomMetric: vi.fn(),
    updateCustomMetric: vi.fn(),
    deleteCustomMetric: vi.fn(),
    findSavedViews: vi.fn(),
    findSavedViewById: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    clearDefaultViews: vi.fn(),
  })),
  AccountingPeriodRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    findCurrentPeriod: vi.fn(),
    findPreviousPeriod: vi.fn(),
    findByDateRange: vi.fn(),
    findRecentPeriods: vi.fn(),
  })),
}));

describe('MetricsService', () => {
  let service: MetricsService;
  let mockMetricsRepo: any;
  let mockPeriodRepo: any;

  const TEST_ORG_ID = 'test-org-id';
  const TEST_PERIOD_ID = 'test-period-id';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MetricsService({ organizationId: TEST_ORG_ID });
    mockMetricsRepo = (service as any).metricsRepository;
    mockPeriodRepo = (service as any).periodRepository;
  });

  describe('getDashboard', () => {
    it('should return dashboard data with summary metrics', async () => {
      // Setup mocks
      mockPeriodRepo.findById.mockResolvedValue({
        id: TEST_PERIOD_ID,
        periodName: 'January 2026',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
      mockPeriodRepo.findPreviousPeriod.mockResolvedValue({
        id: 'prev-period-id',
        periodName: 'December 2025',
      });

      mockMetricsRepo.getPeriodFinancials.mockResolvedValue({
        revenue: '100000',
        cogs: '40000',
        operatingExpenses: '30000',
        otherExpenses: '5000',
        currentAssets: '200000',
        currentLiabilities: '100000',
        inventory: '25000',
        accountsReceivable: '50000',
        accountsPayable: '30000',
      });

      mockMetricsRepo.getSegmentBreakdown.mockResolvedValue([]);

      const result = await service.getDashboard({
        periodId: TEST_PERIOD_ID,
        compareWithPrevious: true,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalRevenue.value).toBe(100000);
      expect(result.summary.netIncome.value).toBe(25000); // 100000 - 40000 - 30000 - 5000
      expect(result.summary.grossMargin.value).toBe(60); // (100000 - 40000) / 100000 * 100
      expect(result.period.id).toBe(TEST_PERIOD_ID);
    });

    it('should handle missing period gracefully', async () => {
      mockPeriodRepo.findById.mockResolvedValue(null);
      mockPeriodRepo.findCurrentPeriod.mockResolvedValue(null);

      await expect(
        service.getDashboard({ periodId: 'non-existent' })
      ).rejects.toThrow('Period not found');
    });
  });

  describe('getKpiCards', () => {
    it('should return KPI cards with change indicators', async () => {
      mockPeriodRepo.findById.mockResolvedValue({
        id: TEST_PERIOD_ID,
        periodName: 'January 2026',
      });
      mockPeriodRepo.findPreviousPeriod.mockResolvedValue({
        id: 'prev-period-id',
        periodName: 'December 2025',
      });

      // Current period financials
      mockMetricsRepo.getPeriodFinancials
        .mockResolvedValueOnce({
          revenue: '120000',
          cogs: '48000',
          operatingExpenses: '36000',
          otherExpenses: '6000',
          currentAssets: '0',
          currentLiabilities: '0',
          inventory: '0',
          accountsReceivable: '0',
          accountsPayable: '0',
        })
        // Previous period financials
        .mockResolvedValueOnce({
          revenue: '100000',
          cogs: '40000',
          operatingExpenses: '30000',
          otherExpenses: '5000',
          currentAssets: '0',
          currentLiabilities: '0',
          inventory: '0',
          accountsReceivable: '0',
          accountsPayable: '0',
        });

      const cards = await service.getKpiCards(TEST_PERIOD_ID, ['total_revenue', 'net_income']);

      expect(cards).toHaveLength(2);

      const revenueCard = cards.find((c) => c.id === 'total_revenue');
      expect(revenueCard).toBeDefined();
      expect(revenueCard!.value).toBe(120000);
      expect(revenueCard!.previousValue).toBe(100000);
      expect(revenueCard!.change).toBe(20000);
      expect(revenueCard!.changeDirection).toBe('up');

      const netIncomeCard = cards.find((c) => c.id === 'net_income');
      expect(netIncomeCard).toBeDefined();
      expect(netIncomeCard!.value).toBe(30000); // 120000 - 48000 - 36000 - 6000
    });
  });

  describe('getSegmentPerformance', () => {
    it('should return segment breakdown by dimension', async () => {
      mockMetricsRepo.getSegmentBreakdown.mockResolvedValue([
        { dimensionId: 'class-1', dimensionName: 'Product Line A', dimensionCode: 'PLA', value: 60000 },
        { dimensionId: 'class-2', dimensionName: 'Product Line B', dimensionCode: 'PLB', value: 40000 },
      ]);

      const result = await service.getSegmentPerformance({
        periodId: TEST_PERIOD_ID,
        dimensionType: 'class',
        metric: 'revenue',
        topN: 10,
      });

      expect(result.dimensionType).toBe('class');
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].percentOfTotal).toBe(60);
      expect(result.segments[1].percentOfTotal).toBe(40);
    });
  });

  describe('getDimensionBreakdown', () => {
    it('should return dimension breakdown with percentages', async () => {
      mockMetricsRepo.getSegmentBreakdown.mockResolvedValue([
        { dimensionId: 'dept-1', dimensionName: 'Sales', value: 50000 },
        { dimensionId: 'dept-2', dimensionName: 'Engineering', value: 30000 },
        { dimensionId: 'dept-3', dimensionName: 'Marketing', value: 20000 },
      ]);

      const breakdowns = await service.getDimensionBreakdown(
        TEST_PERIOD_ID,
        'department',
        'expenses'
      );

      expect(breakdowns).toHaveLength(3);
      expect(breakdowns[0].percentage).toBe(50);
      expect(breakdowns[1].percentage).toBe(30);
      expect(breakdowns[2].percentage).toBe(20);
    });
  });

  describe('listMetricDefinitions', () => {
    it('should return built-in and custom metrics', async () => {
      mockMetricsRepo.findCustomMetrics.mockResolvedValue([
        {
          id: 'custom-1',
          name: 'Custom KPI',
          category: 'custom',
          formula: 'SUM(x)',
          unit: 'USD',
          aggregation: 'sum',
        },
      ]);

      const metrics = await service.listMetricDefinitions();

      expect(metrics.length).toBeGreaterThan(1);
      expect(metrics.some((m) => m.id === 'total_revenue')).toBe(true);
      expect(metrics.some((m) => m.id === 'gross_margin')).toBe(true);
      expect(metrics.some((m) => m.id === 'custom-1')).toBe(true);
    });

    it('should filter by category', async () => {
      mockMetricsRepo.findCustomMetrics.mockResolvedValue([]);

      const metrics = await service.listMetricDefinitions('profitability');

      expect(metrics.every((m) => m.category === 'profitability')).toBe(true);
      expect(metrics.some((m) => m.id === 'gross_margin')).toBe(true);
      expect(metrics.some((m) => m.id === 'operating_margin')).toBe(true);
    });
  });

  describe('Custom Metrics CRUD', () => {
    it('should create a custom metric', async () => {
      const input = {
        name: 'Revenue per Employee',
        category: 'efficiency' as const,
        formula: 'revenue / employee_count',
        unit: 'USD',
        aggregation: 'latest' as const,
      };

      mockMetricsRepo.createCustomMetric.mockResolvedValue({
        id: 'new-metric-id',
        ...input,
      });

      const result = await service.createCustomMetric(input);

      expect(result.id).toBe('new-metric-id');
      expect(result.name).toBe('Revenue per Employee');
      expect(mockMetricsRepo.createCustomMetric).toHaveBeenCalled();
    });

    it('should update a custom metric', async () => {
      mockMetricsRepo.findCustomMetricById.mockResolvedValue({
        id: 'metric-id',
        name: 'Old Name',
        category: 'custom',
        formula: 'x',
        unit: 'USD',
        aggregation: 'sum',
      });

      mockMetricsRepo.updateCustomMetric.mockResolvedValue(undefined);
      mockMetricsRepo.findCustomMetricById.mockResolvedValue({
        id: 'metric-id',
        name: 'New Name',
        category: 'custom',
        formula: 'x',
        unit: 'USD',
        aggregation: 'sum',
      });

      const result = await service.updateCustomMetric('metric-id', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw when deleting non-existent metric', async () => {
      mockMetricsRepo.findCustomMetricById.mockResolvedValue(null);

      await expect(service.deleteCustomMetric('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('Saved Views CRUD', () => {
    const mockView = {
      id: 'view-id',
      organizationId: TEST_ORG_ID,
      name: 'My Dashboard',
      viewType: 'dashboard',
      configuration: JSON.stringify({ filters: {}, metrics: ['total_revenue'] }),
      isDefault: false,
      isShared: false,
      createdBy: 'user-1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('should list saved views', async () => {
      mockMetricsRepo.findSavedViews.mockResolvedValue([mockView]);

      const views = await service.listSavedViews('dashboard');

      expect(views).toHaveLength(1);
      expect(views[0].name).toBe('My Dashboard');
      expect(views[0].configuration.metrics).toEqual(['total_revenue']);
    });

    it('should create a saved view', async () => {
      const input = {
        name: 'New View',
        viewType: 'dashboard' as const,
        configuration: { filters: {}, metrics: ['net_income'] },
      };

      mockMetricsRepo.createSavedView.mockResolvedValue({
        ...mockView,
        name: input.name,
        configuration: JSON.stringify(input.configuration),
      });

      const result = await service.createSavedView(input, 'user-1');

      expect(result.name).toBe('New View');
      expect(mockMetricsRepo.createSavedView).toHaveBeenCalled();
    });

    it('should clear other defaults when setting a view as default', async () => {
      mockMetricsRepo.findSavedViewById.mockResolvedValue(mockView);
      mockMetricsRepo.clearDefaultViews.mockResolvedValue(undefined);
      mockMetricsRepo.updateSavedView.mockResolvedValue(undefined);
      mockMetricsRepo.findSavedViewById.mockResolvedValue({
        ...mockView,
        isDefault: true,
      });

      await service.updateSavedView('view-id', { isDefault: true });

      expect(mockMetricsRepo.clearDefaultViews).toHaveBeenCalledWith(TEST_ORG_ID, 'dashboard');
    });
  });

  describe('Trend Analysis', () => {
    it('should calculate trend direction from data points', async () => {
      const increasingData = [
        { date: '2025-10', value: 100 },
        { date: '2025-11', value: 120 },
        { date: '2025-12', value: 140 },
        { date: '2026-01', value: 160 },
      ];

      // Access private method for testing
      const trend = (service as any).calculateTrend(increasingData);

      expect(trend.direction).toBe('increasing');
      expect(trend.strength).toBeGreaterThan(0);
    });

    it('should identify stable trends', async () => {
      const stableData = [
        { date: '2025-10', value: 100 },
        { date: '2025-11', value: 101 },
        { date: '2025-12', value: 99 },
        { date: '2026-01', value: 100 },
      ];

      const trend = (service as any).calculateTrend(stableData);

      expect(trend.direction).toBe('stable');
    });

    it('should identify decreasing trends', async () => {
      const decreasingData = [
        { date: '2025-10', value: 160 },
        { date: '2025-11', value: 140 },
        { date: '2025-12', value: 120 },
        { date: '2026-01', value: 100 },
      ];

      const trend = (service as any).calculateTrend(decreasingData);

      expect(trend.direction).toBe('decreasing');
    });
  });

  describe('Metric Status Calculation', () => {
    it('should calculate status based on thresholds - higher is better', async () => {
      const definition = {
        id: 'test',
        name: 'Test',
        category: 'custom' as const,
        formula: '',
        unit: 'USD',
        aggregation: 'sum' as const,
        thresholds: { good: 100, warning: 50, critical: 0, direction: 'higher_is_better' as const },
      };

      const goodStatus = (service as any).getMetricStatus(150, definition);
      expect(goodStatus).toBe('good');

      const warningStatus = (service as any).getMetricStatus(75, definition);
      expect(warningStatus).toBe('warning');

      const criticalStatus = (service as any).getMetricStatus(-10, definition);
      expect(criticalStatus).toBe('critical');
    });

    it('should calculate status based on thresholds - lower is better', async () => {
      const definition = {
        id: 'test',
        name: 'Test',
        category: 'custom' as const,
        formula: '',
        unit: 'days',
        aggregation: 'latest' as const,
        thresholds: { good: 30, warning: 45, critical: 60, direction: 'lower_is_better' as const },
      };

      const goodStatus = (service as any).getMetricStatus(25, definition);
      expect(goodStatus).toBe('good');

      const warningStatus = (service as any).getMetricStatus(40, definition);
      expect(warningStatus).toBe('warning');

      const criticalStatus = (service as any).getMetricStatus(70, definition);
      expect(criticalStatus).toBe('critical');
    });
  });
});
