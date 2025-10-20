/**
 * Wrapper for SSP ML Training Service that handles dynamic imports
 * This prevents TensorFlow from being bundled in Next.js builds
 */

export interface ModelMetrics {
  mse: number;
  mae: number;
  r2Score: number;
  accuracy: number;
}

export class SSPMLTrainingService {
  private actualService: any = null;

  constructor(private db: any, private organizationId: string) {}

  private async getService() {
    if (!this.actualService) {
      // Check if we're in a browser environment
      if (typeof globalThis !== 'undefined' && globalThis.window) {
        // Browser environment - throw error
        throw new Error('ML Training is not available in browser environment. Use server-side API endpoints.');
      }
      
      try {
        // Dynamically import the real service only in Node.js environment
        const { SSPMLTrainingService: ActualService } = await import('./ssp-ml-training-service.js');
        this.actualService = new ActualService(this.db);
      } catch (error) {
        throw new Error('TensorFlow.js is not available in this environment');
      }
    }
    return this.actualService;
  }

  async trainModel(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const service = await this.getService();
    return service.trainModel(organizationId, startDate, endDate);
  }

  async predict(
    itemIds: string[],
    modelId?: string
  ): Promise<any[]> {
    const service = await this.getService();
    return service.predict(itemIds, modelId);
  }

  async evaluateModel(modelId: string): Promise<ModelMetrics> {
    const service = await this.getService();
    return service.evaluateModel(modelId);
  }

  async getLatestModel(): Promise<any> {
    const service = await this.getService();
    return service.getLatestModel();
  }

  async deleteModel(modelId: string): Promise<void> {
    const service = await this.getService();
    return service.deleteModel(modelId);
  }
}