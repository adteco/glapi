import { EntityService } from './entity-service';
import { 
  CreateEntityInput, 
  UpdateEntityInput, 
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  EmployeeMetadata
} from './types';

export class EmployeeService extends EntityService {
  
  /**
   * Transform database entity to match expected types
   */
  protected transformEntity(entity: any): BaseEntity {
    return {
      ...entity,
      createdAt: entity.createdAt instanceof Date ? entity.createdAt.toISOString() : entity.createdAt,
      updatedAt: entity.updatedAt instanceof Date ? entity.updatedAt.toISOString() : entity.updatedAt,
    };
  }

  /**
   * Transform array of database entities
   */
  protected transformEntities(entities: any[]): BaseEntity[] {
    return entities.map(entity => this.transformEntity(entity));
  }

  /**
   * List all employees
   */
  async listEmployees(
    organizationId: string,
    query: EntityListQuery
  ): Promise<EntityListResponse> {
    return this.list(organizationId, ['Employee'], query);
  }
  
  /**
   * Create a new employee
   */
  async createEmployee(
    organizationId: string,
    data: CreateEntityInput & { metadata?: EmployeeMetadata }
  ): Promise<BaseEntity> {
    return this.create(organizationId, ['Employee'], data);
  }
  
  /**
   * Update an employee
   */
  async updateEmployee(
    id: string,
    organizationId: string,
    data: UpdateEntityInput & { metadata?: EmployeeMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, organizationId, data);
  }
  
  /**
   * Find employees by department
   */
  async findByDepartment(
    department: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const employees = await this.repository.findByTypes(
      ['Employee'],
      organizationId,
      {
        limit: 1000,
      }
    );
    
    // Filter by department in metadata
    const filtered = employees.filter(e => 
      (e.metadata as EmployeeMetadata)?.department === department
    );
    return this.transformEntities(filtered);
  }
  
  /**
   * Find direct reports for a manager
   */
  async findDirectReports(
    managerId: string,
    organizationId: string
  ): Promise<BaseEntity[]> {
    const employees = await this.repository.findByTypes(
      ['Employee'],
      organizationId,
      {
        limit: 1000,
      }
    );
    
    // Filter by reportsTo in metadata
    const filtered = employees.filter(e => 
      (e.metadata as EmployeeMetadata)?.reportsTo === managerId
    );
    return this.transformEntities(filtered);
  }
  
  /**
   * Find by employee ID
   */
  async findByEmployeeId(
    employeeId: string,
    organizationId: string
  ): Promise<BaseEntity | null> {
    const employees = await this.repository.findByTypes(
      ['Employee'],
      organizationId,
      {
        searchTerm: employeeId,
        limit: 100,
      }
    );
    
    // Filter by employeeId in metadata
    const employee = employees.find(e => 
      (e.metadata as EmployeeMetadata)?.employeeId === employeeId
    );
    
    return employee ? this.transformEntity(employee) : null;
  }
}

export const employeeService = new EmployeeService();