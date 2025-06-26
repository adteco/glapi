// API configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiEndpoints = {
  customers: `${API_URL}/api/customers`,
  vendors: `${API_URL}/api/vendors`,
  employees: `${API_URL}/api/employees`,
  leads: `${API_URL}/api/leads`,
  prospects: `${API_URL}/api/prospects`,
  contacts: `${API_URL}/api/contacts`,
} as const;