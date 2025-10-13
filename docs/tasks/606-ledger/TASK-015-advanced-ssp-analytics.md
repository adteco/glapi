# TASK-015: Advanced SSP Analytics & Automation

## Description
Implement advanced Standalone Selling Price (SSP) analytics with automated calculation from historical data, VSOE (Vendor-Specific Objective Evidence) analysis, pricing band detection, and machine learning capabilities for SSP prediction and optimization.

## Acceptance Criteria
- [ ] Automated SSP calculation from historical transaction data
- [ ] VSOE evidence tracking and compliance validation
- [ ] Pricing band analysis with statistical outlier detection
- [ ] SSP exception reporting and alerting system
- [ ] Machine learning model for SSP prediction
- [ ] Historical trend analysis and seasonality detection
- [ ] Competitor pricing integration and analysis
- [ ] SSP approval workflow with audit trail
- [ ] Real-time SSP recommendation engine
- [ ] Comprehensive SSP analytics dashboard

## Dependencies
- TASK-003: Revenue recognition schema (SSP evidence tables)
- TASK-007: Revenue recognition tRPC router (basic SSP management)
- TASK-010: Reporting engine

## Estimated Effort
5 days

## Technical Implementation

### Enhanced SSP Schema
```typescript
// packages/database/src/db/schema/ssp-analytics.ts
import { pgTable, uuid, varchar, decimal, timestamp, jsonb, boolean, integer, date } from "drizzle-orm/pg-core";

// SSP calculation runs and results
export const sspCalculationRuns = pgTable("ssp_calculation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  runDate: timestamp("run_date", { withTimezone: true }).notNull(),
  runType: varchar("run_type", { length: 50 }).notNull(), // automated, manual, ml_training
  
  // Run parameters
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  itemFilter: jsonb("item_filter"), // Specific items to calculate
  
  // Results summary
  itemsProcessed: integer("items_processed").notNull(),
  sspCalculated: integer("ssp_calculated").notNull(),
  exceptionsFound: integer("exceptions_found").notNull(),
  
  // ML model metrics (if applicable)
  modelVersion: varchar("model_version", { length: 50 }),
  modelAccuracy: decimal("model_accuracy", { precision: 5, scale: 4 }),
  
  status: varchar("status", { length: 20 }).notNull(), // running, completed, failed
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// VSOE evidence tracking
export const vsoeEvidence = pgTable("vsoe_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  
  // VSOE criteria
  totalTransactions: integer("total_transactions").notNull(),
  standaloneTransactions: integer("standalone_transactions").notNull(),
  bundledTransactions: integer("bundled_transactions").notNull(),
  
  // Price analysis
  medianPrice: decimal("median_price", { precision: 12, scale: 2 }).notNull(),
  meanPrice: decimal("mean_price", { precision: 12, scale: 2 }).notNull(),
  priceVariance: decimal("price_variance", { precision: 12, scale: 4 }).notNull(),
  coefficientOfVariation: decimal("coefficient_of_variation", { precision: 5, scale: 4 }).notNull(),
  
  // VSOE determination
  hasVSOE: boolean("has_vsoe").notNull(),
  vsoePrice: decimal("vsoe_price", { precision: 12, scale: 2 }),
  vsoeConfidenceScore: decimal("vsoe_confidence_score", { precision: 5, scale: 4 }),
  
  // Compliance
  meetsRevenueCriteria: boolean("meets_revenue_criteria").notNull(),
  meetsVolumeCriteria: boolean("meets_volume_criteria").notNull(),
  meetsPricingCriteria: boolean("meets_pricing_criteria").notNull(),
  
  analysisDate: date("analysis_date").notNull(),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Pricing bands and outliers
export const sspPricingBands = pgTable("ssp_pricing_bands", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  
  // Statistical bands
  lowerQuartile: decimal("lower_quartile", { precision: 12, scale: 2 }).notNull(),
  median: decimal("median", { precision: 12, scale: 2 }).notNull(),
  upperQuartile: decimal("upper_quartile", { precision: 12, scale: 2 }).notNull(),
  
  // Outlier boundaries (using IQR method)
  lowerBound: decimal("lower_bound", { precision: 12, scale: 2 }).notNull(),
  upperBound: decimal("upper_bound", { precision: 12, scale: 2 }).notNull(),
  
  // Distribution metrics
  skewness: decimal("skewness", { precision: 8, scale: 4 }),
  kurtosis: decimal("kurtosis", { precision: 8, scale: 4 }),
  
  // Confidence intervals
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }).default("0.95"),
  lowerCI: decimal("lower_ci", { precision: 12, scale: 2 }).notNull(),
  upperCI: decimal("upper_ci", { precision: 12, scale: 2 }).notNull(),
  
  sampleSize: integer("sample_size").notNull(),
  outlierCount: integer("outlier_count").notNull(),
  
  calculationDate: date("calculation_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// SSP exceptions and alerts
export const sspExceptions = pgTable("ssp_exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  
  exceptionType: varchar("exception_type", { length: 50 }).notNull(), // outlier, no_data, high_variance, policy_violation
  severity: varchar("severity", { length: 20 }).notNull(), // critical, high, medium, low
  
  // Exception details
  detectedDate: date("detected_date").notNull(),
  description: text("description").notNull(),
  metrics: jsonb("metrics"), // Relevant metrics that triggered the exception
  
  // Resolution
  status: varchar("status", { length: 20 }).notNull(), // open, acknowledged, resolved, ignored
  assignedTo: uuid("assigned_to").references(() => users.id),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
```

### SSP Analytics Engine
```typescript
// packages/business/src/services/ssp-analytics-engine.ts
import { Database } from '@glapi/database';
import * as tf from '@tensorflow/tfjs';
import { SimpleStatistics } from 'simple-statistics';

export interface SSPAnalysisResult {
  itemId: string;
  recommendedSSP: number;
  confidence: number;
  method: 'vsoe' | 'statistical' | 'ml_predicted' | 'manual';
  evidence: {
    transactionCount: number;
    priceRange: { min: number; max: number };
    variance: number;
    outliers: number[];
  };
  vsoeStatus?: {
    hasVSOE: boolean;
    vsoePrice?: number;
    criteria: {
      volume: boolean;
      pricing: boolean;
      revenue: boolean;
    };
  };
  pricingBands?: {
    q1: number;
    median: number;
    q3: number;
    recommendedRange: { min: number; max: number };
  };
}

export class SSPAnalyticsEngine {
  private mlModel?: tf.LayersModel;
  
  constructor(
    private db: Database,
    private organizationId: string
  ) {}

  // Main SSP calculation method
  async calculateSSP(
    itemId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      method?: 'auto' | 'vsoe' | 'statistical' | 'ml';
      includeCompetitorPricing?: boolean;
    }
  ): Promise<SSPAnalysisResult> {
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate || new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year back

    // Step 1: Gather historical transaction data
    const transactions = await this.getHistoricalTransactions(itemId, startDate, endDate);

    if (transactions.length === 0) {
      throw new Error(`No transaction history found for item ${itemId}`);
    }

    // Step 2: Perform VSOE analysis
    const vsoeAnalysis = await this.performVSOEAnalysis(itemId, transactions);

    // Step 3: Statistical analysis
    const statisticalAnalysis = this.performStatisticalAnalysis(transactions);

    // Step 4: ML prediction (if model available)
    let mlPrediction;
    if (this.mlModel && options?.method !== 'vsoe' && options?.method !== 'statistical') {
      mlPrediction = await this.predictSSPWithML(itemId, transactions);
    }

    // Step 5: Competitor pricing analysis (if requested)
    let competitorAnalysis;
    if (options?.includeCompetitorPricing) {
      competitorAnalysis = await this.analyzeCompetitorPricing(itemId);
    }

    // Step 6: Determine best SSP based on available evidence
    const result = this.determineBestSSP({
      vsoeAnalysis,
      statisticalAnalysis,
      mlPrediction,
      competitorAnalysis,
      method: options?.method || 'auto'
    });

    // Step 7: Check for exceptions
    await this.checkForExceptions(itemId, result);

    // Step 8: Save results
    await this.saveSSPAnalysisResults(itemId, result);

    return result;
  }

  // VSOE Analysis
  private async performVSOEAnalysis(
    itemId: string,
    transactions: any[]
  ): Promise<{
    hasVSOE: boolean;
    vsoePrice?: number;
    confidence: number;
    criteria: {
      volume: boolean;
      pricing: boolean;
      revenue: boolean;
    };
  }> {
    // Separate standalone vs bundled sales
    const standaloneSales = transactions.filter(t => t.isStandalone);
    const bundledSales = transactions.filter(t => !t.isStandalone);

    // VSOE requires sufficient standalone sales (typically 80% or more)
    const standalonePercentage = standaloneSales.length / transactions.length;
    const meetsVolumeCriteria = standalonePercentage >= 0.8 && standaloneSales.length >= 10;

    if (!meetsVolumeCriteria) {
      return {
        hasVSOE: false,
        confidence: 0,
        criteria: {
          volume: false,
          pricing: false,
          revenue: false
        }
      };
    }

    // Calculate price consistency
    const prices = standaloneSales.map(s => s.unitPrice);
    const mean = SimpleStatistics.mean(prices);
    const stdDev = SimpleStatistics.standardDeviation(prices);
    const cv = stdDev / mean; // Coefficient of variation

    // VSOE requires consistent pricing (CV typically < 0.15)
    const meetsPricingCriteria = cv < 0.15;

    // Revenue criteria - prices should be substantive
    const meetsRevenueCriteria = mean > 0 && standaloneSales.every(s => s.unitPrice > mean * 0.7);

    const hasVSOE = meetsVolumeCriteria && meetsPricingCriteria && meetsRevenueCriteria;

    return {
      hasVSOE,
      vsoePrice: hasVSOE ? mean : undefined,
      confidence: hasVSOE ? 1 - cv : 0,
      criteria: {
        volume: meetsVolumeCriteria,
        pricing: meetsPricingCriteria,
        revenue: meetsRevenueCriteria
      }
    };
  }

  // Statistical Analysis with outlier detection
  private performStatisticalAnalysis(transactions: any[]): {
    recommendedPrice: number;
    confidence: number;
    pricingBands: {
      q1: number;
      median: number;
      q3: number;
      iqr: number;
      lowerBound: number;
      upperBound: number;
    };
    outliers: number[];
    distribution: {
      skewness: number;
      kurtosis: number;
      isNormal: boolean;
    };
  } {
    const prices = transactions.map(t => t.unitPrice).sort((a, b) => a - b);

    // Calculate quartiles
    const q1 = SimpleStatistics.quantile(prices, 0.25);
    const median = SimpleStatistics.quantile(prices, 0.5);
    const q3 = SimpleStatistics.quantile(prices, 0.75);
    const iqr = q3 - q1;

    // Outlier detection using IQR method
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = prices.filter(p => p < lowerBound || p > upperBound);

    // Remove outliers for cleaner statistics
    const cleanPrices = prices.filter(p => p >= lowerBound && p <= upperBound);

    // Distribution analysis
    const skewness = SimpleStatistics.sampleSkewness(cleanPrices);
    const kurtosis = SimpleStatistics.sampleKurtosis ? 
      SimpleStatistics.sampleKurtosis(cleanPrices) : 0;

    // Test for normality (simplified)
    const isNormal = Math.abs(skewness) < 0.5 && Math.abs(kurtosis - 3) < 0.5;

    // Determine recommended price based on distribution
    let recommendedPrice;
    let confidence;

    if (isNormal) {
      // Use mean for normal distribution
      recommendedPrice = SimpleStatistics.mean(cleanPrices);
      confidence = 0.9;
    } else if (skewness > 0.5) {
      // Right-skewed: use median
      recommendedPrice = median;
      confidence = 0.8;
    } else {
      // Use trimmed mean
      recommendedPrice = SimpleStatistics.mean(
        cleanPrices.slice(
          Math.floor(cleanPrices.length * 0.1),
          Math.ceil(cleanPrices.length * 0.9)
        )
      );
      confidence = 0.85;
    }

    return {
      recommendedPrice,
      confidence,
      pricingBands: {
        q1,
        median,
        q3,
        iqr,
        lowerBound,
        upperBound
      },
      outliers,
      distribution: {
        skewness,
        kurtosis,
        isNormal
      }
    };
  }

  // Machine Learning SSP Prediction
  private async predictSSPWithML(
    itemId: string,
    transactions: any[]
  ): Promise<{
    predictedPrice: number;
    confidence: number;
    features: any;
  }> {
    if (!this.mlModel) {
      await this.loadOrTrainModel();
    }

    // Extract features for prediction
    const features = await this.extractMLFeatures(itemId, transactions);

    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(features);

    // Make prediction
    const prediction = this.mlModel!.predict(
      tf.tensor2d([normalizedFeatures])
    ) as tf.Tensor;

    const predictedPrice = (await prediction.data())[0];

    // Calculate confidence based on model performance and data quality
    const confidence = this.calculateMLConfidence(features, transactions);

    return {
      predictedPrice,
      confidence,
      features
    };
  }

  // ML Model Training
  async trainSSPModel(
    trainingData: Array<{
      itemId: string;
      features: number[];
      actualSSP: number;
    }>
  ): Promise<void> {
    // Prepare training data
    const features = trainingData.map(d => d.features);
    const labels = trainingData.map(d => d.actualSSP);

    // Create model architecture
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [features[0].length],
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'linear'
        })
      ]
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse']
    });

    // Train model
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
        }
      }
    });

    // Save model
    this.mlModel = model;
    await this.saveModel(model);

    // Cleanup tensors
    xs.dispose();
    ys.dispose();
  }

  // Exception Detection
  private async checkForExceptions(
    itemId: string,
    analysis: SSPAnalysisResult
  ): Promise<void> {
    const exceptions: Array<{
      type: string;
      severity: string;
      description: string;
      metrics: any;
    }> = [];

    // Check for high variance
    if (analysis.evidence.variance > 0.3) {
      exceptions.push({
        type: 'high_variance',
        severity: 'medium',
        description: 'Price variance exceeds acceptable threshold',
        metrics: { variance: analysis.evidence.variance }
      });
    }

    // Check for insufficient data
    if (analysis.evidence.transactionCount < 5) {
      exceptions.push({
        type: 'insufficient_data',
        severity: 'high',
        description: 'Insufficient transaction history for reliable SSP',
        metrics: { transactionCount: analysis.evidence.transactionCount }
      });
    }

    // Check for outliers
    if (analysis.evidence.outliers.length > analysis.evidence.transactionCount * 0.1) {
      exceptions.push({
        type: 'excessive_outliers',
        severity: 'medium',
        description: 'Excessive price outliers detected',
        metrics: {
          outlierCount: analysis.evidence.outliers.length,
          outlierPercentage: (analysis.evidence.outliers.length / analysis.evidence.transactionCount) * 100
        }
      });
    }

    // Save exceptions
    for (const exception of exceptions) {
      await this.saveSSPException(itemId, exception);
    }
  }

  // Competitor Pricing Integration
  private async analyzeCompetitorPricing(itemId: string): Promise<{
    competitorPrices: Array<{
      competitor: string;
      price: number;
      source: string;
      date: Date;
    }>;
    marketPosition: 'below' | 'at' | 'above';
    recommendedAdjustment?: number;
  }> {
    // Fetch competitor pricing data (implement based on your data sources)
    const competitorPrices = await this.fetchCompetitorPrices(itemId);

    if (competitorPrices.length === 0) {
      return {
        competitorPrices: [],
        marketPosition: 'at',
        recommendedAdjustment: undefined
      };
    }

    const avgCompetitorPrice = SimpleStatistics.mean(
      competitorPrices.map(cp => cp.price)
    );

    // Determine market position
    // This would need actual SSP to compare
    const currentSSP = await this.getCurrentSSP(itemId);
    
    let marketPosition: 'below' | 'at' | 'above';
    if (currentSSP < avgCompetitorPrice * 0.9) {
      marketPosition = 'below';
    } else if (currentSSP > avgCompetitorPrice * 1.1) {
      marketPosition = 'above';
    } else {
      marketPosition = 'at';
    }

    const recommendedAdjustment = marketPosition !== 'at' ?
      avgCompetitorPrice - currentSSP : undefined;

    return {
      competitorPrices,
      marketPosition,
      recommendedAdjustment
    };
  }

  // Helper methods
  private extractMLFeatures(itemId: string, transactions: any[]): number[] {
    const prices = transactions.map(t => t.unitPrice);
    
    return [
      // Basic statistics
      SimpleStatistics.mean(prices),
      SimpleStatistics.median(prices),
      SimpleStatistics.standardDeviation(prices),
      
      // Transaction patterns
      transactions.length,
      transactions.filter(t => t.isStandalone).length,
      
      // Time-based features
      this.calculateSeasonality(transactions),
      this.calculateTrend(transactions),
      
      // Product features (would need to fetch from items table)
      // These would be encoded categorical features
      0, // product category
      0, // product type
      0  // product tier
    ];
  }

  private calculateSeasonality(transactions: any[]): number {
    // Implement seasonality detection
    // Return seasonality score (0-1)
    return 0;
  }

  private calculateTrend(transactions: any[]): number {
    // Calculate price trend over time
    // Return trend coefficient
    return 0;
  }
}
```

### SSP Exception Monitoring
```typescript
// packages/business/src/services/ssp-exception-monitor.ts
export class SSPExceptionMonitor {
  constructor(
    private analyticsEngine: SSPAnalyticsEngine,
    private notificationService: NotificationService
  ) {}

  async monitorSSPHealth(): Promise<{
    healthy: number;
    warnings: number;
    critical: number;
    items: Array<{
      itemId: string;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    }>;
  }> {
    // Get all active items
    const items = await this.getActiveItems();
    
    const results = {
      healthy: 0,
      warnings: 0,
      critical: 0,
      items: [] as any[]
    };

    for (const item of items) {
      const health = await this.assessItemSSPHealth(item.id);
      
      if (health.status === 'healthy') {
        results.healthy++;
      } else if (health.status === 'warning') {
        results.warnings++;
      } else {
        results.critical++;
        
        // Send alert for critical items
        await this.notificationService.sendAlert({
          type: 'ssp_critical',
          itemId: item.id,
          issues: health.issues
        });
      }
      
      results.items.push(health);
    }

    return results;
  }

  private async assessItemSSPHealth(itemId: string): Promise<{
    itemId: string;
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for recent SSP evidence
    const lastSSPUpdate = await this.getLastSSPUpdate(itemId);
    const daysSinceUpdate = (Date.now() - lastSSPUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate > 180) {
      issues.push('SSP evidence is stale (>6 months)');
      status = 'critical';
    } else if (daysSinceUpdate > 90) {
      issues.push('SSP evidence aging (>3 months)');
      status = 'warning';
    }

    // Check for open exceptions
    const openExceptions = await this.getOpenExceptions(itemId);
    if (openExceptions.some(e => e.severity === 'critical')) {
      issues.push('Critical SSP exceptions unresolved');
      status = 'critical';
    } else if (openExceptions.length > 0) {
      issues.push(`${openExceptions.length} SSP exceptions pending`);
      if (status === 'healthy') status = 'warning';
    }

    // Check price stability
    const priceVolatility = await this.calculatePriceVolatility(itemId);
    if (priceVolatility > 0.3) {
      issues.push('High price volatility detected');
      if (status === 'healthy') status = 'warning';
    }

    return {
      itemId,
      status,
      issues
    };
  }
}
```

### Files to Create
- `packages/database/src/db/schema/ssp-analytics.ts`
- `packages/business/src/services/ssp-analytics-engine.ts`
- `packages/business/src/services/ssp-exception-monitor.ts`
- `packages/business/src/services/ssp-ml-trainer.ts`
- `packages/api-service/src/services/ssp-analytics-service.ts`
- `packages/trpc/src/routers/ssp-analytics.ts`
- `packages/business/src/services/__tests__/ssp-analytics-engine.test.ts`

### Definition of Done
- [ ] Automated SSP calculation from historical data working
- [ ] VSOE analysis meeting accounting standards
- [ ] Pricing band analysis with outlier detection functional
- [ ] Exception reporting and alerting system active
- [ ] ML model trained and making predictions
- [ ] Competitor pricing integration (if data available)
- [ ] Historical trend analysis implemented
- [ ] Approval workflow for SSP changes
- [ ] Real-time SSP recommendations available
- [ ] Analytics dashboard displaying key metrics
- [ ] Unit tests with >85% coverage
- [ ] Performance optimized for large datasets
- [ ] Documentation complete with VSOE criteria