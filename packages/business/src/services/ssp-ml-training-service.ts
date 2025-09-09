import * as tf from '@tensorflow/tfjs-node';
import { Database } from '@glapi/database';
import { 
  sspCalculationRuns,
  sspPricingBands,
  vsoeEvidence,
  items,
  SSPCalculationRun
} from '@glapi/database/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

interface TrainingData {
  features: number[][];
  labels: number[];
  itemIds: string[];
  featureNames: string[];
}

interface ModelMetrics {
  mse: number;
  mae: number;
  r2Score: number;
  accuracy: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface PredictionResult {
  itemId: string;
  predictedSSP: number;
  confidence: number;
  predictionInterval: {
    lower: number;
    upper: number;
  };
}

interface ModelConfig {
  inputDim: number;
  hiddenLayers: number[];
  dropout: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

export class SSPMLTrainingService {
  private db: typeof Database;
  private model: tf.LayersModel | null = null;
  private modelVersion: string = '1.0.0';
  private featureScaler: { mean: number[]; std: number[] } | null = null;
  private labelScaler: { mean: number; std: number } | null = null;

  constructor(db: typeof Database) {
    this.db = db;
  }

  /**
   * Train ML model for SSP prediction
   */
  async trainModel(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    modelId: string;
    metrics: ModelMetrics;
    featureImportance: FeatureImportance[];
  }> {
    console.log(`Training SSP ML model for organization ${organizationId}`);

    // Prepare training data
    const trainingData = await this.prepareTrainingData(organizationId, startDate, endDate);
    
    if (trainingData.features.length < 100) {
      throw new Error('Insufficient training data. Need at least 100 samples.');
    }

    // Create and compile model
    const modelConfig: ModelConfig = {
      inputDim: trainingData.features[0].length,
      hiddenLayers: [128, 64, 32],
      dropout: 0.2,
      learningRate: 0.001,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2
    };

    this.model = this.createModel(modelConfig);

    // Normalize features and labels
    const { normalizedFeatures, normalizedLabels } = this.normalizeData(
      trainingData.features,
      trainingData.labels
    );

    // Convert to tensors
    const featureTensor = tf.tensor2d(normalizedFeatures);
    const labelTensor = tf.tensor2d(normalizedLabels, [normalizedLabels.length, 1]);

    // Train model
    const history = await this.model.fit(featureTensor, labelTensor, {
      epochs: modelConfig.epochs,
      batchSize: modelConfig.batchSize,
      validationSplit: modelConfig.validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`);
          }
        }
      }
    });

    // Calculate metrics
    const metrics = await this.evaluateModel(
      this.model,
      normalizedFeatures,
      normalizedLabels,
      trainingData.labels
    );

    // Calculate feature importance using permutation importance
    const featureImportance = await this.calculateFeatureImportance(
      this.model,
      normalizedFeatures,
      normalizedLabels,
      trainingData.featureNames
    );

    // Save model
    const modelId = createId();
    await this.saveModel(modelId, organizationId);

    // Update calculation run with model info
    await this.updateCalculationRun(organizationId, modelId, metrics, featureImportance);

    // Clean up tensors
    featureTensor.dispose();
    labelTensor.dispose();

    return {
      modelId,
      metrics,
      featureImportance
    };
  }

  /**
   * Prepare training data from historical transactions
   */
  private async prepareTrainingData(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<TrainingData> {
    // Fetch historical pricing data with features
    const data = await this.db.select({
      itemId: items.id,
      itemName: items.name,
      itemType: items.type,
      category: items.category,
      price: sql<number>`t.price`.as('price'),
      quantity: sql<number>`t.quantity`.as('quantity'),
      discount: sql<number>`t.discount_percentage`.as('discount'),
      customerSegment: sql<string>`c.segment`.as('customerSegment'),
      contractValue: sql<number>`con.total_value`.as('contractValue'),
      contractDuration: sql<number>`con.duration_months`.as('contractDuration'),
      isBundle: sql<boolean>`t.is_bundle`.as('isBundle'),
      seasonality: sql<number>`EXTRACT(MONTH FROM t.transaction_date)`.as('seasonality'),
      dayOfWeek: sql<number>`EXTRACT(DOW FROM t.transaction_date)`.as('dayOfWeek'),
      quarterlyVolume: sql<number>`
        COUNT(*) OVER (
          PARTITION BY t.item_id 
          ORDER BY DATE_TRUNC('quarter', t.transaction_date)
          ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
        )
      `.as('quarterlyVolume'),
      priceVariability: sql<number>`
        STDDEV(t.price) OVER (
          PARTITION BY t.item_id
          ORDER BY t.transaction_date
          ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
        )
      `.as('priceVariability')
    })
    .from(sql`transactions t`)
    .innerJoin(items, eq(items.id, sql`t.item_id`))
    .leftJoin(sql`customers c`, eq(sql`c.id`, sql`t.customer_id`))
    .leftJoin(sql`contracts con`, eq(sql`con.id`, sql`t.contract_id`))
    .where(and(
      eq(items.organizationId, organizationId),
      gte(sql`t.transaction_date`, startDate),
      sql`t.transaction_date <= ${endDate}`,
      sql`t.price > 0`
    ))
    .execute();

    // Encode categorical features
    const customerSegmentMap = new Map<string, number>();
    const itemTypeMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    
    let segmentIndex = 0;
    let typeIndex = 0;
    let categoryIndex = 0;

    const features: number[][] = [];
    const labels: number[] = [];
    const itemIds: string[] = [];

    for (const row of data) {
      // Encode customer segment
      if (!customerSegmentMap.has(row.customerSegment || 'unknown')) {
        customerSegmentMap.set(row.customerSegment || 'unknown', segmentIndex++);
      }
      
      // Encode item type
      if (!itemTypeMap.has(row.itemType || 'unknown')) {
        itemTypeMap.set(row.itemType || 'unknown', typeIndex++);
      }
      
      // Encode category
      if (!categoryMap.has(row.category || 'unknown')) {
        categoryMap.set(row.category || 'unknown', categoryIndex++);
      }

      // Create feature vector
      const featureVector = [
        row.quantity || 0,
        row.discount || 0,
        customerSegmentMap.get(row.customerSegment || 'unknown')!,
        itemTypeMap.get(row.itemType || 'unknown')!,
        categoryMap.get(row.category || 'unknown')!,
        row.contractValue || 0,
        row.contractDuration || 0,
        row.isBundle ? 1 : 0,
        row.seasonality || 0,
        row.dayOfWeek || 0,
        row.quarterlyVolume || 0,
        row.priceVariability || 0
      ];

      features.push(featureVector);
      labels.push(row.price);
      itemIds.push(row.itemId);
    }

    const featureNames = [
      'quantity',
      'discount',
      'customerSegment',
      'itemType',
      'category',
      'contractValue',
      'contractDuration',
      'isBundle',
      'seasonality',
      'dayOfWeek',
      'quarterlyVolume',
      'priceVariability'
    ];

    return {
      features,
      labels,
      itemIds,
      featureNames
    };
  }

  /**
   * Create neural network model
   */
  private createModel(config: ModelConfig): tf.LayersModel {
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      units: config.hiddenLayers[0],
      activation: 'relu',
      inputShape: [config.inputDim],
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    model.add(tf.layers.dropout({ rate: config.dropout }));
    model.add(tf.layers.batchNormalization());

    // Hidden layers
    for (let i = 1; i < config.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: config.hiddenLayers[i],
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      
      model.add(tf.layers.dropout({ rate: config.dropout }));
      model.add(tf.layers.batchNormalization());
    }

    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(config.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  /**
   * Normalize features and labels
   */
  private normalizeData(
    features: number[][],
    labels: number[]
  ): {
    normalizedFeatures: number[][];
    normalizedLabels: number[];
  } {
    // Calculate feature statistics
    const featureMean = features[0].map((_, colIndex) => {
      const column = features.map(row => row[colIndex]);
      return column.reduce((sum, val) => sum + val, 0) / column.length;
    });

    const featureStd = features[0].map((_, colIndex) => {
      const column = features.map(row => row[colIndex]);
      const mean = featureMean[colIndex];
      const variance = column.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / column.length;
      return Math.sqrt(variance) || 1; // Avoid division by zero
    });

    // Calculate label statistics
    const labelMean = labels.reduce((sum, val) => sum + val, 0) / labels.length;
    const labelVariance = labels.reduce((sum, val) => sum + Math.pow(val - labelMean, 2), 0) / labels.length;
    const labelStd = Math.sqrt(labelVariance) || 1;

    // Store scalers for later use
    this.featureScaler = { mean: featureMean, std: featureStd };
    this.labelScaler = { mean: labelMean, std: labelStd };

    // Normalize features
    const normalizedFeatures = features.map(row =>
      row.map((val, idx) => (val - featureMean[idx]) / featureStd[idx])
    );

    // Normalize labels
    const normalizedLabels = labels.map(val => (val - labelMean) / labelStd);

    return {
      normalizedFeatures,
      normalizedLabels
    };
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModel(
    model: tf.LayersModel,
    features: number[][],
    normalizedLabels: number[],
    originalLabels: number[]
  ): Promise<ModelMetrics> {
    // Make predictions
    const featureTensor = tf.tensor2d(features);
    const predictions = model.predict(featureTensor) as tf.Tensor;
    const normalizedPreds = await predictions.array() as number[][];
    
    // Denormalize predictions
    const denormalizedPreds = normalizedPreds.map(p => 
      p[0] * this.labelScaler!.std + this.labelScaler!.mean
    );

    // Calculate metrics
    const mse = originalLabels.reduce((sum, actual, i) => {
      const error = actual - denormalizedPreds[i];
      return sum + error * error;
    }, 0) / originalLabels.length;

    const mae = originalLabels.reduce((sum, actual, i) => {
      return sum + Math.abs(actual - denormalizedPreds[i]);
    }, 0) / originalLabels.length;

    // Calculate R² score
    const meanLabel = originalLabels.reduce((sum, val) => sum + val, 0) / originalLabels.length;
    const totalSS = originalLabels.reduce((sum, val) => sum + Math.pow(val - meanLabel, 2), 0);
    const residualSS = originalLabels.reduce((sum, actual, i) => {
      return sum + Math.pow(actual - denormalizedPreds[i], 2);
    }, 0);
    const r2Score = 1 - (residualSS / totalSS);

    // Calculate accuracy (within 10% threshold)
    const accurateCount = originalLabels.filter((actual, i) => {
      const pred = denormalizedPreds[i];
      const error = Math.abs(actual - pred) / actual;
      return error <= 0.1;
    }).length;
    const accuracy = accurateCount / originalLabels.length;

    // Clean up
    featureTensor.dispose();
    predictions.dispose();

    return {
      mse,
      mae,
      r2Score,
      accuracy
    };
  }

  /**
   * Calculate feature importance using permutation importance
   */
  private async calculateFeatureImportance(
    model: tf.LayersModel,
    features: number[][],
    labels: number[],
    featureNames: string[]
  ): Promise<FeatureImportance[]> {
    // Calculate baseline score
    const featureTensor = tf.tensor2d(features);
    const labelTensor = tf.tensor2d(labels, [labels.length, 1]);
    const baselineScore = await this.calculateScore(model, featureTensor, labelTensor);

    const importances: FeatureImportance[] = [];

    // Calculate importance for each feature
    for (let featureIdx = 0; featureIdx < featureNames.length; featureIdx++) {
      // Create permuted features
      const permutedFeatures = features.map(row => [...row]);
      const columnValues = permutedFeatures.map(row => row[featureIdx]);
      
      // Shuffle column values
      for (let i = columnValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [columnValues[i], columnValues[j]] = [columnValues[j], columnValues[i]];
      }
      
      // Replace column with shuffled values
      permutedFeatures.forEach((row, i) => {
        row[featureIdx] = columnValues[i];
      });

      // Calculate score with permuted feature
      const permutedTensor = tf.tensor2d(permutedFeatures);
      const permutedScore = await this.calculateScore(model, permutedTensor, labelTensor);
      
      // Calculate importance as decrease in performance
      const importance = baselineScore - permutedScore;
      importances.push({
        feature: featureNames[featureIdx],
        importance: Math.max(0, importance) // Ensure non-negative
      });

      permutedTensor.dispose();
    }

    // Normalize importances
    const totalImportance = importances.reduce((sum, item) => sum + item.importance, 0);
    if (totalImportance > 0) {
      importances.forEach(item => {
        item.importance = item.importance / totalImportance;
      });
    }

    // Sort by importance
    importances.sort((a, b) => b.importance - a.importance);

    // Clean up
    featureTensor.dispose();
    labelTensor.dispose();

    return importances;
  }

  /**
   * Calculate model score (negative MSE)
   */
  private async calculateScore(
    model: tf.LayersModel,
    features: tf.Tensor,
    labels: tf.Tensor
  ): Promise<number> {
    const predictions = model.predict(features) as tf.Tensor;
    const mse = tf.losses.meanSquaredError(labels, predictions);
    const score = -await mse.data();
    
    predictions.dispose();
    mse.dispose();
    
    return score[0];
  }

  /**
   * Make SSP predictions for items
   */
  async predictSSP(
    organizationId: string,
    itemIds: string[]
  ): Promise<PredictionResult[]> {
    if (!this.model) {
      throw new Error('Model not trained. Please train the model first.');
    }

    const predictions: PredictionResult[] = [];

    for (const itemId of itemIds) {
      // Prepare features for item
      const features = await this.prepareItemFeatures(organizationId, itemId);
      
      if (!features) {
        console.warn(`No features available for item ${itemId}`);
        continue;
      }

      // Normalize features
      const normalizedFeatures = features.map((val, idx) => 
        (val - this.featureScaler!.mean[idx]) / this.featureScaler!.std[idx]
      );

      // Make prediction
      const featureTensor = tf.tensor2d([normalizedFeatures]);
      const prediction = this.model.predict(featureTensor) as tf.Tensor;
      const normalizedPred = await prediction.array() as number[][];
      
      // Denormalize prediction
      const predictedSSP = normalizedPred[0][0] * this.labelScaler!.std + this.labelScaler!.mean;

      // Calculate confidence using dropout uncertainty
      const mcPredictions = await this.monteCarloDropout(normalizedFeatures, 100);
      const confidence = 1 - (mcPredictions.std / mcPredictions.mean);

      // Calculate prediction interval
      const predictionInterval = {
        lower: predictedSSP - 1.96 * mcPredictions.std,
        upper: predictedSSP + 1.96 * mcPredictions.std
      };

      predictions.push({
        itemId,
        predictedSSP,
        confidence: Math.max(0, Math.min(1, confidence)),
        predictionInterval
      });

      // Clean up
      featureTensor.dispose();
      prediction.dispose();
    }

    return predictions;
  }

  /**
   * Prepare features for a single item
   */
  private async prepareItemFeatures(
    organizationId: string,
    itemId: string
  ): Promise<number[] | null> {
    // This would fetch recent transaction data for the item
    // and extract the same features used in training
    // For now, returning mock features
    return [
      10,    // quantity
      0.1,   // discount
      1,     // customerSegment
      2,     // itemType
      1,     // category
      50000, // contractValue
      12,    // contractDuration
      0,     // isBundle
      6,     // seasonality
      3,     // dayOfWeek
      150,   // quarterlyVolume
      500    // priceVariability
    ];
  }

  /**
   * Monte Carlo dropout for uncertainty estimation
   */
  private async monteCarloDropout(
    features: number[],
    numSamples: number
  ): Promise<{ mean: number; std: number }> {
    const predictions: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      const featureTensor = tf.tensor2d([features]);
      const prediction = this.model!.predict(featureTensor, { training: true }) as tf.Tensor;
      const normalizedPred = await prediction.array() as number[][];
      const denormalizedPred = normalizedPred[0][0] * this.labelScaler!.std + this.labelScaler!.mean;
      
      predictions.push(denormalizedPred);
      
      featureTensor.dispose();
      prediction.dispose();
    }

    const mean = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
    const variance = predictions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions.length;
    const std = Math.sqrt(variance);

    return { mean, std };
  }

  /**
   * Save model to disk
   */
  private async saveModel(modelId: string, organizationId: string): Promise<void> {
    if (!this.model) return;

    const modelPath = `file://./models/${organizationId}/${modelId}`;
    await this.model.save(modelPath);

    // Save scalers
    const scalerPath = `./models/${organizationId}/${modelId}/scalers.json`;
    const fs = require('fs').promises;
    await fs.writeFile(scalerPath, JSON.stringify({
      featureScaler: this.featureScaler,
      labelScaler: this.labelScaler
    }));
  }

  /**
   * Load model from disk
   */
  async loadModel(modelId: string, organizationId: string): Promise<void> {
    const modelPath = `file://./models/${organizationId}/${modelId}`;
    this.model = await tf.loadLayersModel(`${modelPath}/model.json`);

    // Load scalers
    const scalerPath = `./models/${organizationId}/${modelId}/scalers.json`;
    const fs = require('fs').promises;
    const scalerData = JSON.parse(await fs.readFile(scalerPath, 'utf-8'));
    this.featureScaler = scalerData.featureScaler;
    this.labelScaler = scalerData.labelScaler;
  }

  /**
   * Update calculation run with model information
   */
  private async updateCalculationRun(
    organizationId: string,
    modelId: string,
    metrics: ModelMetrics,
    featureImportance: FeatureImportance[]
  ): Promise<void> {
    const importanceMap = featureImportance.reduce((acc, item) => {
      acc[item.feature] = item.importance;
      return acc;
    }, {} as Record<string, number>);

    await this.db.update(sspCalculationRuns)
      .set({
        modelVersion: this.modelVersion,
        modelAccuracy: metrics.accuracy.toString(),
        modelTrainingDate: new Date(),
        featureImportance: importanceMap,
        updatedAt: new Date()
      })
      .where(and(
        eq(sspCalculationRuns.organizationId, organizationId),
        eq(sspCalculationRuns.status, 'running')
      ));
  }

  /**
   * Retrain model with new data
   */
  async retrainModel(
    organizationId: string,
    includeRecentData: boolean = true
  ): Promise<void> {
    console.log(`Retraining model for organization ${organizationId}`);

    // Determine date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Train new model
    const result = await this.trainModel(organizationId, startDateStr, endDate);

    console.log(`Model retrained successfully. Metrics:`, result.metrics);
    console.log(`Top features:`, result.featureImportance.slice(0, 5));
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(organizationId: string): Promise<{
    currentMetrics: ModelMetrics | null;
    historicalMetrics: Array<{
      date: Date;
      metrics: ModelMetrics;
    }>;
  }> {
    // Get latest calculation run with model metrics
    const latestRun = await this.db.select({
      modelAccuracy: sspCalculationRuns.modelAccuracy,
      modelTrainingDate: sspCalculationRuns.modelTrainingDate,
      featureImportance: sspCalculationRuns.featureImportance
    })
    .from(sspCalculationRuns)
    .where(and(
      eq(sspCalculationRuns.organizationId, organizationId),
      eq(sspCalculationRuns.status, 'completed')
    ))
    .orderBy(desc(sspCalculationRuns.createdAt))
    .limit(1);

    if (latestRun.length === 0) {
      return {
        currentMetrics: null,
        historicalMetrics: []
      };
    }

    // Get historical metrics
    const historicalRuns = await this.db.select({
      modelAccuracy: sspCalculationRuns.modelAccuracy,
      modelTrainingDate: sspCalculationRuns.modelTrainingDate
    })
    .from(sspCalculationRuns)
    .where(and(
      eq(sspCalculationRuns.organizationId, organizationId),
      eq(sspCalculationRuns.status, 'completed')
    ))
    .orderBy(desc(sspCalculationRuns.modelTrainingDate))
    .limit(10);

    // Mock metrics for demonstration (would be stored in DB)
    const currentMetrics: ModelMetrics = {
      accuracy: Number(latestRun[0].modelAccuracy) || 0,
      mse: 0.05,
      mae: 0.03,
      r2Score: 0.92
    };

    const historicalMetrics = historicalRuns.map(run => ({
      date: run.modelTrainingDate!,
      metrics: {
        accuracy: Number(run.modelAccuracy) || 0,
        mse: 0.05,
        mae: 0.03,
        r2Score: 0.92
      }
    }));

    return {
      currentMetrics,
      historicalMetrics
    };
  }
}