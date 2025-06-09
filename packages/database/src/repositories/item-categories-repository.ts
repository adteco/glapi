import { and, eq, ilike, isNull, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { itemCategories } from '../db/schema/item-categories';
import { items } from '../db/schema/items';
import type { ItemCategory, NewItemCategory } from '../db/schema/item-categories';

interface CategoryNode extends ItemCategory {
  children?: CategoryNode[];
}

export class ItemCategoriesRepository extends BaseRepository {
  /**
   * Find all categories for an organization
   */
  async findByOrganization(organizationId: string) {
    return await this.db
      .select()
      .from(itemCategories)
      .where(eq(itemCategories.organizationId, organizationId))
      .orderBy(itemCategories.path);
  }

  /**
   * Find a category by ID
   */
  async findById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(itemCategories)
      .where(
        and(
          eq(itemCategories.id, id),
          eq(itemCategories.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a category by code
   */
  async findByCode(code: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(itemCategories)
      .where(
        and(
          eq(itemCategories.code, code),
          eq(itemCategories.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find root categories (no parent)
   */
  async findRootCategories(organizationId: string) {
    return await this.db
      .select()
      .from(itemCategories)
      .where(
        and(
          eq(itemCategories.organizationId, organizationId),
          isNull(itemCategories.parentCategoryId)
        )
      )
      .orderBy(itemCategories.name);
  }

  /**
   * Find child categories of a parent
   */
  async findChildCategories(parentId: string, organizationId: string) {
    return await this.db
      .select()
      .from(itemCategories)
      .where(
        and(
          eq(itemCategories.organizationId, organizationId),
          eq(itemCategories.parentCategoryId, parentId)
        )
      )
      .orderBy(itemCategories.name);
  }

  /**
   * Get the complete category tree
   */
  async getCategoryTree(organizationId: string): Promise<CategoryNode[]> {
    const allCategories = await this.findByOrganization(organizationId);
    
    // Build a map for quick lookup
    const categoryMap = new Map<string, CategoryNode>();
    allCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build the tree structure
    const rootCategories: CategoryNode[] = [];
    
    allCategories.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      
      if (cat.parentCategoryId) {
        const parent = categoryMap.get(cat.parentCategoryId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        rootCategories.push(node);
      }
    });

    return rootCategories;
  }

  /**
   * Calculate the path for a category
   */
  private async calculatePath(
    parentId: string | null,
    code: string,
    organizationId: string
  ): Promise<string> {
    if (!parentId) {
      return code;
    }

    const parent = await this.findById(parentId, organizationId);
    if (!parent) {
      throw new Error('Parent category not found');
    }

    return `${parent.path}/${code}`;
  }

  /**
   * Calculate the level for a category
   */
  private async calculateLevel(
    parentId: string | null,
    organizationId: string
  ): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await this.findById(parentId, organizationId);
    if (!parent) {
      throw new Error('Parent category not found');
    }

    return parent.level + 1;
  }

  /**
   * Create a new category
   */
  async create(data: Omit<NewItemCategory, 'path' | 'level'>) {
    const path = await this.calculatePath(
      data.parentCategoryId || null,
      data.code,
      data.organizationId
    );
    
    const level = await this.calculateLevel(
      data.parentCategoryId || null,
      data.organizationId
    );

    const results = await this.db
      .insert(itemCategories)
      .values({
        ...data,
        path,
        level,
      })
      .returning();
    
    return results[0];
  }

  /**
   * Update a category
   */
  async update(id: string, organizationId: string, data: Partial<NewItemCategory>) {
    // If parent or code is changing, recalculate path
    let updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    const current = await this.findById(id, organizationId);
    if (!current) {
      return null;
    }

    // Check if we need to recalculate path
    if (data.parentCategoryId !== undefined || data.code !== undefined) {
      const newParentId = data.parentCategoryId !== undefined 
        ? data.parentCategoryId 
        : current.parentCategoryId;
      
      const newCode = data.code || current.code;
      
      updateData.path = await this.calculatePath(newParentId, newCode, organizationId);
      updateData.level = await this.calculateLevel(newParentId, organizationId);
    }

    const results = await this.db
      .update(itemCategories)
      .set(updateData)
      .where(
        and(
          eq(itemCategories.id, id),
          eq(itemCategories.organizationId, organizationId)
        )
      )
      .returning();
    
    // If path changed, update all descendant paths
    if (results[0] && updateData.path && updateData.path !== current.path) {
      await this.updateDescendantPaths(id, current.path, updateData.path, organizationId);
    }
    
    return results[0] || null;
  }

  /**
   * Update paths for all descendants when a parent's path changes
   */
  private async updateDescendantPaths(
    parentId: string,
    oldPath: string,
    newPath: string,
    organizationId: string
  ) {
    await this.db.execute(sql`
      UPDATE ${itemCategories}
      SET 
        path = ${newPath} || substring(path from ${oldPath.length + 1}),
        level = level + (${newPath.split('/').length} - ${oldPath.split('/').length})
      WHERE 
        organization_id = ${organizationId}
        AND path LIKE ${oldPath + '/%'}
    `);
  }

  /**
   * Delete a category (with validation)
   */
  async delete(id: string, organizationId: string) {
    // Check if category has children
    const children = await this.findChildCategories(id, organizationId);
    if (children.length > 0) {
      throw new Error('Cannot delete category with child categories');
    }

    // Check if category has items
    const itemCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(
        and(
          eq(items.categoryId, id),
          eq(items.organizationId, organizationId)
        )
      );

    const itemCount = itemCountResult[0]?.count || 0;
    if (itemCount > 0) {
      throw new Error('Cannot delete category with associated items');
    }

    // Soft delete
    const results = await this.db
      .update(itemCategories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(itemCategories.id, id),
          eq(itemCategories.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Move a category to a new parent
   */
  async moveCategory(
    categoryId: string,
    newParentId: string | null,
    organizationId: string
  ) {
    // Validate the move (prevent circular references)
    if (newParentId) {
      const isDescendant = await this.isDescendant(newParentId, categoryId, organizationId);
      if (isDescendant) {
        throw new Error('Cannot move category to its own descendant');
      }
    }

    return await this.update(categoryId, organizationId, {
      parentCategoryId: newParentId,
    });
  }

  /**
   * Check if a category is a descendant of another
   */
  private async isDescendant(
    potentialDescendantId: string,
    ancestorId: string,
    organizationId: string
  ): Promise<boolean> {
    const ancestor = await this.findById(ancestorId, organizationId);
    const potentialDescendant = await this.findById(potentialDescendantId, organizationId);

    if (!ancestor || !potentialDescendant) {
      return false;
    }

    return potentialDescendant.path.startsWith(ancestor.path + '/');
  }

  /**
   * Get all ancestors of a category
   */
  async getAncestors(categoryId: string, organizationId: string): Promise<ItemCategory[]> {
    const category = await this.findById(categoryId, organizationId);
    if (!category || !category.parentCategoryId) {
      return [];
    }

    const ancestors: ItemCategory[] = [];
    let currentId: string | null = category.parentCategoryId;

    while (currentId) {
      const parent = await this.findById(currentId, organizationId);
      if (!parent) break;
      
      ancestors.unshift(parent); // Add to beginning to maintain order
      currentId = parent.parentCategoryId;
    }

    return ancestors;
  }
}