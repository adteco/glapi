import { BaseService } from './base-service';
import { 
  LotNumber,
  SerialNumber,
  CreateLotNumberInput,
  UpdateLotNumberInput,
  CreateSerialNumberInput,
  UpdateSerialNumberInput,
  createLotNumberSchema,
  updateLotNumberSchema,
  createSerialNumberSchema,
  updateSerialNumberSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { 
  inventoryTrackingRepository,
  itemsRepository,
  entityRepository
} from '@glapi/database';

export class InventoryTrackingService extends BaseService {
  /**
   * Transform database lot number to service layer type
   */
  private transformLotNumber(dbRecord: any): LotNumber {
    return {
      id: dbRecord.id,
      itemId: dbRecord.itemId,
      lotNumber: dbRecord.lotNumber,
      expirationDate: dbRecord.expirationDate,
      manufactureDate: dbRecord.manufactureDate,
      receivedDate: dbRecord.receivedDate,
      vendorId: dbRecord.vendorId,
      quantityReceived: parseFloat(dbRecord.quantityReceived),
      quantityAvailable: parseFloat(dbRecord.quantityAvailable),
      quantityAllocated: parseFloat(dbRecord.quantityAllocated),
      unitCost: dbRecord.unitCost ? parseFloat(dbRecord.unitCost) : null,
      status: dbRecord.status,
      notes: dbRecord.notes,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Transform database serial number to service layer type
   */
  private transformSerialNumber(dbRecord: any): SerialNumber {
    return {
      id: dbRecord.id,
      itemId: dbRecord.itemId,
      serialNumber: dbRecord.serialNumber,
      lotNumberId: dbRecord.lotNumberId,
      vendorId: dbRecord.vendorId,
      receivedDate: dbRecord.receivedDate,
      soldDate: dbRecord.soldDate,
      customerId: dbRecord.customerId,
      warrantyEndDate: dbRecord.warrantyEndDate,
      status: dbRecord.status,
      notes: dbRecord.notes,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  // Lot Number Methods

  /**
   * List lot numbers for an item
   */
  async listLotNumbers(
    itemId: string,
    params: PaginationParams & { 
      status?: 'ACTIVE' | 'EXPIRED' | 'RECALLED';
      includeExpired?: boolean;
    } = {}
  ): Promise<PaginatedResult<LotNumber>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate item belongs to organization
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (!item.trackLotNumbers) {
      throw new ServiceError(
        'Item does not track lot numbers',
        'LOT_TRACKING_DISABLED',
        400
      );
    }
    
    const lotNumbers = await inventoryTrackingRepository.findLotsByItem(
      itemId,
      params.status,
      params.includeExpired
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = lotNumbers.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(l => this.transformLotNumber(l)),
      lotNumbers.length,
      page,
      limit
    );
  }

  /**
   * Get a lot number by ID
   */
  async getLotNumber(id: string): Promise<LotNumber> {
    const organizationId = this.requireOrganizationContext();
    
    const lotNumber = await inventoryTrackingRepository.findLotById(id);
    if (!lotNumber) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(lotNumber.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    return this.transformLotNumber(lotNumber);
  }

  /**
   * Create a lot number
   */
  async createLotNumber(input: CreateLotNumberInput): Promise<LotNumber> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createLotNumberSchema.parse(input);
    
    // Validate item
    const item = await itemsRepository.findById(
      validatedInput.itemId,
      organizationId
    );
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (!item.trackLotNumbers) {
      throw new ServiceError(
        'Item does not track lot numbers',
        'LOT_TRACKING_DISABLED',
        400
      );
    }
    
    // Validate vendor if provided
    if (validatedInput.vendorId) {
      const vendor = await entityRepository.findById(
        validatedInput.vendorId,
        organizationId
      );
      if (!vendor || vendor.entityType !== 'Vendor') {
        throw new ServiceError(
          'Vendor not found',
          'VENDOR_NOT_FOUND',
          404
        );
      }
    }
    
    // Check for duplicate lot number
    const existing = await inventoryTrackingRepository.findLotByNumber(
      validatedInput.itemId,
      validatedInput.lotNumber
    );
    if (existing) {
      throw new ServiceError(
        'Lot number already exists for this item',
        'DUPLICATE_LOT',
        409
      );
    }
    
    const created = await inventoryTrackingRepository.createLot({
      itemId: validatedInput.itemId,
      lotNumber: validatedInput.lotNumber,
      expirationDate: validatedInput.expirationDate,
      manufactureDate: validatedInput.manufactureDate,
      receivedDate: validatedInput.receivedDate,
      vendorId: validatedInput.vendorId,
      quantityReceived: validatedInput.quantityReceived.toString(),
      quantityAvailable: validatedInput.quantityAvailable.toString(),
      quantityAllocated: '0',
      unitCost: validatedInput.unitCost?.toString(),
      status: validatedInput.status || 'ACTIVE',
      notes: validatedInput.notes,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformLotNumber(created);
  }

  /**
   * Update a lot number
   */
  async updateLotNumber(
    id: string,
    input: UpdateLotNumberInput
  ): Promise<LotNumber> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateLotNumberSchema.parse(input);
    
    // Get existing lot
    const existing = await inventoryTrackingRepository.findLotById(id);
    if (!existing) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(existing.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Check if lot number is being changed
    if (validatedInput.lotNumber && validatedInput.lotNumber !== existing.lotNumber) {
      const duplicate = await inventoryTrackingRepository.findLotByNumber(
        existing.itemId,
        validatedInput.lotNumber
      );
      if (duplicate) {
        throw new ServiceError(
          'Lot number already exists for this item',
          'DUPLICATE_LOT',
          409
        );
      }
    }
    
    const updateData: any = {
      ...validatedInput,
      updatedBy: userId,
    };
    
    // Convert numeric fields
    if (validatedInput.quantityReceived !== undefined) {
      updateData.quantityReceived = validatedInput.quantityReceived.toString();
    }
    if (validatedInput.quantityAvailable !== undefined) {
      updateData.quantityAvailable = validatedInput.quantityAvailable.toString();
    }
    if (validatedInput.unitCost !== undefined) {
      updateData.unitCost = validatedInput.unitCost?.toString() || null;
    }
    
    const updated = await inventoryTrackingRepository.updateLot(id, updateData);
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update lot number',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformLotNumber(updated);
  }

  /**
   * Delete a lot number
   */
  async deleteLotNumber(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Get existing lot
    const existing = await inventoryTrackingRepository.findLotById(id);
    if (!existing) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(existing.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Check if lot has allocated quantity
    if (parseFloat(existing.quantityAllocated) > 0) {
      throw new ServiceError(
        'Cannot delete lot with allocated quantity',
        'HAS_ALLOCATIONS',
        409
      );
    }
    
    // Check if lot has serial numbers
    const serialCount = await inventoryTrackingRepository.getSerialCountByLot(id);
    if (serialCount > 0) {
      throw new ServiceError(
        'Cannot delete lot with associated serial numbers',
        'HAS_SERIALS',
        409
      );
    }
    
    await inventoryTrackingRepository.deleteLot(id);
  }

  // Serial Number Methods

  /**
   * List serial numbers for an item
   */
  async listSerialNumbers(
    itemId: string,
    params: PaginationParams & { 
      status?: 'AVAILABLE' | 'SOLD' | 'IN_TRANSIT' | 'RETURNED' | 'DAMAGED' | 'LOST';
      lotNumberId?: string;
    } = {}
  ): Promise<PaginatedResult<SerialNumber>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate item belongs to organization
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (!item.trackSerialNumbers) {
      throw new ServiceError(
        'Item does not track serial numbers',
        'SERIAL_TRACKING_DISABLED',
        400
      );
    }
    
    const serialNumbers = await inventoryTrackingRepository.findSerialsByItem(
      itemId,
      params.status,
      params.lotNumberId
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = serialNumbers.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(s => this.transformSerialNumber(s)),
      serialNumbers.length,
      page,
      limit
    );
  }

  /**
   * Get a serial number by ID
   */
  async getSerialNumber(id: string): Promise<SerialNumber> {
    const organizationId = this.requireOrganizationContext();
    
    const serialNumber = await inventoryTrackingRepository.findSerialById(id);
    if (!serialNumber) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(serialNumber.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    return this.transformSerialNumber(serialNumber);
  }

  /**
   * Create a serial number
   */
  async createSerialNumber(input: CreateSerialNumberInput): Promise<SerialNumber> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createSerialNumberSchema.parse(input);
    
    // Validate item
    const item = await itemsRepository.findById(
      validatedInput.itemId,
      organizationId
    );
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    if (!item.trackSerialNumbers) {
      throw new ServiceError(
        'Item does not track serial numbers',
        'SERIAL_TRACKING_DISABLED',
        400
      );
    }
    
    // Validate lot number if provided
    if (validatedInput.lotNumberId) {
      const lot = await inventoryTrackingRepository.findLotById(
        validatedInput.lotNumberId
      );
      if (!lot || lot.itemId !== validatedInput.itemId) {
        throw new ServiceError(
          'Invalid lot number',
          'INVALID_LOT',
          400
        );
      }
    }
    
    // Validate vendor if provided
    if (validatedInput.vendorId) {
      const vendor = await entityRepository.findById(
        validatedInput.vendorId,
        organizationId
      );
      if (!vendor || vendor.entityType !== 'Vendor') {
        throw new ServiceError(
          'Vendor not found',
          'VENDOR_NOT_FOUND',
          404
        );
      }
    }
    
    // Validate customer if provided
    if (validatedInput.customerId) {
      const customer = await entityRepository.findById(
        validatedInput.customerId,
        organizationId
      );
      if (!customer || customer.entityType !== 'Customer') {
        throw new ServiceError(
          'Customer not found',
          'CUSTOMER_NOT_FOUND',
          404
        );
      }
    }
    
    // Check for duplicate serial number
    const existing = await inventoryTrackingRepository.findSerialByNumber(
      validatedInput.serialNumber
    );
    if (existing) {
      throw new ServiceError(
        'Serial number already exists',
        'DUPLICATE_SERIAL',
        409
      );
    }
    
    const created = await inventoryTrackingRepository.createSerial({
      itemId: validatedInput.itemId,
      serialNumber: validatedInput.serialNumber,
      lotNumberId: validatedInput.lotNumberId,
      vendorId: validatedInput.vendorId,
      receivedDate: validatedInput.receivedDate,
      soldDate: validatedInput.soldDate,
      customerId: validatedInput.customerId,
      warrantyEndDate: validatedInput.warrantyEndDate,
      status: validatedInput.status || 'AVAILABLE',
      notes: validatedInput.notes,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformSerialNumber(created);
  }

  /**
   * Update a serial number
   */
  async updateSerialNumber(
    id: string,
    input: UpdateSerialNumberInput
  ): Promise<SerialNumber> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateSerialNumberSchema.parse(input);
    
    // Get existing serial
    const existing = await inventoryTrackingRepository.findSerialById(id);
    if (!existing) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(existing.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    // Validate customer if being changed
    if (validatedInput.customerId !== undefined && validatedInput.customerId) {
      const customer = await entityRepository.findById(
        validatedInput.customerId,
        organizationId
      );
      if (!customer || customer.entityType !== 'Customer') {
        throw new ServiceError(
          'Customer not found',
          'CUSTOMER_NOT_FOUND',
          404
        );
      }
    }
    
    const updated = await inventoryTrackingRepository.updateSerial(
      id,
      {
        ...validatedInput,
        updatedBy: userId,
      }
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update serial number',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformSerialNumber(updated);
  }

  /**
   * Delete a serial number
   */
  async deleteSerialNumber(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Get existing serial
    const existing = await inventoryTrackingRepository.findSerialById(id);
    if (!existing) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(existing.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    // Don't allow deletion of sold serial numbers
    if (existing.status === 'SOLD') {
      throw new ServiceError(
        'Cannot delete sold serial number',
        'SERIAL_SOLD',
        409
      );
    }
    
    await inventoryTrackingRepository.deleteSerial(id);
  }

  // Utility Methods

  /**
   * Allocate lot quantity for a transaction
   */
  async allocateLotQuantity(
    lotNumberId: string,
    quantity: number
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    const lot = await inventoryTrackingRepository.findLotById(lotNumberId);
    if (!lot) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(lot.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    const allocated = await inventoryTrackingRepository.allocateLotQuantity(
      lotNumberId,
      quantity
    );
    
    if (!allocated) {
      throw new ServiceError(
        'Insufficient quantity available',
        'INSUFFICIENT_QUANTITY',
        409
      );
    }
  }

  /**
   * Deallocate lot quantity
   */
  async deallocateLotQuantity(
    lotNumberId: string,
    quantity: number
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    const lot = await inventoryTrackingRepository.findLotById(lotNumberId);
    if (!lot) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership through item
    const item = await itemsRepository.findById(lot.itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Lot number not found',
        'LOT_NOT_FOUND',
        404
      );
    }
    
    await inventoryTrackingRepository.deallocateLotQuantity(
      lotNumberId,
      quantity
    );
  }

  /**
   * Get available lot numbers for an item (FIFO order)
   */
  async getAvailableLots(
    itemId: string,
    quantityNeeded?: number
  ): Promise<LotNumber[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    const lots = await inventoryTrackingRepository.getAvailableLots(
      itemId,
      quantityNeeded
    );
    
    return lots.map(l => this.transformLotNumber(l));
  }

  /**
   * Get available serial numbers for an item
   */
  async getAvailableSerials(
    itemId: string,
    limit?: number
  ): Promise<SerialNumber[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    const serials = await inventoryTrackingRepository.getAvailableSerials(
      itemId,
      limit
    );
    
    return serials.map(s => this.transformSerialNumber(s));
  }

  /**
   * Mark serial number as sold
   */
  async markSerialAsSold(
    serialNumberId: string,
    customerId: string,
    soldDate?: Date
  ): Promise<SerialNumber> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate customer
    const customer = await entityRepository.findById(customerId, organizationId);
    if (!customer || customer.entityType !== 'Customer') {
      throw new ServiceError(
        'Customer not found',
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    const updated = await inventoryTrackingRepository.updateSerial(
      serialNumberId,
      {
        status: 'SOLD',
        customerId,
        soldDate: soldDate || new Date(),
        updatedBy: userId,
      }
    );
    
    if (!updated) {
      throw new ServiceError(
        'Serial number not found',
        'SERIAL_NOT_FOUND',
        404
      );
    }
    
    return this.transformSerialNumber(updated);
  }

  /**
   * Check expiring lots
   */
  async getExpiringLots(daysAhead: number = 30): Promise<LotNumber[]> {
    const organizationId = this.requireOrganizationContext();
    
    const lots = await inventoryTrackingRepository.getExpiringLots(
      organizationId,
      daysAhead
    );
    
    return lots.map(l => this.transformLotNumber(l));
  }
}