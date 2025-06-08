import { DepartmentRepository } from './department-repository';
import { LocationRepository } from './location-repository';
import { ClassRepository } from './class-repository';
import { AccountRepository } from './account-repository';
import { EntityRepository } from './entity-repository';
import { GlTransactionRepository } from './gl-transaction-repository';
import { GlReportingRepository } from './gl-reporting-repository';
import { UnitsOfMeasureRepository } from './units-of-measure-repository';
import { ItemCategoriesRepository } from './item-categories-repository';
import { ItemsRepository } from './items-repository';
import { PricingRepository } from './pricing-repository';
import { VendorItemsRepository } from './vendor-items-repository';
import { InventoryTrackingRepository } from './inventory-tracking-repository';
import { AssembliesKitsRepository } from './assemblies-kits-repository';

// Singleton instances
let _repositories: {
  departmentRepository?: DepartmentRepository;
  locationRepository?: LocationRepository;
  classRepository?: ClassRepository;
  accountRepository?: AccountRepository;
  entityRepository?: EntityRepository;
  glTransactionRepository?: GlTransactionRepository;
  glReportingRepository?: GlReportingRepository;
  unitsOfMeasureRepository?: UnitsOfMeasureRepository;
  itemCategoriesRepository?: ItemCategoriesRepository;
  itemsRepository?: ItemsRepository;
  pricingRepository?: PricingRepository;
  vendorItemsRepository?: VendorItemsRepository;
  inventoryTrackingRepository?: InventoryTrackingRepository;
  assembliesKitsRepository?: AssembliesKitsRepository;
} = {};

export function getRepositories() {
  if (!_repositories.departmentRepository) {
    _repositories.departmentRepository = new DepartmentRepository();
  }
  if (!_repositories.locationRepository) {
    _repositories.locationRepository = new LocationRepository();
  }
  if (!_repositories.classRepository) {
    _repositories.classRepository = new ClassRepository();
  }
  if (!_repositories.accountRepository) {
    _repositories.accountRepository = new AccountRepository();
  }
  if (!_repositories.entityRepository) {
    _repositories.entityRepository = new EntityRepository();
  }
  if (!_repositories.glTransactionRepository) {
    _repositories.glTransactionRepository = new GlTransactionRepository();
  }
  if (!_repositories.glReportingRepository) {
    _repositories.glReportingRepository = new GlReportingRepository();
  }
  if (!_repositories.unitsOfMeasureRepository) {
    _repositories.unitsOfMeasureRepository = new UnitsOfMeasureRepository();
  }
  if (!_repositories.itemCategoriesRepository) {
    _repositories.itemCategoriesRepository = new ItemCategoriesRepository();
  }
  if (!_repositories.itemsRepository) {
    _repositories.itemsRepository = new ItemsRepository();
  }
  if (!_repositories.pricingRepository) {
    _repositories.pricingRepository = new PricingRepository();
  }
  if (!_repositories.vendorItemsRepository) {
    _repositories.vendorItemsRepository = new VendorItemsRepository();
  }
  if (!_repositories.inventoryTrackingRepository) {
    _repositories.inventoryTrackingRepository = new InventoryTrackingRepository();
  }
  if (!_repositories.assembliesKitsRepository) {
    _repositories.assembliesKitsRepository = new AssembliesKitsRepository();
  }
  
  return _repositories as Required<typeof _repositories>;
}