import * as tf from '@tensorflow/tfjs-node';
import { Database, sspAnalyticsRepository } from '@glapi/database';
import { createId } from '@paralleldrive/cuid2';

interface TrainingData {
  features: number[][];
  labels: number[];
  itemIds: string[];
  featureNames: string[];
}

export interface ModelMetrics {
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
    // Use repository to fetch training data
    const data = await sspAnalyticsRepository.getMLTrainingData(
      organizationId,
      new Date(startDate),
      new Date(endDate)
    );
    
    // Get pricing statistics for enrichment
    const uniqueItemIds = [...new Set(data.map(d => d.itemId))];
    const pricingStats = await sspAnalyticsRepository.getItemPricingStatistics(
      organizationId,
      uniqueItemIds
    );
    
    // Create a map for quick lookup
    const statsMap = new Map(pricingStats.map(s => [s.itemId, s]));

    // Prepare features and labels
    const features: number[][] = [];
    const labels: number[] = [];
    const itemIds: string[] = [];

    for (const row of data) {
      const stats = statsMap.get(row.itemId);
      
      // Extract date components from createdAt
      const date = new Date(row.createdAt || new Date());
      const month = date.getMonth() + 1;
      const dayOfWeek = date.getDay();
      
      // Create feature vector using available data
      const featureVector = [
        parseFloat(row.quantity || '0'),
        parseFloat(row.discountPercentage || '0'),
        row.itemType === 'SERVICE' ? 1 : 0, // Encode item type as binary
        row.itemType === 'INVENTORY_ITEM' || row.itemType === 'NON_INVENTORY_ITEM' ? 1 : 0,
        row.categoryId ? 1 : 0, // Has category
        parseFloat(row.unitPrice || '0'),
        stats?.avgPrice || parseFloat(row.unitPrice || '0'),
        stats?.stdDev || 0,
        stats?.transactionCount || 1,
        stats?.avgDiscount || 0,
        month, // Seasonality
        dayOfWeek, // Day of week
        stats?.minPrice || parseFloat(row.unitPrice || '0'),
        stats?.maxPrice || parseFloat(row.unitPrice || '0')
      ];

      features.push(featureVector);
      labels.push(parseFloat(row.unitPrice || '0'));
      itemIds.push(row.itemId);
    }

    const featureNames = [
      'quantity',
      'discount',
      'isService',
      'isProduct',
      'hasCategory',
      'unitPrice',
      'avgPrice',
      'priceStdDev',
      'transactionCount',
      'avgDiscount',
      'seasonality',
      'dayOfWeek',
      'minPrice',
      'maxPrice'
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
      const prediction = this.model!.predict(featureTensor) as tf.Tensor;
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

    // Update calculation run with model metrics
    // Note: This would need to be done through a specific method in the repository
    // For now, we'll skip the direct database update as it should go through the repository
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
    // TODO: This should be implemented through the repository
    // Mock data for now
    const latestRun: any[] = [];

    if (latestRun.length === 0) {
      return {
        currentMetrics: null,
        historicalMetrics: []
      };
    }

    // TODO: Get historical metrics through repository
    const historicalRuns: any[] = [];

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