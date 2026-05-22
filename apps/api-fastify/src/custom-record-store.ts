import type {
  CustomRecord,
  CustomRecordTypeDefinition,
} from '@glapi/types/custom-records';

const customRecordTypeStore = new Map<string, Map<string, CustomRecordTypeDefinition>>();
const customRecordStore = new Map<string, Map<string, CustomRecord>>();

export function customRecordTypeOrganizationStore(organizationId: string): Map<string, CustomRecordTypeDefinition> {
  let store = customRecordTypeStore.get(organizationId);
  if (!store) {
    store = new Map<string, CustomRecordTypeDefinition>();
    customRecordTypeStore.set(organizationId, store);
  }
  return store;
}

export function customRecordOrganizationStore(organizationId: string): Map<string, CustomRecord> {
  let store = customRecordStore.get(organizationId);
  if (!store) {
    store = new Map<string, CustomRecord>();
    customRecordStore.set(organizationId, store);
  }
  return store;
}

export function listCustomRecordTypesForOrganization(organizationId: string): CustomRecordTypeDefinition[] {
  return Array.from(customRecordTypeOrganizationStore(organizationId).values())
    .sort((a, b) => a.recordKey.localeCompare(b.recordKey));
}

export function listCustomRecordsForOrganization(organizationId: string): CustomRecord[] {
  return Array.from(customRecordOrganizationStore(organizationId).values())
    .sort((a, b) => a.recordKey.localeCompare(b.recordKey) || a.name.localeCompare(b.name));
}

export function resetCustomRecordStore(): void {
  customRecordTypeStore.clear();
  customRecordStore.clear();
}
