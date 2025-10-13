/**
 * Stub implementation of SSP ML Training Service for environments where TensorFlow is not available
 * This is used in Next.js builds to avoid bundling native Node.js modules
 */

export interface ModelMetrics {
  mse: number;
  mae: number;
  r2Score: number;
  accuracy: number;
}

export class SSPMLTrainingService {
  constructor(private db: any, private organizationId: string) {}

  async trainModel(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    throw new Error('ML Training is not available in this environment. Use server-side API endpoints.');
  }

  async predict(
    itemIds: string[],
    modelId?: string
  ): Promise<any[]> {
    throw new Error('ML Prediction is not available in this environment. Use server-side API endpoints.');
  }

  async evaluateModel(modelId: string): Promise<ModelMetrics> {
    throw new Error('Model evaluation is not available in this environment. Use server-side API endpoints.');
  }

  async getLatestModel(): Promise<any> {
    return null;
  }

  async deleteModel(modelId: string): Promise<void> {
    throw new Error('Model deletion is not available in this environment. Use server-side API endpoints.');
  }
}