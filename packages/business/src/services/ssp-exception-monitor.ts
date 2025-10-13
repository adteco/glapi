import { Database } from '@glapi/database';
import { 
  sspExceptions, 
  sspCalculationRuns,
  vsoeEvidence,
  sspPricingBands,
  items,
  businessTransactions,
  SSPException,
  NewSSPException,
  ExceptionTypes,
  ExceptionSeverity
} from '@glapi/database/schema';
import { eq, and, or, gte, lte, isNull, desc, sql, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { 
  EmailNotificationService,
  MockEmailNotificationService
} from './email-notification-service';
import { 
  SlackNotificationService,
  MockSlackNotificationService
} from './slack-notification-service';

interface ExceptionDetectionConfig {
  insufficientDataThreshold: number;
  highVariabilityThreshold: number;
  staleDataDays: number;
  priceVolatilityThreshold: number;
  minTransactionsRequired: number;
  outlierPercentageThreshold: number;
}

export interface ExceptionAlert {
  exceptionId: string;
  itemId: string;
  itemName: string;
  exceptionType: string;
  severity: string;
  message: string;
  impactedRevenue?: string;
  recommendedActions: string[];
}

export interface ExceptionTrend {
  exceptionType: string;
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

export interface ExceptionSummary {
  totalExceptions: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  unresolvedCount: number;
  totalImpactedRevenue: string;
  topExceptionTypes: Array<{ type: string; count: number }>;
  itemsRequiringAttention: string[];
}

export class SSPExceptionMonitor {
  private db: typeof Database;
  private emailService: EmailNotificationService;
  private slackService: SlackNotificationService;
  private config: ExceptionDetectionConfig;

  constructor(db: typeof Database) {
    this.db = db;
    this.emailService = new MockEmailNotificationService();
    this.slackService = new MockSlackNotificationService();
    this.config = {
      insufficientDataThreshold: 5,
      highVariabilityThreshold: 0.3,
      staleDataDays: 90,
      priceVolatilityThreshold: 0.25,
      minTransactionsRequired: 10,
      outlierPercentageThreshold: 0.15
    };
  }

  /**
   * Run comprehensive exception detection for all items
   */
  async detectExceptions(
    organizationId: string,
    calculationRunId: string
  ): Promise<SSPException[]> {
    const exceptions: NewSSPException[] = [];

    // Check for VSOE failures
    const vsoeFailures = await this.detectVSOEFailures(organizationId, calculationRunId);
    exceptions.push(...vsoeFailures);

    // Check for insufficient data
    const insufficientData = await this.detectInsufficientData(organizationId, calculationRunId);
    exceptions.push(...insufficientData);

    // Check for high price variability
    const highVariability = await this.detectHighVariability(organizationId, calculationRunId);
    exceptions.push(...highVariability);

    // Check for stale data
    const staleData = await this.detectStaleData(organizationId);
    exceptions.push(...staleData);

    // Check for price volatility
    const priceVolatility = await this.detectPriceVolatility(organizationId, calculationRunId);
    exceptions.push(...priceVolatility);

    // Check for outliers
    const outliers = await this.detectOutliers(organizationId, calculationRunId);
    exceptions.push(...outliers);

    // Insert all exceptions
    const insertedExceptions = await this.insertExceptions(exceptions);

    // Send alerts for critical exceptions
    await this.sendAlerts(insertedExceptions.filter(e => e.severity === ExceptionSeverity.CRITICAL));

    return insertedExceptions;
  }

  /**
   * Detect VSOE failures
   */
  private async detectVSOEFailures(
    organizationId: string,
    calculationRunId: string
  ): Promise<NewSSPException[]> {
    const vsoeResults = await this.db.select({
      itemId: vsoeEvidence.itemId,
      itemName: items.name,
      failureReason: vsoeEvidence.failureReason,
      standalonePercentage: vsoeEvidence.standalonePercentage,
      coefficientOfVariation: vsoeEvidence.coefficientOfVariation,
      standaloneTransactions: vsoeEvidence.standaloneTransactions
    })
    .from(vsoeEvidence)
    .innerJoin(items, eq(items.id, vsoeEvidence.itemId))
    .where(and(
      eq(vsoeEvidence.organizationId, organizationId),
      eq(vsoeEvidence.calculationRunId, calculationRunId),
      eq(vsoeEvidence.meetsVSOECriteria, false)
    ));

    return vsoeResults.map(result => ({
      id: createId(),
      organizationId,
      itemId: result.itemId,
      calculationRunId,
      exceptionType: ExceptionTypes.VSOE_FAILURE,
      severity: ExceptionSeverity.WARNING,
      message: `VSOE criteria not met for ${result.itemName}: ${result.failureReason}`,
      details: {
        failureReason: result.failureReason,
        standalonePercentage: result.standalonePercentage,
        coefficientOfVariation: result.coefficientOfVariation,
        standaloneTransactions: result.standaloneTransactions
      },
      dataPoints: result.standaloneTransactions,
      priceVariability: result.coefficientOfVariation,
      status: 'open',
      recommendedActions: [
        'Review pricing consistency for standalone sales',
        'Consider using statistical SSP method instead',
        'Analyze bundling patterns affecting standalone percentage'
      ],
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Detect insufficient data
   */
  private async detectInsufficientData(
    organizationId: string,
    calculationRunId: string
  ): Promise<NewSSPException[]> {
    const lowDataItems = await this.db.select({
      itemId: sspPricingBands.itemId,
      itemName: items.name,
      dataPoints: sql<number>`COUNT(DISTINCT transaction_id)`.as('dataPoints')
    })
    .from(sspPricingBands)
    .innerJoin(items, eq(items.id, sspPricingBands.itemId))
    .where(and(
      eq(sspPricingBands.organizationId, organizationId),
      eq(sspPricingBands.calculationRunId, calculationRunId)
    ))
    .groupBy(sspPricingBands.itemId, items.name)
    .having(sql`COUNT(DISTINCT transaction_id) < ${this.config.insufficientDataThreshold}`);

    return lowDataItems.map(item => ({
      id: createId(),
      organizationId,
      itemId: item.itemId,
      calculationRunId,
      exceptionType: ExceptionTypes.INSUFFICIENT_DATA,
      severity: ExceptionSeverity.WARNING,
      message: `Insufficient data for reliable SSP calculation: only ${item.dataPoints} transactions`,
      details: {
        dataPoints: item.dataPoints,
        threshold: this.config.insufficientDataThreshold
      },
      dataPoints: item.dataPoints,
      status: 'open',
      recommendedActions: [
        'Gather more transaction data before finalizing SSP',
        'Consider using management estimate with documentation',
        'Review if item should be bundled with similar products'
      ],
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Detect high price variability
   */
  private async detectHighVariability(
    organizationId: string,
    calculationRunId: string
  ): Promise<NewSSPException[]> {
    const highVariabilityItems = await this.db.select({
      itemId: sspPricingBands.itemId,
      itemName: items.name,
      recommendedSSP: sspPricingBands.recommendedSSP,
      p5Price: sspPricingBands.p5Price,
      p95Price: sspPricingBands.p95Price,
      recommendationConfidence: sspPricingBands.recommendationConfidence
    })
    .from(sspPricingBands)
    .innerJoin(items, eq(items.id, sspPricingBands.itemId))
    .where(and(
      eq(sspPricingBands.organizationId, organizationId),
      eq(sspPricingBands.calculationRunId, calculationRunId),
      sql`(${sspPricingBands.p95Price} - ${sspPricingBands.p5Price}) / ${sspPricingBands.recommendedSSP} > ${this.config.highVariabilityThreshold}`
    ));

    return highVariabilityItems.map(item => ({
      id: createId(),
      organizationId,
      itemId: item.itemId,
      calculationRunId,
      exceptionType: ExceptionTypes.HIGH_VARIABILITY,
      severity: ExceptionSeverity.WARNING,
      message: `High price variability detected for ${item.itemName}`,
      details: {
        p5Price: item.p5Price,
        p95Price: item.p95Price,
        recommendedSSP: item.recommendedSSP,
        confidence: item.recommendationConfidence,
        variabilityRatio: ((Number(item.p95Price) - Number(item.p5Price)) / Number(item.recommendedSSP)).toFixed(4)
      },
      priceVariability: ((Number(item.p95Price) - Number(item.p5Price)) / Number(item.recommendedSSP)).toString(),
      status: 'open',
      recommendedActions: [
        'Review pricing strategy and discount policies',
        'Analyze customer segments for price discrimination',
        'Consider implementing pricing tiers or bands'
      ],
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Detect stale data
   */
  private async detectStaleData(organizationId: string): Promise<NewSSPException[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.staleDataDays);

    const staleItems = await this.db.select({
      itemId: items.id,
      itemName: items.name,
      lastActivity: sql<Date>`MAX(t.transaction_date)`.as('lastActivity')
    })
    .from(items)
    .leftJoin(sql`transactions t`, sql`t.item_id = ${items.id}`)
    .where(eq(items.organizationId, organizationId))
    .groupBy(items.id, items.name)
    .having(sql`MAX(t.transaction_date) < ${cutoffDate.toISOString()} OR MAX(t.transaction_date) IS NULL`);

    return staleItems.map(item => {
      const daysSince = item.lastActivity 
        ? Math.floor((Date.now() - item.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: createId(),
        organizationId,
        itemId: item.itemId,
        calculationRunId: null,
        exceptionType: ExceptionTypes.STALE_DATA,
        severity: daysSince && daysSince > 180 ? ExceptionSeverity.CRITICAL : ExceptionSeverity.WARNING,
        message: `No recent transactions for ${item.itemName}${daysSince ? ` (${daysSince} days)` : ''}`,
        details: {
          lastTransactionDate: item.lastActivity?.toISOString(),
          daysSinceLastTransaction: daysSince,
          threshold: this.config.staleDataDays
        },
        lastTransactionDate: item.lastActivity,
        daysSinceLastTransaction: daysSince,
        status: 'open',
        recommendedActions: [
          'Verify if product is still actively sold',
          'Review SSP validity and consider updating',
          'Check for seasonal patterns in sales'
        ],
        alertSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
  }

  /**
   * Detect price volatility
   */
  private async detectPriceVolatility(
    organizationId: string,
    calculationRunId: string
  ): Promise<NewSSPException[]> {
    const volatileItems = await this.db.select({
      itemId: sspPricingBands.itemId,
      itemName: items.name,
      trendDirection: sspPricingBands.trendDirection,
      trendStrength: sspPricingBands.trendStrength,
      hasSeasonality: sspPricingBands.hasSeasonality,
      recommendedSSP: sspPricingBands.recommendedSSP
    })
    .from(sspPricingBands)
    .innerJoin(items, eq(items.id, sspPricingBands.itemId))
    .where(and(
      eq(sspPricingBands.organizationId, organizationId),
      eq(sspPricingBands.calculationRunId, calculationRunId),
      or(
        and(
          inArray(sspPricingBands.trendDirection, ['increasing', 'decreasing']),
          gte(sspPricingBands.trendStrength, String(this.config.priceVolatilityThreshold))
        ),
        eq(sspPricingBands.hasSeasonality, true)
      )
    ));

    return volatileItems.map(item => ({
      id: createId(),
      organizationId,
      itemId: item.itemId,
      calculationRunId,
      exceptionType: ExceptionTypes.PRICE_VOLATILITY,
      severity: Number(item.trendStrength) > 0.5 ? ExceptionSeverity.CRITICAL : ExceptionSeverity.WARNING,
      message: `Price volatility detected for ${item.itemName}: ${item.trendDirection} trend${item.hasSeasonality ? ' with seasonality' : ''}`,
      details: {
        trendDirection: item.trendDirection,
        trendStrength: item.trendStrength,
        hasSeasonality: item.hasSeasonality,
        currentSSP: item.recommendedSSP
      },
      priceVariability: item.trendStrength,
      status: 'open',
      recommendedActions: [
        'Review pricing strategy for stability',
        'Consider implementing price controls',
        item.hasSeasonality ? 'Implement seasonal pricing adjustments' : 'Analyze market conditions',
        'Update SSP calculation frequency'
      ],
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Detect outliers
   */
  private async detectOutliers(
    organizationId: string,
    calculationRunId: string
  ): Promise<NewSSPException[]> {
    const outlierItems = await this.db.select({
      itemId: sspPricingBands.itemId,
      itemName: items.name,
      outlierCount: sspPricingBands.outlierCount,
      outlierPercentage: sspPricingBands.outlierPercentage,
      outlierTransactionIds: sspPricingBands.outlierTransactionIds,
      recommendedSSP: sspPricingBands.recommendedSSP
    })
    .from(sspPricingBands)
    .innerJoin(items, eq(items.id, sspPricingBands.itemId))
    .where(and(
      eq(sspPricingBands.organizationId, organizationId),
      eq(sspPricingBands.calculationRunId, calculationRunId),
      gte(sspPricingBands.outlierPercentage, String(this.config.outlierPercentageThreshold * 100))
    ));

    return outlierItems.map(item => ({
      id: createId(),
      organizationId,
      itemId: item.itemId,
      calculationRunId,
      exceptionType: ExceptionTypes.OUTLIER,
      severity: Number(item.outlierPercentage) > 25 ? ExceptionSeverity.CRITICAL : ExceptionSeverity.WARNING,
      message: `High outlier rate (${item.outlierPercentage}%) detected for ${item.itemName}`,
      details: {
        outlierCount: item.outlierCount,
        outlierPercentage: item.outlierPercentage,
        outlierTransactionIds: item.outlierTransactionIds,
        threshold: this.config.outlierPercentageThreshold * 100
      },
      dataPoints: item.outlierCount,
      status: 'open',
      recommendedActions: [
        'Review outlier transactions for data quality issues',
        'Check for special pricing agreements or promotions',
        'Consider using trimmed mean for SSP calculation',
        'Investigate potential data entry errors'
      ],
      alertSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Insert exceptions into database
   */
  private async insertExceptions(exceptions: NewSSPException[]): Promise<SSPException[]> {
    if (exceptions.length === 0) return [];

    const inserted = await this.db.insert(sspExceptions)
      .values(exceptions)
      .returning();

    return inserted;
  }

  /**
   * Send alerts for critical exceptions
   */
  private async sendAlerts(exceptions: SSPException[]): Promise<void> {
    if (exceptions.length === 0) return;

    const alerts: ExceptionAlert[] = exceptions.map(e => ({
      exceptionId: e.id,
      itemId: e.itemId,
      itemName: `Item ${e.itemId}`, // Would need to join with items table for actual name
      exceptionType: e.exceptionType,
      severity: e.severity,
      message: e.message,
      impactedRevenue: e.impactedRevenue || undefined,
      recommendedActions: (e.recommendedActions as string[]) || []
    }));

    // Send email alerts
    if (alerts.length > 0) {
      await this.emailService.sendEmail({
        to: 'ssp-alerts@example.com',
        subject: `SSP Exception Alert: ${alerts.length} exceptions detected`,
        body: JSON.stringify(alerts, null, 2)
      });
    }

    // Send Slack alerts for critical exceptions
    const criticalAlerts = alerts.filter(a => a.severity === ExceptionSeverity.CRITICAL);
    if (criticalAlerts.length > 0) {
      await this.slackService.sendMessage({
        channel: '#ssp-alerts',
        text: `🚨 Critical SSP Exceptions: ${criticalAlerts.length} critical issues detected`,
        attachments: criticalAlerts.map(alert => ({
          color: 'danger',
          title: alert.itemName,
          text: alert.message,
          fields: [
            { title: 'Type', value: alert.exceptionType, short: true },
            { title: 'Severity', value: alert.severity, short: true }
          ]
        }))
      });
    }

    // Mark alerts as sent
    const exceptionIds = exceptions.map(e => e.id);
    await this.db.update(sspExceptions)
      .set({ 
        alertSent: true, 
        alertSentAt: new Date(),
        updatedAt: new Date()
      })
      .where(inArray(sspExceptions.id, exceptionIds));
  }

  /**
   * Get exception summary for dashboard
   */
  async getExceptionSummary(organizationId: string): Promise<ExceptionSummary> {
    const exceptions = await this.db.select({
      id: sspExceptions.id,
      exceptionType: sspExceptions.exceptionType,
      severity: sspExceptions.severity,
      status: sspExceptions.status,
      impactedRevenue: sspExceptions.impactedRevenue,
      itemId: sspExceptions.itemId
    })
    .from(sspExceptions)
    .where(and(
      eq(sspExceptions.organizationId, organizationId),
      eq(sspExceptions.status, 'open')
    ));

    const typeCount = exceptions.reduce((acc, e) => {
      acc[e.exceptionType] = (acc[e.exceptionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topExceptionTypes = Object.entries(typeCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalImpactedRevenue = exceptions
      .reduce((sum, e) => sum + Number(e.impactedRevenue || 0), 0)
      .toFixed(2);

    const itemsRequiringAttention = [...new Set(exceptions
      .filter(e => e.severity === ExceptionSeverity.CRITICAL)
      .map(e => e.itemId))];

    return {
      totalExceptions: exceptions.length,
      criticalCount: exceptions.filter(e => e.severity === ExceptionSeverity.CRITICAL).length,
      warningCount: exceptions.filter(e => e.severity === ExceptionSeverity.WARNING).length,
      infoCount: exceptions.filter(e => e.severity === ExceptionSeverity.INFO).length,
      unresolvedCount: exceptions.filter(e => e.status === 'open').length,
      totalImpactedRevenue,
      topExceptionTypes,
      itemsRequiringAttention
    };
  }

  /**
   * Get exception trends over time
   */
  async getExceptionTrends(
    organizationId: string,
    days: number = 30
  ): Promise<ExceptionTrend[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const currentPeriod = await this.db.select({
      exceptionType: sspExceptions.exceptionType,
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(sspExceptions)
    .where(and(
      eq(sspExceptions.organizationId, organizationId),
      gte(sspExceptions.createdAt, cutoffDate)
    ))
    .groupBy(sspExceptions.exceptionType);

    const previousCutoff = new Date(cutoffDate);
    previousCutoff.setDate(previousCutoff.getDate() - days);

    const previousPeriod = await this.db.select({
      exceptionType: sspExceptions.exceptionType,
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(sspExceptions)
    .where(and(
      eq(sspExceptions.organizationId, organizationId),
      gte(sspExceptions.createdAt, previousCutoff),
      lte(sspExceptions.createdAt, cutoffDate)
    ))
    .groupBy(sspExceptions.exceptionType);

    const previousMap = new Map(previousPeriod.map(p => [p.exceptionType, p.count]));

    return currentPeriod.map(current => {
      const previous = previousMap.get(current.exceptionType) || 0;
      const changePercentage = previous > 0 
        ? ((current.count - previous) / previous) * 100 
        : 100;

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (changePercentage > 10) trend = 'increasing';
      else if (changePercentage < -10) trend = 'decreasing';
      else trend = 'stable';

      return {
        exceptionType: current.exceptionType,
        count: current.count,
        trend,
        changePercentage
      };
    });
  }

  /**
   * Acknowledge exception
   */
  async acknowledgeException(
    exceptionId: string,
    userId: string
  ): Promise<SSPException> {
    const [updated] = await this.db.update(sspExceptions)
      .set({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sspExceptions.id, exceptionId))
      .returning();

    return updated;
  }

  /**
   * Resolve exception
   */
  async resolveException(
    exceptionId: string,
    userId: string,
    resolutionNotes: string
  ): Promise<SSPException> {
    const [updated] = await this.db.update(sspExceptions)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date()
      })
      .where(eq(sspExceptions.id, exceptionId))
      .returning();

    return updated;
  }

  /**
   * Auto-resolve exceptions based on new data
   */
  async autoResolveExceptions(
    organizationId: string,
    calculationRunId: string
  ): Promise<number> {
    // Get current exceptions
    const openExceptions = await this.db.select()
      .from(sspExceptions)
      .where(and(
        eq(sspExceptions.organizationId, organizationId),
        inArray(sspExceptions.status, ['open', 'acknowledged'])
      ));

    let resolvedCount = 0;

    for (const exception of openExceptions) {
      let shouldResolve = false;
      let resolutionNotes = '';

      // Check if exception condition is resolved based on type
      switch (exception.exceptionType) {
        case ExceptionTypes.INSUFFICIENT_DATA:
          // Check if we now have sufficient data
          const dataCheck = await this.checkDataSufficiency(exception.itemId, organizationId);
          if (dataCheck.sufficient) {
            shouldResolve = true;
            resolutionNotes = `Data threshold met: ${dataCheck.count} transactions`;
          }
          break;

        case ExceptionTypes.STALE_DATA:
          // Check for recent transactions
          const recentCheck = await this.checkRecentTransactions(exception.itemId, organizationId);
          if (recentCheck.hasRecent) {
            shouldResolve = true;
            resolutionNotes = `New transactions detected: ${recentCheck.count} in last 30 days`;
          }
          break;

        case ExceptionTypes.VSOE_FAILURE:
          // Check if VSOE now passes
          const vsoeCheck = await this.checkVSOEStatus(exception.itemId, organizationId, calculationRunId);
          if (vsoeCheck.passes) {
            shouldResolve = true;
            resolutionNotes = `VSOE criteria now met with ${vsoeCheck.confidence} confidence`;
          }
          break;
      }

      if (shouldResolve) {
        await this.resolveException(
          exception.id,
          'system',
          `Auto-resolved: ${resolutionNotes}`
        );
        resolvedCount++;
      }
    }

    return resolvedCount;
  }

  /**
   * Helper: Check data sufficiency
   */
  private async checkDataSufficiency(
    itemId: string,
    organizationId: string
  ): Promise<{ sufficient: boolean; count: number }> {
    const result = await this.db.select({
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(businessTransactions)
    .where(and(
      eq(businessTransactions.entityId, itemId),
      eq(businessTransactions.subsidiaryId, organizationId)
    ))
    .execute();

    const count = result[0]?.count || 0;
    return {
      sufficient: count >= this.config.minTransactionsRequired,
      count
    };
  }

  /**
   * Helper: Check for recent transactions
   */
  private async checkRecentTransactions(
    itemId: string,
    organizationId: string
  ): Promise<{ hasRecent: boolean; count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await this.db.select({
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(businessTransactions)
    .where(and(
      eq(businessTransactions.entityId, itemId),
      eq(businessTransactions.subsidiaryId, organizationId),
      gte(businessTransactions.transactionDate, cutoffDate.toISOString().split('T')[0])
    ))
    .execute();

    const count = result[0]?.count || 0;
    return {
      hasRecent: count > 0,
      count
    };
  }

  /**
   * Helper: Check VSOE status
   */
  private async checkVSOEStatus(
    itemId: string,
    organizationId: string,
    calculationRunId: string
  ): Promise<{ passes: boolean; confidence: string }> {
    const result = await this.db.select({
      meetsVSOECriteria: vsoeEvidence.meetsVSOECriteria,
      vsoeConfidence: vsoeEvidence.vsoeConfidence
    })
    .from(vsoeEvidence)
    .where(and(
      eq(vsoeEvidence.itemId, itemId),
      eq(vsoeEvidence.organizationId, organizationId),
      eq(vsoeEvidence.calculationRunId, calculationRunId)
    ))
    .limit(1);

    if (result.length === 0) {
      return { passes: false, confidence: '0' };
    }

    return {
      passes: result[0].meetsVSOECriteria,
      confidence: result[0].vsoeConfidence
    };
  }
}

