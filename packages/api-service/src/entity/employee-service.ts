import { EntityService } from './entity-service';
import {
  CreateEntityInput,
  UpdateEntityInput,
  EntityListQuery,
  EntityListResponse,
  BaseEntity,
  EmployeeMetadata
} from './types';
import { ServiceContext } from '../types';

export class EmployeeService extends EntityService {

  constructor(context: ServiceContext = {}) {
    super(context);
  }

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
  async listEmployees(query: EntityListQuery): Promise<EntityListResponse> {
    return this.list(['Employee'], query);
  }

  /**
   * Create a new employee
   */
  async createEmployee(
    data: CreateEntityInput & { metadata?: EmployeeMetadata }
  ): Promise<BaseEntity> {
    return this.create(['Employee'], data);
  }

  /**
   * Update an employee
   */
  async updateEmployee(
    id: string,
    data: UpdateEntityInput & { metadata?: EmployeeMetadata }
  ): Promise<BaseEntity> {
    return this.update(id, data);
  }

  /**
   * Find employees by department
   */
  async findByDepartment(department: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
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
  async findDirectReports(managerId: string): Promise<BaseEntity[]> {
    const organizationId = this.requireOrganizationContext();
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
  async findByEmployeeId(employeeId: string): Promise<BaseEntity | null> {
    const organizationId = this.requireOrganizationContext();
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

// Note: Prefer creating new instances with serviceContext rather than using singleton
export const employeeService = new EmployeeService();