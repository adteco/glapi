// Export base repository
export * from './base-repository';

// Export entity repositories
export * from './customer-repository';
export * from './organization-repository';
export * from './subsidiary-repository';
export * from './department-repository';
export * from './location-repository';
export * from './class-repository';
export * from './account-repository';
export * from './entity-repository';

// Export GL repositories
export * from './gl-transaction-repository';
export * from './gl-reporting-repository';

// Export repository instances for dependency injection
import { DepartmentRepository } from './department-repository';
import { LocationRepository } from './location-repository';
import { ClassRepository } from './class-repository';
import { AccountRepository } from './account-repository';
import { EntityRepository } from './entity-repository';
import { GlTransactionRepository } from './gl-transaction-repository';
import { GlReportingRepository } from './gl-reporting-repository';

export const departmentRepository = new DepartmentRepository();
export const locationRepository = new LocationRepository();
export const classRepository = new ClassRepository();
export const accountRepository = new AccountRepository();
export const entityRepository = new EntityRepository();
export const glTransactionRepository = new GlTransactionRepository();
export const glReportingRepository = new GlReportingRepository();
