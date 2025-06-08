import { BaseService } from './base-service';
import { 
  ItemCategory,
  CreateItemCategoryInput,
  UpdateItemCategoryInput,
  createItemCategorySchema,
  updateItemCategorySchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { ItemCategoriesRepository, ItemsRepository } from '@glapi/database';

// Create repository instances
const itemCategoriesRepository = new ItemCategoriesRepository();
const itemsRepository = new ItemsRepository();

export class ItemCategoriesService extends BaseService {
  /**
   * Transform database record to service layer type
   */
  private transformItemCategory(dbRecord: any): ItemCategory {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      code: dbRecord.code,
      name: dbRecord.name,
      parentCategoryId: dbRecord.parentCategoryId,
      level: dbRecord.level,
      path: dbRecord.path,
      isActive: dbRecord.isActive,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Get all categories for the organization
   */
  async listCategories(
    params: PaginationParams = {}
  ): Promise<PaginatedResult<ItemCategory>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    const categories = await itemCategoriesRepository.findByOrganization(organizationId);
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = categories.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(c => this.transformItemCategory(c)),
      categories.length,
      page,
      limit
    );
  }

  /**
   * Get category tree structure
   */
  async getCategoryTree(): Promise<ItemCategory[]> {
    const organizationId = this.requireOrganizationContext();
    
    const tree = await itemCategoriesRepository.getCategoryTree(organizationId);
    
    // Transform the tree recursively
    const transformTree = (nodes: any[]): ItemCategory[] => {
      return nodes.map(node => ({
        ...this.transformItemCategory(node),
        children: node.children ? transformTree(node.children) : undefined,
      }));
    };
    
    return transformTree(tree);
  }

  /**
   * Get a category by ID
   */
  async getCategory(id: string): Promise<ItemCategory> {
    const organizationId = this.requireOrganizationContext();
    
    const category = await itemCategoriesRepository.findById(id, organizationId);
    if (!category) {
      throw new ServiceError(
        'Category not found',
        'CATEGORY_NOT_FOUND',
        404
      );
    }
    
    return this.transformItemCategory(category);
  }

  /**
   * Get category with ancestors
   */
  async getCategoryWithAncestors(id: string): Promise<{
    category: ItemCategory;
    ancestors: ItemCategory[];
  }> {
    const organizationId = this.requireOrganizationContext();
    
    const category = await itemCategoriesRepository.findById(id, organizationId);
    if (!category) {
      throw new ServiceError(
        'Category not found',
        'CATEGORY_NOT_FOUND',
        404
      );
    }
    
    const ancestors = await itemCategoriesRepository.getAncestors(id, organizationId);
    
    return {
      category: this.transformItemCategory(category),
      ancestors: ancestors.map(a => this.transformItemCategory(a)),
    };
  }

  /**
   * Create a new category
   */
  async createCategory(
    input: CreateItemCategoryInput
  ): Promise<ItemCategory> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createItemCategorySchema.parse(input);
    
    // Check if code already exists
    const existing = await itemCategoriesRepository.findByCode(
      validatedInput.code,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Category with this code already exists',
        'DUPLICATE_CODE',
        409
      );
    }
    
    // Validate parent category if provided
    if (validatedInput.parentCategoryId) {
      const parent = await itemCategoriesRepository.findById(
        validatedInput.parentCategoryId,
        organizationId
      );
      if (!parent) {
        throw new ServiceError(
          'Parent category not found',
          'INVALID_PARENT',
          400
        );
      }
      
      // Check max depth (e.g., 5 levels)
      if (parent.level >= 4) {
        throw new ServiceError(
          'Maximum category depth exceeded',
          'MAX_DEPTH_EXCEEDED',
          400
        );
      }
    }
    
    const created = await itemCategoriesRepository.create({
      organizationId,
      code: validatedInput.code,
      name: validatedInput.name,
      parentCategoryId: validatedInput.parentCategoryId,
      isActive: validatedInput.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformItemCategory(created);
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    input: UpdateItemCategoryInput
  ): Promise<ItemCategory> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateItemCategorySchema.parse(input);
    
    // Check if category exists
    const existing = await itemCategoriesRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Category not found',
        'CATEGORY_NOT_FOUND',
        404
      );
    }
    
    // Check if code is being changed and already exists
    if (validatedInput.code && validatedInput.code !== existing.code) {
      const codeExists = await itemCategoriesRepository.findByCode(
        validatedInput.code,
        organizationId
      );
      if (codeExists) {
        throw new ServiceError(
          'Category with this code already exists',
          'DUPLICATE_CODE',
          409
        );
      }
    }
    
    // Validate parent category if being changed
    if (validatedInput.parentCategoryId !== undefined) {
      if (validatedInput.parentCategoryId === id) {
        throw new ServiceError(
          'A category cannot be its own parent',
          'INVALID_PARENT',
          400
        );
      }
      
      if (validatedInput.parentCategoryId) {
        const parent = await itemCategoriesRepository.findById(
          validatedInput.parentCategoryId,
          organizationId
        );
        if (!parent) {
          throw new ServiceError(
            'Parent category not found',
            'INVALID_PARENT',
            400
          );
        }
        
        // Check for circular reference
        const isDescendant = await this.isDescendantOf(
          validatedInput.parentCategoryId,
          id,
          organizationId
        );
        if (isDescendant) {
          throw new ServiceError(
            'Cannot move category to its own descendant',
            'CIRCULAR_REFERENCE',
            400
          );
        }
      }
    }
    
    const updated = await itemCategoriesRepository.update(
      id,
      organizationId,
      {
        ...validatedInput,
        updatedBy: userId,
      }
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update category',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformItemCategory(updated);
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if category exists
    const existing = await itemCategoriesRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Category not found',
        'CATEGORY_NOT_FOUND',
        404
      );
    }
    
    // Check if category has children
    const children = await itemCategoriesRepository.findChildCategories(
      id,
      organizationId
    );
    if (children.length > 0) {
      throw new ServiceError(
        'Cannot delete category with child categories',
        'HAS_CHILDREN',
        409
      );
    }
    
    // Check if category has items
    const itemCount = await itemsRepository.getCountByCategory(id, organizationId);
    if (itemCount > 0) {
      throw new ServiceError(
        'Cannot delete category with associated items',
        'HAS_ITEMS',
        409
      );
    }
    
    try {
      await itemCategoriesRepository.delete(id, organizationId);
    } catch (error: any) {
      if (error.message.includes('child categories')) {
        throw new ServiceError(
          'Cannot delete category with child categories',
          'HAS_CHILDREN',
          409
        );
      }
      if (error.message.includes('associated items')) {
        throw new ServiceError(
          'Cannot delete category with associated items',
          'HAS_ITEMS',
          409
        );
      }
      throw new ServiceError(
        'Failed to delete category',
        'DELETE_FAILED',
        500
      );
    }
  }

  /**
   * Move a category to a new parent
   */
  async moveCategory(
    categoryId: string,
    newParentId: string | null
  ): Promise<ItemCategory> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      const moved = await itemCategoriesRepository.moveCategory(
        categoryId,
        newParentId,
        organizationId
      );
      
      if (!moved) {
        throw new ServiceError(
          'Failed to move category',
          'MOVE_FAILED',
          500
        );
      }
      
      return this.transformItemCategory(moved);
    } catch (error: any) {
      if (error.message.includes('descendant')) {
        throw new ServiceError(
          'Cannot move category to its own descendant',
          'CIRCULAR_REFERENCE',
          400
        );
      }
      throw error;
    }
  }

  /**
   * Get child categories
   */
  async getChildCategories(parentId: string): Promise<ItemCategory[]> {
    const organizationId = this.requireOrganizationContext();
    
    const children = await itemCategoriesRepository.findChildCategories(
      parentId,
      organizationId
    );
    
    return children.map(c => this.transformItemCategory(c));
  }

  /**
   * Check if a category is a descendant of another
   */
  private async isDescendantOf(
    potentialDescendantId: string,
    ancestorId: string,
    organizationId: string
  ): Promise<boolean> {
    const ancestors = await itemCategoriesRepository.getAncestors(
      potentialDescendantId,
      organizationId
    );
    
    return ancestors.some(a => a.id === ancestorId);
  }
}