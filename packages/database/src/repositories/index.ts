// Export base repository
export * from './base-repository';

// Export entity repositories with their types
export * from './department-repository';
export * from './location-repository';
export * from './class-repository';

// Export repository instances
import { DepartmentRepository } from './department-repository';
import { LocationRepository } from './location-repository';
import { ClassRepository } from './class-repository';

// Repository instances for dependency injection
export const departmentRepository = new DepartmentRepository();
export const locationRepository = new LocationRepository();
export const classRepository = new ClassRepository();