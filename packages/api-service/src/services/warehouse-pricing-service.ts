import { BaseService } from './base-service';
import { 
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { 
  WarehouseRepository,
  ItemsRepository,
  EntityRepository,
  PricingRepository
} from '@glapi/database';

// Types for warehouse pricing
export interface Warehouse {
  id: string;
  organizationId: string;
  warehouseId: string;
  name: string;
  locationId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWarehouseInput {
  warehouseId: string;
  name: string;
  locationId?: string;
  isActive?: boolean;
}

export interface UpdateWarehouseInput {
  warehouseId?: string;
  name?: string;
  locationId?: string;
  isActive?: boolean;
}

export interface WarehousePriceList {
  id: string;
  warehouseId: string;
  priceListId: string;
  priority: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignWarehousePriceListInput {
  warehouseId: string;
  priceListId: string;
  priority?: number;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface CustomerWarehouseAssignment {
  id: string;
  organizationId: string;
  customerId: string;
  itemId: string;
  warehouseId: string;
  isDefault: boolean;
  effectiveDate?: Date;
  expirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignCustomerWarehouseInput {
  customerId: string;
  itemId: string;
  warehouseId: string;
  isDefault?: boolean;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface WarehousePriceResult {
  warehouseId: string;
  warehouseName: string;
  priceListId: string;
  priceListName: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

export interface GetCustomerPriceInput {
  customerId: string;
  itemId: string;
  quantity?: number;
  date?: Date;
}

const warehouseRepository = new WarehouseRepository();
const itemsRepository = new ItemsRepository();
const entityRepository = new EntityRepository();
const pricingRepository = new PricingRepository();

export class WarehousePricingService extends BaseService {
  /**
   * Transform database warehouse to service layer type
   */
  private transformWarehouse(dbRecord: any): Warehouse {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      warehouseId: dbRecord.warehouseId,
      name: dbRecord.name,
      locationId: dbRecord.locationId || undefined,
      isActive: dbRecord.isActive,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Transform database warehouse price list to service layer type
   */
  private transformWarehousePriceList(dbRecord: any): WarehousePriceList {
    return {
      id: dbRecord.id,
      warehouseId: dbRecord.warehouseId,
      priceListId: dbRecord.priceListId,
      priority: parseFloat(dbRecord.priority),
      effectiveDate: dbRecord.effectiveDate ? new Date(dbRecord.effectiveDate) : undefined,
      expirationDate: dbRecord.expirationDate ? new Date(dbRecord.expirationDate) : undefined,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Transform database customer warehouse assignment to service layer type
   */
  private transformCustomerWarehouseAssignment(dbRecord: any): CustomerWarehouseAssignment {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      customerId: dbRecord.customerId,
      itemId: dbRecord.itemId,
      warehouseId: dbRecord.warehouseId,
      isDefault: dbRecord.isDefault,
      effectiveDate: dbRecord.effectiveDate ? new Date(dbRecord.effectiveDate) : undefined,
      expirationDate: dbRecord.expirationDate ? new Date(dbRecord.expirationDate) : undefined,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  // Warehouse Methods

  /**
   * List warehouses
   */
  async listWarehouses(
    params: PaginationParams & { activeOnly?: boolean } = {}
  ): Promise<PaginatedResult<Warehouse>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    const warehouses = await warehouseRepository.findWarehouses(
      organizationId,
      params.activeOnly ?? true
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = warehouses.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(w => this.transformWarehouse(w)),
      warehouses.length,
      page,
      limit
    );
  }

  /**
   * Get a warehouse by ID
   */
  async getWarehouse(id: string): Promise<Warehouse> {
    const organizationId = this.requireOrganizationContext();
    
    const warehouse = await warehouseRepository.findWarehouseById(id, organizationId);
    if (!warehouse) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    return this.transformWarehouse(warehouse);
  }

  /**
   * Create a warehouse
   */
  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if warehouse ID already exists
    const existing = await warehouseRepository.findWarehouseByCode(
      input.warehouseId,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Warehouse with this ID already exists',
        'DUPLICATE_WAREHOUSE_ID',
        409
      );
    }
    
    const created = await warehouseRepository.createWarehouse({
      organizationId,
      warehouseId: input.warehouseId,
      name: input.name,
      locationId: input.locationId === 'no-location' || input.locationId === '' ? undefined : input.locationId,
      isActive: input.isActive ?? true,
    });
    
    return this.transformWarehouse(created);
  }

  /**
   * Update a warehouse
   */
  async updateWarehouse(
    id: string,
    input: UpdateWarehouseInput
  ): Promise<Warehouse> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if warehouse exists
    const existing = await warehouseRepository.findWarehouseById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    // Check if warehouse ID is being changed and already exists
    if (input.warehouseId && input.warehouseId !== existing.warehouseId) {
      const idExists = await warehouseRepository.findWarehouseByCode(
        input.warehouseId,
        organizationId
      );
      if (idExists) {
        throw new ServiceError(
          'Warehouse with this ID already exists',
          'DUPLICATE_WAREHOUSE_ID',
          409
        );
      }
    }
    
    const updated = await warehouseRepository.updateWarehouse(
      id,
      organizationId,
      {
        ...input,
        locationId: input.locationId === 'no-location' || input.locationId === '' ? undefined : input.locationId
      }
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update warehouse',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformWarehouse(updated);
  }

  /**
   * Delete a warehouse
   */
  async deleteWarehouse(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    const deleted = await warehouseRepository.deleteWarehouse(id, organizationId);
    if (!deleted) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
  }

  // Warehouse Price List Methods

  /**
   * Assign price lists to a warehouse
   */
  async assignWarehousePriceList(
    input: AssignWarehousePriceListInput
  ): Promise<WarehousePriceList> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate warehouse
    const warehouse = await warehouseRepository.findWarehouseById(
      input.warehouseId,
      organizationId
    );
    if (!warehouse) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    // Validate price list
    const priceList = await pricingRepository.findPriceListById(
      input.priceListId,
      organizationId
    );
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    const created = await warehouseRepository.assignPriceListToWarehouse({
      warehouseId: input.warehouseId,
      priceListId: input.priceListId,
      priority: input.priority?.toString() || '1',
      effectiveDate: input.effectiveDate?.toISOString().split('T')[0],
      expirationDate: input.expirationDate?.toISOString().split('T')[0],
    });
    
    return this.transformWarehousePriceList(created);
  }

  /**
   * Get price lists for a warehouse
   */
  async getWarehousePriceLists(
    warehouseId: string,
    date?: Date
  ): Promise<WarehousePriceList[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate warehouse
    const warehouse = await warehouseRepository.findWarehouseById(
      warehouseId,
      organizationId
    );
    if (!warehouse) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    const priceLists = await warehouseRepository.findWarehousePriceLists(
      warehouseId,
      date
    );
    
    return priceLists.map(pl => ({
      ...this.transformWarehousePriceList(pl.warehousePriceList),
      priceList: pl.priceList
    }));
  }

  /**
   * Remove price list from warehouse
   */
  async removeWarehousePriceList(
    warehouseId: string,
    priceListId: string
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate warehouse
    const warehouse = await warehouseRepository.findWarehouseById(
      warehouseId,
      organizationId
    );
    if (!warehouse) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    await warehouseRepository.removePriceListFromWarehouse(warehouseId, priceListId);
  }

  // Customer Warehouse Assignment Methods

  /**
   * Assign customer to warehouse for an item
   */
  async assignCustomerWarehouse(
    input: AssignCustomerWarehouseInput
  ): Promise<CustomerWarehouseAssignment> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate customer
    const customer = await entityRepository.findById(
      input.customerId,
      organizationId
    );
    if (!customer || !customer.entityTypes.includes('customer')) {
      throw new ServiceError(
        'Customer not found',
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    // Validate item
    const item = await itemsRepository.findById(
      input.itemId,
      organizationId
    );
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    // Validate warehouse
    const warehouse = await warehouseRepository.findWarehouseById(
      input.warehouseId,
      organizationId
    );
    if (!warehouse) {
      throw new ServiceError(
        'Warehouse not found',
        'WAREHOUSE_NOT_FOUND',
        404
      );
    }
    
    const created = await warehouseRepository.assignCustomerToWarehouse({
      organizationId,
      customerId: input.customerId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      isDefault: input.isDefault,
      effectiveDate: input.effectiveDate?.toISOString().split('T')[0],
      expirationDate: input.expirationDate?.toISOString().split('T')[0],
    });
    
    return this.transformCustomerWarehouseAssignment(created);
  }

  /**
   * Get customer warehouse assignments
   */
  async getCustomerWarehouseAssignments(
    customerId: string
  ): Promise<CustomerWarehouseAssignment[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate customer
    const customer = await entityRepository.findById(
      customerId,
      organizationId
    );
    if (!customer || !customer.entityTypes.includes('customer')) {
      throw new ServiceError(
        'Customer not found',
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    const assignments = await warehouseRepository.findCustomerWarehouseAssignments(
      customerId,
      organizationId
    );
    
    return assignments.map(a => this.transformCustomerWarehouseAssignment(a.assignment));
  }

  /**
   * Update customer warehouse assignment
   */
  async updateCustomerWarehouseAssignment(
    id: string,
    input: Partial<AssignCustomerWarehouseInput>
  ): Promise<CustomerWarehouseAssignment> {
    const organizationId = this.requireOrganizationContext();
    
    const updateData: any = {};
    if (input.warehouseId !== undefined) {
      // Validate warehouse
      const warehouse = await warehouseRepository.findWarehouseById(
        input.warehouseId,
        organizationId
      );
      if (!warehouse) {
        throw new ServiceError(
          'Warehouse not found',
          'WAREHOUSE_NOT_FOUND',
          404
        );
      }
      updateData.warehouseId = input.warehouseId;
    }
    
    if (input.isDefault !== undefined) {
      updateData.isDefault = input.isDefault;
    }
    if (input.effectiveDate !== undefined) {
      updateData.effectiveDate = input.effectiveDate.toISOString().split('T')[0];
    }
    if (input.expirationDate !== undefined) {
      updateData.expirationDate = input.expirationDate.toISOString().split('T')[0];
    }
    
    const updated = await warehouseRepository.updateCustomerWarehouseAssignment(
      id,
      organizationId,
      updateData
    );
    
    if (!updated) {
      throw new ServiceError(
        'Customer warehouse assignment not found',
        'ASSIGNMENT_NOT_FOUND',
        404
      );
    }
    
    return this.transformCustomerWarehouseAssignment(updated);
  }

  /**
   * Remove customer warehouse assignment
   */
  async removeCustomerWarehouseAssignment(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    const removed = await warehouseRepository.removeCustomerWarehouseAssignment(
      id,
      organizationId
    );
    
    if (!removed) {
      throw new ServiceError(
        'Customer warehouse assignment not found',
        'ASSIGNMENT_NOT_FOUND',
        404
      );
    }
  }

  // Price Calculation Methods

  /**
   * Get customer price based on warehouse assignment
   */
  async getCustomerWarehousePrice(
    input: GetCustomerPriceInput
  ): Promise<WarehousePriceResult | null> {
    const organizationId = this.requireOrganizationContext();
    
    const price = await warehouseRepository.getCustomerWarehousePrice({
      customerId: input.customerId,
      itemId: input.itemId,
      organizationId,
      date: input.date,
      quantity: input.quantity,
    });
    
    return price;
  }

  /**
   * Bulk assign customer warehouse assignments
   */
  async bulkAssignCustomerWarehouses(
    assignments: AssignCustomerWarehouseInput[]
  ): Promise<CustomerWarehouseAssignment[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate all inputs first
    const validatedAssignments = [];
    
    for (const assignment of assignments) {
      // Validate customer
      const customer = await entityRepository.findById(
        assignment.customerId,
        organizationId
      );
      if (!customer || !customer.entityTypes.includes('customer')) {
        throw new ServiceError(
          `Customer not found: ${assignment.customerId}`,
          'CUSTOMER_NOT_FOUND',
          404
        );
      }
      
      // Validate item
      const item = await itemsRepository.findById(
        assignment.itemId,
        organizationId
      );
      if (!item) {
        throw new ServiceError(
          `Item not found: ${assignment.itemId}`,
          'ITEM_NOT_FOUND',
          404
        );
      }
      
      // Validate warehouse
      const warehouse = await warehouseRepository.findWarehouseById(
        assignment.warehouseId,
        organizationId
      );
      if (!warehouse) {
        throw new ServiceError(
          `Warehouse not found: ${assignment.warehouseId}`,
          'WAREHOUSE_NOT_FOUND',
          404
        );
      }
      
      validatedAssignments.push({
        organizationId,
        customerId: assignment.customerId,
        itemId: assignment.itemId,
        warehouseId: assignment.warehouseId,
        isDefault: assignment.isDefault,
        effectiveDate: assignment.effectiveDate?.toISOString().split('T')[0],
        expirationDate: assignment.expirationDate?.toISOString().split('T')[0],
      });
    }
    
    const created = await warehouseRepository.bulkAssignCustomerWarehouses(
      validatedAssignments
    );
    
    return created.map(a => this.transformCustomerWarehouseAssignment(a));
  }
}