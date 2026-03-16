// Browser clients should use the same-origin proxy surface.
export const API_URL = '/api/proxy';

export const apiEndpoints = {
  customers: `${API_URL}/api/customers`,
  vendors: `${API_URL}/api/vendors`,
  employees: `${API_URL}/api/employees`,
  leads: `${API_URL}/api/leads`,
  prospects: `${API_URL}/api/prospects`,
  contacts: `${API_URL}/api/contacts`,
} as const;
