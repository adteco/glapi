import {
  Home,
  MessageCircle,
  FileText,
  Inbox,
  Briefcase,
  Calendar,
  ListOrdered,
  Library,
  Network,
  MapPinned,
  Building,
  Clock,
  CreditCard,
  Zap,
  Users,
  Ticket,
  HardHat,
  Shield,
  Package,
  Ruler,
  Tags,
  Building2,
  Workflow,
  SlidersHorizontal,
  Settings2,
  BookOpen,
  ShoppingCart,
  FileBarChart,
  Target,
  Truck,
  DollarSign,
  Receipt,
  ClipboardList,
  ArrowRightLeft,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// Page category types for styling
export type PageCategory =
  | 'main'
  | 'accounting'
  | 'relationships'
  | 'items'
  | 'settings'
  | 'sales'
  | 'inventory'
  | 'purchasing'
  | 'expenses'
  | 'recurring';

// Category styling configuration
export const CATEGORY_CONFIG: Record<PageCategory, { color: string; label: string }> = {
  main: { color: 'bg-blue-500/10 text-blue-500', label: 'Main' },
  accounting: { color: 'bg-emerald-500/10 text-emerald-500', label: 'Accounting' },
  relationships: { color: 'bg-purple-500/10 text-purple-500', label: 'Relationships' },
  items: { color: 'bg-orange-500/10 text-orange-500', label: 'Items' },
  settings: { color: 'bg-gray-500/10 text-gray-400', label: 'Settings' },
  sales: { color: 'bg-green-500/10 text-green-500', label: 'Sales' },
  inventory: { color: 'bg-amber-500/10 text-amber-500', label: 'Inventory' },
  purchasing: { color: 'bg-cyan-500/10 text-cyan-500', label: 'Purchasing' },
  expenses: { color: 'bg-red-500/10 text-red-500', label: 'Expenses' },
  recurring: { color: 'bg-indigo-500/10 text-indigo-500', label: 'Recurring Revenue' },
};

export interface PageEntry {
  name: string;
  path: string;
  icon: LucideIcon;
  category: PageCategory;
  keywords?: string[];
}

// All navigable pages in the application
export const PAGE_REGISTRY: PageEntry[] = [
  // Main
  { name: 'Dashboard', path: '/dashboard', icon: Home, category: 'main', keywords: ['home', 'overview'] },
  { name: 'Chat', path: '/chat', icon: MessageCircle, category: 'main', keywords: ['ai', 'assistant', 'talk'] },
  { name: 'Reports', path: '/reports', icon: FileText, category: 'main', keywords: ['analytics', 'data'] },
  { name: 'Magic Inbox', path: '/pending-documents', icon: Inbox, category: 'main', keywords: ['documents', 'pending', 'inbox'] },

  // Accounting
  { name: 'Accounting Periods', path: '/lists/accounting-periods', icon: Calendar, category: 'accounting', keywords: ['periods', 'fiscal'] },
  { name: 'Accounts', path: '/lists/accounts', icon: ListOrdered, category: 'accounting', keywords: ['chart of accounts', 'gl'] },
  { name: 'Classes', path: '/lists/classes', icon: Library, category: 'accounting', keywords: ['classification'] },
  { name: 'Departments', path: '/lists/departments', icon: Network, category: 'accounting', keywords: ['dept', 'division'] },
  { name: 'Locations', path: '/lists/locations', icon: MapPinned, category: 'accounting', keywords: ['site', 'place'] },
  { name: 'Subsidiaries', path: '/lists/subsidiaries', icon: Building, category: 'accounting', keywords: ['sub', 'entity', 'company'] },
  { name: 'Payment Terms', path: '/lists/payment-terms', icon: Clock, category: 'accounting', keywords: ['terms', 'net'] },
  { name: 'Payment Methods', path: '/lists/payment-methods', icon: CreditCard, category: 'accounting', keywords: ['pay', 'method'] },
  { name: 'Charge Types', path: '/lists/charge-types', icon: Zap, category: 'accounting', keywords: ['charges'] },

  // Relationships
  { name: 'Contacts', path: '/relationships/contacts', icon: Users, category: 'relationships', keywords: ['contact', 'people'] },
  { name: 'Customers', path: '/relationships/customers', icon: Users, category: 'relationships', keywords: ['customer', 'client', 'cust'] },
  { name: 'Employees', path: '/relationships/employees', icon: Users, category: 'relationships', keywords: ['employee', 'staff', 'emp'] },
  { name: 'Leads', path: '/relationships/leads', icon: Ticket, category: 'relationships', keywords: ['lead', 'prospect'] },
  { name: 'Projects', path: '/projects', icon: HardHat, category: 'relationships', keywords: ['project', 'prj', 'job'] },
  { name: 'Prospects', path: '/relationships/prospects', icon: Shield, category: 'relationships', keywords: ['prospect'] },
  { name: 'Vendors', path: '/relationships/vendors', icon: Briefcase, category: 'relationships', keywords: ['vendor', 'supplier', 'ven'] },

  // Items
  { name: 'Units of Measure', path: '/lists/units-of-measure', icon: Ruler, category: 'items', keywords: ['uom', 'unit'] },
  { name: 'Item Categories', path: '/lists/item-categories', icon: Tags, category: 'items', keywords: ['category'] },
  { name: 'Items', path: '/lists/items', icon: Package, category: 'items', keywords: ['item', 'product', 'itm'] },
  { name: 'Warehouses', path: '/lists/warehouses', icon: Building2, category: 'items', keywords: ['warehouse', 'wh'] },
  { name: 'Price Lists', path: '/lists/price-lists', icon: Tags, category: 'items', keywords: ['price', 'pricing'] },

  // Settings
  { name: 'Workflows', path: '/admin/settings/workflows', icon: Workflow, category: 'settings', keywords: ['workflow', 'automation'] },
  { name: 'Task Fields', path: '/admin/settings/task-fields', icon: SlidersHorizontal, category: 'settings', keywords: ['fields', 'custom'] },
  { name: 'Admin Settings', path: '/admin/settings', icon: Settings, category: 'settings', keywords: ['admin', 'config'] },

  // Sales
  { name: 'Estimates', path: '/transactions/sales/estimates', icon: FileBarChart, category: 'sales', keywords: ['estimate', 'quote'] },
  { name: 'Sales Orders', path: '/transactions/sales/sales-orders', icon: ListOrdered, category: 'sales', keywords: ['so', 'order'] },
  { name: 'Opportunities', path: '/transactions/sales/opportunities', icon: Target, category: 'sales', keywords: ['opportunity', 'deal'] },
  { name: 'Fulfillment', path: '/transactions/sales/fulfillment', icon: Truck, category: 'sales', keywords: ['fulfill', 'ship'] },
  { name: 'Invoices', path: '/transactions/sales/invoices', icon: FileText, category: 'sales', keywords: ['invoice', 'inv', 'bill'] },
  { name: 'Credit Memos', path: '/transactions/sales/credit-memos', icon: Receipt, category: 'sales', keywords: ['credit', 'memo'] },
  { name: 'Refunds', path: '/transactions/sales/refunds', icon: DollarSign, category: 'sales', keywords: ['refund', 'return'] },

  // Inventory
  { name: 'Inventory Adjustments', path: '/transactions/inventory/adjustments', icon: Settings2, category: 'inventory', keywords: ['adjust', 'inventory'] },
  { name: 'Inventory Transfers', path: '/transactions/inventory/transfers', icon: ArrowRightLeft, category: 'inventory', keywords: ['transfer'] },

  // Purchasing
  { name: 'Purchase Orders', path: '/transactions/inventory/purchase-orders', icon: ShoppingCart, category: 'purchasing', keywords: ['po', 'purchase'] },
  { name: 'Receipts', path: '/transactions/inventory/receipts', icon: Package, category: 'purchasing', keywords: ['receipt', 'receive'] },
  { name: 'Vendor Bills', path: '/transactions/purchasing/vendor-bills', icon: FileText, category: 'purchasing', keywords: ['bill', 'vendor bill'] },
  { name: 'Vendor Credits', path: '/transactions/purchasing/vendor-credits', icon: Receipt, category: 'purchasing', keywords: ['vendor credit'] },
  { name: 'Bill Payments', path: '/transactions/purchasing/bill-payments', icon: CreditCard, category: 'purchasing', keywords: ['pay', 'payment'] },

  // Expenses
  { name: 'Expense Reports', path: '/transactions/expenses/expense-reports', icon: ClipboardList, category: 'expenses', keywords: ['expense', 'report'] },
  { name: 'Charges', path: '/transactions/expenses/charges', icon: Zap, category: 'expenses', keywords: ['charge'] },

  // Recurring Revenue
  { name: 'Contracts', path: '/transactions/recurring/contracts', icon: FileText, category: 'recurring', keywords: ['contract', 'asc606'] },
  { name: 'Performance Obligations', path: '/transactions/recurring/performance-obligations', icon: Target, category: 'recurring', keywords: ['obligation', 'performance', 'pob'] },
  { name: 'Revenue Recognition', path: '/transactions/recurring/revenue-recognition', icon: DollarSign, category: 'recurring', keywords: ['revenue', 'recognition', 'rev rec'] },

  // Management
  { name: 'Journal', path: '/transactions/management/journal', icon: BookOpen, category: 'accounting', keywords: ['journal', 'entry', 'je'] },
  { name: 'Budgets', path: '/transactions/management/budgets', icon: Calendar, category: 'accounting', keywords: ['budget', 'plan'] },
];

// Entity types that support record search (prefix = first 4 chars + ":")
const SEARCHABLE_ENTITY_TYPES = ['customer', 'project', 'invoice', 'item', 'vendor', 'employee', 'contact'];

// Derive prefixes from entity types: first 4 chars + ":"
const RECORD_SEARCH_PREFIXES = SEARCHABLE_ENTITY_TYPES.map((type) => `${type.slice(0, 4)}:`);

/**
 * Filter pages based on search query
 * Returns matching pages for navigation, up to 8 results
 * Skips filtering if query contains a record search prefix
 */
export function filterPages(query: string): PageEntry[] {
  const trimmedQuery = query.trim().toLowerCase();

  // Skip if empty or has a record search prefix
  if (!trimmedQuery) return [];
  if (RECORD_SEARCH_PREFIXES.some((prefix) => trimmedQuery.startsWith(prefix))) {
    return [];
  }

  const matches = PAGE_REGISTRY.filter((page) => {
    // Check name
    if (page.name.toLowerCase().includes(trimmedQuery)) return true;

    // Check path segments
    if (page.path.toLowerCase().includes(trimmedQuery)) return true;

    // Check keywords
    if (page.keywords?.some((kw) => kw.toLowerCase().includes(trimmedQuery))) return true;

    return false;
  });

  // Sort by relevance: exact name match first, then starts with, then contains
  matches.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Exact match priority
    if (aName === trimmedQuery) return -1;
    if (bName === trimmedQuery) return 1;

    // Starts with priority
    const aStarts = aName.startsWith(trimmedQuery);
    const bStarts = bName.startsWith(trimmedQuery);
    if (aStarts && !bStarts) return -1;
    if (bStarts && !aStarts) return 1;

    // Alphabetical fallback
    return aName.localeCompare(bName);
  });

  return matches.slice(0, 8);
}
