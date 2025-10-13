// Common type definitions for all entity tools
export interface BaseEntity {
  id: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  entityTypes: string[];
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: any;
  parentEntityId?: string | null;
  primaryContactId?: string | null;
  taxId?: string | null;
  description?: string | null;
  notes?: string | null;
  customFields?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  status: 'active' | 'inactive' | 'archived';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EntityListResponse {
  items: BaseEntity[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}