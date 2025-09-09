import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SSPAnalyticsEngine } from '../ssp-analytics-engine';
import { SSPExceptionMonitor } from '../ssp-exception-monitor';
import { SSPMLTrainingService } from '../ssp-ml-training-service';
import { Database } from '@glapi/database';
import { 
  ExceptionTypes, 
  ExceptionSeverity,
  CalculationMethods,
  RunStatus 
} from '@glapi/database/schema';

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn()
} as unknown as Database;

// Mock query builders
const createMockQueryBuilder = () => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  having: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  execute: vi.fn()
});

describe('SSPAnalyticsEngine', () => {
  let engine: SSPAnalyticsEngine;

  beforeEach(() => {
    engine = new SSPAnalyticsEngine(mockDb);
    vi.clearAllMocks();
  });

  describe('calculateSSP', () => {
    it('should calculate SSP for all items in date range', async () => {
      const mockItems = [
        { id: 'item1', name: 'Product A' },
        { id: 'item2', name: 'Product B' }
      ];

      const mockTransactions = [
        { itemId: 'item1', price: 100, isStandalone: true },
        { itemId: 'item1', price: 110, isStandalone: true },
        { itemId: 'item2', price: 200, isStandalone: false }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute.mockResolvedValueOnce(mockItems);
      queryBuilder.execute.mockResolvedValueOnce(mockTransactions);

      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'evidence1' }])
      });

      const result = await engine.calculateSSP(
        'org1',
        '2024-01-01',
        '2024-12-31',
        {
          calculationRunId: 'run1',
          minTransactions: 2,
          confidenceThreshold: 0.8,
          method: CalculationMethods.HYBRID
        }
      );

      expect(result.itemsProcessed).toBe(2);
      expect(result.vsoeCount).toBeGreaterThanOrEqual(0);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle VSOE calculation correctly', async () => {
      const mockTransactions = Array(15).fill(null).map((_, i) => ({
        itemId: 'item1',
        price: 100 + i,
        isStandalone: true,
        transactionDate: new Date()
      }));

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute.mockResolvedValue(mockTransactions);

      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ meetsVSOECriteria: true }])
      });

      const vsoeResult = await engine['calculateVSOE'](
        'org1',
        'item1',
        '2024-01-01',
        '2024-12-31',
        'run1'
      );

      expect(vsoeResult).toBeDefined();
      expect(vsoeResult?.meetsVSOECriteria).toBeDefined();
    });

    it('should calculate statistical SSP with outlier detection', async () => {
      const prices = [90, 95, 100, 105, 110, 200]; // 200 is an outlier

      const result = await engine['calculateStatisticalSSP'](
        'org1',
        'item1',
        prices,
        'run1'
      );

      expect(result).toBeDefined();
      expect(result?.outlierCount).toBeGreaterThan(0);
      expect(result?.recommendedSSP).toBeDefined();
    });
  });

  describe('Statistical Analysis', () => {
    it('should correctly identify outliers using IQR method', () => {
      const prices = [10, 20, 30, 40, 50, 100, 200]; // 100 and 200 are outliers
      const stats = engine['calculateStatistics'](prices);

      expect(stats.outliers.length).toBeGreaterThan(0);
      expect(stats.outliers).toContain(200);
    });

    it('should calculate percentiles correctly', () => {
      const prices = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = engine['calculateStatistics'](prices);

      expect(stats.p50).toBe(55); // Median
      expect(stats.p25).toBeLessThan(stats.p75);
    });

    it('should detect seasonality pattern', () => {
      const transactions = [
        { month: 1, avgPrice: 100 },
        { month: 2, avgPrice: 110 },
        { month: 3, avgPrice: 120 },
        { month: 4, avgPrice: 115 },
        { month: 5, avgPrice: 105 },
        { month: 6, avgPrice: 100 }
      ];

      const hasSeasonality = engine['detectSeasonality'](transactions);
      expect(typeof hasSeasonality).toBe('boolean');
    });
  });
});

describe('SSPExceptionMonitor', () => {
  let monitor: SSPExceptionMonitor;

  beforeEach(() => {
    monitor = new SSPExceptionMonitor(mockDb);
    vi.clearAllMocks();
  });

  describe('detectExceptions', () => {
    it('should detect VSOE failures', async () => {
      const mockVSOEFailures = [
        {
          itemId: 'item1',
          itemName: 'Product A',
          failureReason: 'insufficient_standalone',
          standalonePercentage: '20.00',
          coefficientOfVariation: '0.35'
        }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn().mockResolvedValue(mockVSOEFailures);
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(mockVSOEFailures.map(f => ({
          ...f,
          id: 'exception1',
          exceptionType: ExceptionTypes.VSOE_FAILURE
        })))
      });

      const exceptions = await monitor.detectExceptions('org1', 'run1');

      expect(exceptions.length).toBeGreaterThan(0);
      expect(exceptions[0].exceptionType).toBe(ExceptionTypes.VSOE_FAILURE);
    });

    it('should detect insufficient data exceptions', async () => {
      const mockLowDataItems = [
        {
          itemId: 'item1',
          itemName: 'Product A',
          dataPoints: 3
        }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn()
        .mockResolvedValueOnce([]) // VSOE failures
        .mockResolvedValueOnce(mockLowDataItems); // Insufficient data
      
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: 'exception2',
          exceptionType: ExceptionTypes.INSUFFICIENT_DATA,
          dataPoints: 3
        }])
      });

      const exceptions = await monitor.detectExceptions('org1', 'run1');

      expect(exceptions.some(e => e.exceptionType === ExceptionTypes.INSUFFICIENT_DATA)).toBe(true);
    });

    it('should detect stale data', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);

      const mockStaleItems = [
        {
          itemId: 'item1',
          itemName: 'Product A',
          lastActivity: oldDate
        }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn()
        .mockResolvedValueOnce([]) // VSOE
        .mockResolvedValueOnce([]) // Insufficient
        .mockResolvedValueOnce([]) // High variability
        .mockResolvedValueOnce(mockStaleItems); // Stale data
      
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: 'exception3',
          exceptionType: ExceptionTypes.STALE_DATA,
          daysSinceLastTransaction: 120
        }])
      });

      const exceptions = await monitor.detectExceptions('org1', 'run1');

      expect(exceptions.some(e => e.exceptionType === ExceptionTypes.STALE_DATA)).toBe(true);
    });
  });

  describe('Exception Management', () => {
    it('should acknowledge exception', async () => {
      const mockException = {
        id: 'exception1',
        status: 'acknowledged',
        acknowledgedBy: 'user1',
        acknowledgedAt: new Date()
      };

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockException])
      });

      const result = await monitor.acknowledgeException('exception1', 'user1');

      expect(result.status).toBe('acknowledged');
      expect(result.acknowledgedBy).toBe('user1');
    });

    it('should resolve exception with notes', async () => {
      const mockException = {
        id: 'exception1',
        status: 'resolved',
        resolvedBy: 'user1',
        resolvedAt: new Date(),
        resolutionNotes: 'Issue fixed'
      };

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockException])
      });

      const result = await monitor.resolveException('exception1', 'user1', 'Issue fixed');

      expect(result.status).toBe('resolved');
      expect(result.resolutionNotes).toBe('Issue fixed');
    });

    it('should auto-resolve exceptions when conditions are met', async () => {
      const mockOpenExceptions = [
        {
          id: 'exception1',
          itemId: 'item1',
          exceptionType: ExceptionTypes.INSUFFICIENT_DATA,
          status: 'open'
        }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn()
        .mockResolvedValueOnce(mockOpenExceptions) // Open exceptions
        .mockResolvedValueOnce([{ count: 10 }]); // Sufficient data now

      mockDb.select = vi.fn().mockReturnValue(queryBuilder);
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          ...mockOpenExceptions[0],
          status: 'resolved'
        }])
      });

      const resolvedCount = await monitor.autoResolveExceptions('org1', 'run1');

      expect(resolvedCount).toBeGreaterThan(0);
    });
  });

  describe('Exception Reporting', () => {
    it('should generate exception summary', async () => {
      const mockExceptions = [
        { severity: ExceptionSeverity.CRITICAL, status: 'open', impactedRevenue: '10000' },
        { severity: ExceptionSeverity.WARNING, status: 'open', impactedRevenue: '5000' },
        { severity: ExceptionSeverity.INFO, status: 'open', impactedRevenue: '1000' }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn().mockResolvedValue(mockExceptions);
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);

      const summary = await monitor.getExceptionSummary('org1');

      expect(summary.totalExceptions).toBe(3);
      expect(summary.criticalCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.infoCount).toBe(1);
      expect(Number(summary.totalImpactedRevenue)).toBe(16000);
    });

    it('should calculate exception trends', async () => {
      const mockCurrentExceptions = [
        { exceptionType: ExceptionTypes.VSOE_FAILURE, count: 5 },
        { exceptionType: ExceptionTypes.INSUFFICIENT_DATA, count: 3 }
      ];

      const mockPreviousExceptions = [
        { exceptionType: ExceptionTypes.VSOE_FAILURE, count: 3 },
        { exceptionType: ExceptionTypes.INSUFFICIENT_DATA, count: 4 }
      ];

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn()
        .mockResolvedValueOnce(mockCurrentExceptions)
        .mockResolvedValueOnce(mockPreviousExceptions);

      mockDb.select = vi.fn().mockReturnValue(queryBuilder);

      const trends = await monitor.getExceptionTrends('org1', 30);

      expect(trends.length).toBe(2);
      expect(trends.find(t => t.exceptionType === ExceptionTypes.VSOE_FAILURE)?.trend).toBe('increasing');
      expect(trends.find(t => t.exceptionType === ExceptionTypes.INSUFFICIENT_DATA)?.trend).toBe('decreasing');
    });
  });
});

describe('SSPMLTrainingService', () => {
  let mlService: SSPMLTrainingService;

  beforeEach(() => {
    mlService = new SSPMLTrainingService(mockDb);
    vi.clearAllMocks();
  });

  describe('Model Training', () => {
    it('should prepare training data correctly', async () => {
      const mockTransactionData = Array(150).fill(null).map((_, i) => ({
        itemId: `item${i % 10}`,
        itemName: `Product ${i % 10}`,
        itemType: 'license',
        category: 'software',
        price: 100 + (i % 50),
        quantity: 1 + (i % 5),
        discount: (i % 10) / 100,
        customerSegment: i % 3 === 0 ? 'enterprise' : 'smb',
        contractValue: 10000 + (i * 100),
        contractDuration: 12,
        isBundle: i % 4 === 0,
        seasonality: (i % 12) + 1,
        dayOfWeek: i % 7,
        quarterlyVolume: 50 + i,
        priceVariability: 10 + (i % 20)
      }));

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn().mockResolvedValue(mockTransactionData);
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);

      // Mock TensorFlow operations
      vi.mock('@tensorflow/tfjs-node', () => ({
        sequential: vi.fn().mockReturnValue({
          add: vi.fn(),
          compile: vi.fn(),
          fit: vi.fn().mockResolvedValue({ history: {} }),
          predict: vi.fn().mockReturnValue({
            array: vi.fn().mockResolvedValue([[100]]),
            dispose: vi.fn()
          })
        }),
        layers: {
          dense: vi.fn().mockReturnValue({}),
          dropout: vi.fn().mockReturnValue({}),
          batchNormalization: vi.fn().mockReturnValue({})
        },
        train: {
          adam: vi.fn().mockReturnValue({})
        },
        regularizers: {
          l2: vi.fn().mockReturnValue({})
        },
        tensor2d: vi.fn().mockReturnValue({
          dispose: vi.fn()
        }),
        losses: {
          meanSquaredError: vi.fn().mockReturnValue({
            data: vi.fn().mockResolvedValue([-0.05]),
            dispose: vi.fn()
          })
        }
      }));

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([])
      });

      const result = await mlService.trainModel('org1', '2024-01-01', '2024-12-31');

      expect(result.modelId).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.featureImportance).toBeDefined();
    });

    it('should handle insufficient training data', async () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn().mockResolvedValue([]); // No data
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);

      await expect(
        mlService.trainModel('org1', '2024-01-01', '2024-12-31')
      ).rejects.toThrow('Insufficient training data');
    });
  });

  describe('Model Predictions', () => {
    it('should make predictions for items', async () => {
      // Mock model as trained
      mlService['model'] = {
        predict: vi.fn().mockReturnValue({
          array: vi.fn().mockResolvedValue([[0.5]]),
          dispose: vi.fn()
        })
      } as any;

      mlService['featureScaler'] = {
        mean: Array(12).fill(50),
        std: Array(12).fill(10)
      };

      mlService['labelScaler'] = {
        mean: 100,
        std: 20
      };

      const predictions = await mlService.predictSSP('org1', ['item1', 'item2']);

      expect(predictions.length).toBe(2);
      expect(predictions[0].itemId).toBe('item1');
      expect(predictions[0].predictedSSP).toBeDefined();
      expect(predictions[0].confidence).toBeGreaterThanOrEqual(0);
      expect(predictions[0].confidence).toBeLessThanOrEqual(1);
      expect(predictions[0].predictionInterval).toBeDefined();
    });

    it('should throw error when model not trained', async () => {
      mlService['model'] = null;

      await expect(
        mlService.predictSSP('org1', ['item1'])
      ).rejects.toThrow('Model not trained');
    });
  });

  describe('Model Metrics', () => {
    it('should retrieve model performance metrics', async () => {
      const mockRun = {
        modelAccuracy: '0.92',
        modelTrainingDate: new Date(),
        featureImportance: {
          quantity: 0.3,
          price: 0.25,
          customerSegment: 0.2
        }
      };

      const queryBuilder = createMockQueryBuilder();
      queryBuilder.execute = vi.fn().mockResolvedValue([mockRun]);
      mockDb.select = vi.fn().mockReturnValue(queryBuilder);

      const metrics = await mlService.getModelMetrics('org1');

      expect(metrics.currentMetrics).toBeDefined();
      expect(metrics.currentMetrics?.accuracy).toBe(0.92);
      expect(metrics.historicalMetrics).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  it('should complete full SSP calculation workflow', async () => {
    const engine = new SSPAnalyticsEngine(mockDb);
    const monitor = new SSPExceptionMonitor(mockDb);

    // Mock database responses for full workflow
    const queryBuilder = createMockQueryBuilder();
    queryBuilder.execute = vi.fn()
      .mockResolvedValueOnce([{ id: 'item1', name: 'Product A' }]) // Items
      .mockResolvedValueOnce(Array(20).fill({ price: 100, isStandalone: true })) // Transactions
      .mockResolvedValueOnce([]) // Exceptions
      .mockResolvedValueOnce([{ count: 0 }]); // Exception summary

    mockDb.select = vi.fn().mockReturnValue(queryBuilder);
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'result1' }])
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([])
    });

    // Run calculation
    const result = await engine.calculateSSP(
      'org1',
      '2024-01-01',
      '2024-12-31',
      {
        calculationRunId: 'run1',
        minTransactions: 5,
        confidenceThreshold: 0.8,
        method: CalculationMethods.HYBRID
      }
    );

    expect(result.itemsProcessed).toBeGreaterThan(0);

    // Detect exceptions
    const exceptions = await monitor.detectExceptions('org1', 'run1');
    expect(Array.isArray(exceptions)).toBe(true);
  });
});