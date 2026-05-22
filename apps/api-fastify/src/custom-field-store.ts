import type { CustomFieldDefinition } from '@glapi/types/custom-fields';

const customFieldStore = new Map<string, Map<string, CustomFieldDefinition>>();

export function customFieldOrganizationStore(organizationId: string): Map<string, CustomFieldDefinition> {
  let store = customFieldStore.get(organizationId);
  if (!store) {
    store = new Map<string, CustomFieldDefinition>();
    customFieldStore.set(organizationId, store);
  }
  return store;
}

export function listCustomFieldDefinitionsForOrganization(organizationId: string): CustomFieldDefinition[] {
  return Array.from(customFieldOrganizationStore(organizationId).values())
    .sort((a, b) => a.recordKey.localeCompare(b.recordKey) || a.ui.displayOrder - b.ui.displayOrder);
}

export function resetCustomFieldStore(): void {
  customFieldStore.clear();
}
