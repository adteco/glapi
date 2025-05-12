import { BaseService } from './base-service';
import { 
  Location, 
  CreateLocationInput, 
  UpdateLocationInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { locationRepository } from '@glapi/database/src/repositories';

export class LocationService extends BaseService {
  /**
   * Get a list of locations for the current organization
   */
  async listLocations(
    params: PaginationParams = {},
    sortField: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc',
    filters: { subsidiaryId?: string, countryCode?: string } = {}
  ): Promise<PaginatedResult<Location>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // If subsidiaryId filter is provided, use findBySubsidiary
    if (filters.subsidiaryId) {
      const locations = await locationRepository.findBySubsidiary(
        filters.subsidiaryId, 
        organizationId
      );

      // Additional filtering by country code if provided
      let filteredLocations = locations;
      if (filters.countryCode) {
        filteredLocations = locations.filter(
          location => location.countryCode === filters.countryCode
        );
      }
      
      // Manual pagination for the filtered case
      const startIdx = (page - 1) * limit;
      const endIdx = startIdx + limit;
      const paginatedLocations = filteredLocations.slice(startIdx, endIdx);
      
      return this.createPaginatedResult(
        paginatedLocations, 
        filteredLocations.length, 
        page, 
        limit
      );
    }
    
    // Regular paginated query
    // Note: For more complex filtering, we would want to enhance the repository's findAll method
    const result = await locationRepository.findAll(
      organizationId,
      page,
      limit,
      sortField,
      sortOrder
    );
    
    return {
      data: result.locations,
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit)
    };
  }
  
  /**
   * Get a location by ID
   */
  async getLocationById(id: string): Promise<Location | null> {
    const organizationId = this.requireOrganizationContext();
    return locationRepository.findById(id, organizationId);
  }
  
  /**
   * Create a new location
   */
  async createLocation(data: CreateLocationInput): Promise<Location> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate that the organization ID matches the context
    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'OrganizationId must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }
    
    // Create the location
    return locationRepository.create(data);
  }
  
  /**
   * Update an existing location
   */
  async updateLocation(id: string, data: UpdateLocationInput): Promise<Location> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if location exists and belongs to the organization
    const existing = await this.getLocationById(id);
    if (!existing) {
      throw new ServiceError(
        `Location with ID "${id}" not found`,
        'LOCATION_NOT_FOUND',
        404
      );
    }
    
    // Update the location
    const updated = await locationRepository.update(id, data, organizationId);
    
    if (!updated) {
      throw new ServiceError(
        `Failed to update location with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return updated;
  }
  
  /**
   * Delete a location
   */
  async deleteLocation(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if location exists and belongs to the organization
    const existing = await this.getLocationById(id);
    if (!existing) {
      throw new ServiceError(
        `Location with ID "${id}" not found`,
        'LOCATION_NOT_FOUND',
        404
      );
    }
    
    // Delete the location
    const success = await locationRepository.delete(id, organizationId);
    
    if (!success) {
      throw new ServiceError(
        `Failed to delete location with ID "${id}"`,
        'DELETE_FAILED',
        500
      );
    }
  }
}