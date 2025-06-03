// API configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiEndpoints = {
  customers: `${API_URL}/api/v1/customers`,
  vendors: `${API_URL}/api/v1/vendors`,
  employees: `${API_URL}/api/v1/employees`,
  leads: `${API_URL}/api/v1/leads`,
  prospects: `${API_URL}/api/v1/prospects`,
  contacts: `${API_URL}/api/v1/contacts`,
} as const;