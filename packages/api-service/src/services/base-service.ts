import { PaginationParams, PaginatedResult, ServiceContext, ServiceError } from '../types';

export abstract class BaseService {
  protected context: ServiceContext;

  constructor(context: ServiceContext = {}) {
    this.context = context;
  }

  /**
   * Validates that the current context has an organization ID
   * @throws {ServiceError} If no organization ID is present
   */
  protected requireOrganizationContext(): string {
    if (!this.context.organizationId) {
      throw new ServiceError(
        'Organization context is required for this operation',
        'MISSING_ORGANIZATION_CONTEXT',
        401
      );
    }
    return this.context.organizationId;
  }

  /**
   * Validates that the current context has a user ID
   * @throws {ServiceError} If no user ID is present
   */
  protected requireUserContext(): string {
    if (!this.context.userId) {
      throw new ServiceError(
        'User context is required for this operation',
        'MISSING_USER_CONTEXT',
        401
      );
    }
    return this.context.userId;
  }

  /**
   * Calculate pagination parameters
   */
  protected getPaginationParams(params: PaginationParams = {}): { skip: number; take: number; page: number; limit: number } {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;
    
    return {
      skip,
      take: limit,
      page,
      limit
    };
  }

  /**
   * Create a paginated result object
   */
  protected createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}