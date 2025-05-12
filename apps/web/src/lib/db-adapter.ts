/**
 * A database adapter for the web application that uses the Express API endpoints
 * running on port 3001.
 *
 * In development, we use a Next.js rewrite rule to proxy API requests to the Express API
 * to avoid CORS issues.
 */
import { useStytchMemberSession } from '@stytch/nextjs/b2b';
import { useState, useEffect } from 'react';

// Define types locally to avoid importing from api-service
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  companyName: string;
  customerId: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: Address;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Subsidiary {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// The base API URL - use the built-in proxy in development
const API_BASE_URL = '/api/v1';

// Helper function to get organization ID from Stytch session
const getHeaders = () => {
  // Default headers without organization ID
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  try {
    // Try to access window to check if we're in browser
    if (typeof window !== 'undefined') {
      // Try to get the organization IDs from localStorage
      const cachedStytchOrgId = localStorage.getItem('stytch_org_id');
      const cachedDbOrgId = localStorage.getItem('db_org_id');

      // Only add the organization ID if we have a valid one in localStorage
      if (cachedStytchOrgId &&
          cachedStytchOrgId !== '00000000-0000-0000-0000-000000000001' &&
          cachedStytchOrgId !== 'undefined' &&
          cachedStytchOrgId !== 'null') {
        return {
          ...defaultHeaders,
          'x-stytch-organization-id': cachedStytchOrgId
        };
      }
    }
  } catch (error) {
    console.error('Error getting organization ID:', error);
  }

  return defaultHeaders;
};

// Hook to use in components to get the authenticated headers
export const useAuthHeaders = () => {
  const { session } = useStytchMemberSession();

  // Create a more complex hook that handles the organization lookup
  const [headers, setHeaders] = useState(getHeaders());

  useEffect(() => {
    const updateHeaders = async () => {
      if (session?.organization?.organization_id) {
        const stytchOrgId = session.organization.organization_id;

        // Cache the Stytch organization ID
        if (typeof window !== 'undefined') {
          localStorage.setItem('stytch_org_id', stytchOrgId);
        }

        // Set initial headers with Stytch ID
        // Set initial headers with Stytch organization ID only
        const initialHeaders = {
          'Content-Type': 'application/json',
          'x-stytch-organization-id': stytchOrgId,
          'x-user-id': session.member.user_id
        };

        setHeaders(initialHeaders);

        try {
          // Try to get cached DB org ID first
          let dbOrgId = typeof window !== 'undefined' ? localStorage.getItem('db_org_id') : null;

          if (!dbOrgId) {
            // If not cached, look up the internal organization ID using the Stytch ID
            // Pass initialHeaders to avoid circular dependency
            const result = await apiClient.organizations.lookupByStytchId(stytchOrgId, initialHeaders);

            if (result.organization?.id) {
              dbOrgId = result.organization.id;

              // Store the database organization ID in localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('db_org_id', dbOrgId);
              }
            }
          }

          if (dbOrgId) {
            // Update headers with the real database organization ID
            setHeaders({
              ...initialHeaders,
              'x-organization-id': dbOrgId
            });
          }
        } catch (error) {
          console.error('Error in auth headers organization lookup:', error);
          // We already set the initial headers, so just continue with those
        }
      } else {
        setHeaders(getHeaders());
      }
    };

    updateHeaders();
  }, [session]);

  return headers;
};

// Client-side API methods
export const apiClient = {
  organizations: {
    async lookupByStytchId(stytchOrgId: string, customHeaders?: Record<string, string>) {
      // Get explicit headers to avoid circular dependency with useAuthHeaders
      const headers = customHeaders || {
        'Content-Type': 'application/json',
        'x-stytch-organization-id': stytchOrgId
      };

      console.log('Looking up organization with headers:', headers);

      const response = await fetch(`${API_BASE_URL}/organizations/lookup?stytchOrgId=${stytchOrgId}`, {
        credentials: 'include', // Include cookies for authentication
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to lookup organization');
      }

      return await response.json();
    },

    async list() {
      const response = await fetch(`${API_BASE_URL}/organizations`, {
        credentials: 'include', // Include cookies for authentication
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch organizations');
      }

      return await response.json();
    }
  },

  customers: {
    async list(params?: {
      page?: number;
      limit?: number;
      orderBy?: 'companyName' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
      status?: string;
    }, stytchOrgId?: string): Promise<PaginatedResult<Customer>> {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params?.orderDirection) queryParams.append('orderDirection', params.orderDirection);
      if (params?.status) queryParams.append('status', params.status);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/customers${queryString}`, {
        credentials: 'include', // Include cookies for authentication
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch customers');
      }

      return await response.json();
    },

    async getById(id: string, stytchOrgId?: string): Promise<{ customer: Customer }> {
      console.log(`[db-adapter.getById] Called with id: '${id}', stytchOrgId (param): '${stytchOrgId}'`);

      const initialHeaders = getHeaders(); // Get headers which might contain placeholder from localStorage
      console.log(`[db-adapter.getById] Initial headers from getHeaders():`, JSON.parse(JSON.stringify(initialHeaders)));

      const finalHeaders = { ...initialHeaders }; // Create a mutable copy

      if (stytchOrgId && stytchOrgId.trim() !== '') {
        console.log(`[db-adapter.getById] Valid stytchOrgId param ('${stytchOrgId}') received, overriding header.`);
        finalHeaders['x-stytch-organization-id'] = stytchOrgId;
      } else {
        console.warn(`[db-adapter.getById] stytchOrgId param was undefined or empty. Using x-stytch-organization-id from getHeaders(): '${finalHeaders['x-stytch-organization-id']}'`);
      }

      console.log(`[db-adapter.getById] Final headers for fetch:`, JSON.parse(JSON.stringify(finalHeaders)));

      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        credentials: 'include',
        headers: finalHeaders
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch customer');
      }

      return await response.json();
    },

    async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>, stytchOrgId?: string) {
      // Get current headers or use provided custom headers
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      console.log('Creating customer with headers:', headers);

      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Customer creation failed:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create customer');
      }

      return await response.json();
    },

    async update(id: string, data: Partial<Omit<Customer, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }
      console.log(`[apiClient.update] Updating customer ${id} with headers:`, headers);

      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update customer');
      }

      return await response.json();
    },

    async delete(id: string, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }
      console.log(`[apiClient.delete] Deleting customer ${id} with headers:`, headers);

      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to delete customer');
      }

      return await response.json();
    }
  },

  subsidiaries: {
    async list(params?: {
      page?: number;
      limit?: number;
      orderBy?: 'name' | 'createdAt';
      orderDirection?: 'asc' | 'desc';
      isActive?: boolean;
      parentId?: string | null;
    }, stytchOrgId?: string): Promise<PaginatedResult<Subsidiary>> {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params?.orderDirection) queryParams.append('orderDirection', params.orderDirection);
      if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
      if (params?.parentId !== undefined) queryParams.append('parentId', params.parentId === null ? 'null' : params.parentId);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/subsidiaries${queryString}`, {
        credentials: 'include', // Include cookies for authentication
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch subsidiaries');
      }

      return await response.json();
    },

    async getById(id: string, stytchOrgId?: string): Promise<{ subsidiary: Subsidiary }> {
      console.log(`[db-adapter.subsidiaries.getById] Called with id: '${id}', stytchOrgId (param): '${stytchOrgId}'`);

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/subsidiaries/${id}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch subsidiary');
      }

      return await response.json();
    },

    async create(data: Omit<Subsidiary, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      console.log('Creating subsidiary with headers:', headers);

      const response = await fetch(`${API_BASE_URL}/subsidiaries`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Subsidiary creation failed:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create subsidiary');
      }

      return await response.json();
    },

    async update(id: string, data: Partial<Omit<Subsidiary, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/subsidiaries/${id}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update subsidiary');
      }

      return await response.json();
    },

    async delete(id: string, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/subsidiaries/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to delete subsidiary');
      }

      return await response.json();
    }
  },

  departments: {
    async list(params?: {
      page?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      subsidiaryId?: string;
    }, stytchOrgId?: string): Promise<PaginatedResult<Department>> {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.sortField) queryParams.append('sortField', params.sortField);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      if (params?.subsidiaryId) queryParams.append('subsidiaryId', params.subsidiaryId);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/departments${queryString}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch departments');
      }

      return await response.json();
    },

    async getById(id: string, stytchOrgId?: string): Promise<{ department: Department }> {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch department');
      }

      return await response.json();
    },

    async create(data: Omit<Department, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/departments`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Department creation failed:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create department');
      }

      return await response.json();
    },

    async update(id: string, data: Partial<Omit<Department, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update department');
      }

      return await response.json();
    },

    async delete(id: string, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to delete department');
      }

      return await response.json();
    }
  },

  locations: {
    async list(params?: {
      page?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      subsidiaryId?: string;
      countryCode?: string;
    }, stytchOrgId?: string): Promise<PaginatedResult<Location>> {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.sortField) queryParams.append('sortField', params.sortField);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      if (params?.subsidiaryId) queryParams.append('subsidiaryId', params.subsidiaryId);
      if (params?.countryCode) queryParams.append('countryCode', params.countryCode);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/locations${queryString}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch locations');
      }

      return await response.json();
    },

    async getById(id: string, stytchOrgId?: string): Promise<{ location: Location }> {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/locations/${id}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch location');
      }

      return await response.json();
    },

    async create(data: Omit<Location, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/locations`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Location creation failed:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create location');
      }

      return await response.json();
    },

    async update(id: string, data: Partial<Omit<Location, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/locations/${id}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update location');
      }

      return await response.json();
    },

    async delete(id: string, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/locations/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to delete location');
      }

      return await response.json();
    }
  },

  classes: {
    async list(params?: {
      page?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      subsidiaryId?: string;
    }, stytchOrgId?: string): Promise<PaginatedResult<Class>> {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.sortField) queryParams.append('sortField', params.sortField);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      if (params?.subsidiaryId) queryParams.append('subsidiaryId', params.subsidiaryId);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/classes${queryString}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch classes');
      }

      return await response.json();
    },

    async getById(id: string, stytchOrgId?: string): Promise<{ class: Class }> {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/classes/${id}`, {
        credentials: 'include',
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch class');
      }

      return await response.json();
    },

    async create(data: Omit<Class, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/classes`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Class creation failed:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to create class');
      }

      return await response.json();
    },

    async update(id: string, data: Partial<Omit<Class, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/classes/${id}`, {
        method: 'PUT',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update class');
      }

      return await response.json();
    },

    async delete(id: string, stytchOrgId?: string) {
      const headers = getHeaders();
      if (stytchOrgId) {
        headers['x-stytch-organization-id'] = stytchOrgId;
      }

      const response = await fetch(`${API_BASE_URL}/classes/${id}`, {
        method: 'DELETE',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to delete class');
      }

      return await response.json();
    }
  }
};