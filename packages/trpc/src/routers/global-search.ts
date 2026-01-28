import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { CustomerService, ProjectService, InvoiceService, ItemsService, EntityService } from '@glapi/api-service';

// Search result type prefixes
const SEARCH_PREFIXES = {
  customer: 'cus:',
  project: 'prj:',
  invoice: 'inv:',
  employee: 'emp:',
  vendor: 'ven:',
  item: 'itm:',
  contact: 'con:',
} as const;

type EntityType = 'customer' | 'project' | 'invoice' | 'employee' | 'vendor' | 'item' | 'contact';

interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  subtitle?: string;
  url: string;
  metadata?: Record<string, string | undefined>;
}

const searchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
});

// Helper function to check if a string matches search query
function matchesSearch(value: string | undefined | null, query: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

export const globalSearchRouter = router({
  search: authenticatedProcedure
    .input(searchInputSchema)
    .query(async ({ ctx, input }): Promise<{ results: SearchResult[]; query: string; type: EntityType | 'all' }> => {
      const { query, limit } = input;

      // Parse query for type prefix
      let searchQuery = query.trim();
      let targetType: EntityType | 'all' = 'all';

      // Check for type prefix (e.g., "cus: acme")
      for (const [type, prefix] of Object.entries(SEARCH_PREFIXES)) {
        if (searchQuery.toLowerCase().startsWith(prefix)) {
          targetType = type as EntityType;
          searchQuery = searchQuery.slice(prefix.length).trim();
          break;
        }
      }

      // If search query is empty after removing prefix, return empty results
      if (!searchQuery) {
        return { results: [], query: searchQuery, type: targetType };
      }

      const results: SearchResult[] = [];
      const perTypeLimit = targetType === 'all' ? Math.ceil(limit / 5) : limit;

      // Search customers
      if (targetType === 'all' || targetType === 'customer') {
        try {
          const customerService = new CustomerService(ctx.serviceContext);
          const customersResult = await customerService.listCustomers(
            { page: 1, limit: 100 },
            'companyName',
            'asc'
          );

          // Filter customers by search query
          const matchingCustomers = customersResult.data
            .filter(customer =>
              matchesSearch(customer.companyName, searchQuery) ||
              matchesSearch(customer.customerId, searchQuery) ||
              matchesSearch(customer.contactEmail, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const customer of matchingCustomers) {
            if (!customer.id) continue; // Skip if no ID (shouldn't happen)
            results.push({
              id: customer.id,
              type: 'customer',
              title: customer.companyName,
              subtitle: customer.customerId ?? customer.contactEmail ?? undefined,
              url: `/relationships/customers/${customer.id}`,
              metadata: {
                status: customer.status ?? 'active',
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search projects
      if (targetType === 'all' || targetType === 'project') {
        try {
          const projectService = new ProjectService(ctx.serviceContext);
          const projects = await projectService.listProjects({
            page: 1,
            limit: 100,
          });

          // Filter projects by search query
          const matchingProjects = projects.data
            .filter(project =>
              matchesSearch(project.name, searchQuery) ||
              matchesSearch(project.projectCode, searchQuery) ||
              matchesSearch(project.description, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const project of matchingProjects) {
            results.push({
              id: project.id,
              type: 'project',
              title: project.name,
              subtitle: project.projectCode || undefined,
              url: `/projects/${project.id}`,
              metadata: {
                status: project.status,
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search invoices
      if (targetType === 'all' || targetType === 'invoice') {
        try {
          const invoiceService = new InvoiceService(ctx.serviceContext, { db: ctx.db });
          const invoices = await invoiceService.listInvoices({
            page: 1,
            limit: 100,
          });

          // Filter invoices by search query (invoice number)
          const matchingInvoices = invoices.data
            .filter(invoice =>
              matchesSearch(invoice.invoiceNumber, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const invoice of matchingInvoices) {
            results.push({
              id: invoice.id,
              type: 'invoice',
              title: invoice.invoiceNumber,
              subtitle: `$${invoice.totalAmount}`,
              url: `/transactions/sales/invoices/${invoice.id}`,
              metadata: {
                status: invoice.status,
                amount: invoice.totalAmount?.toString(),
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search employees
      if (targetType === 'all' || targetType === 'employee') {
        try {
          const entityService = new EntityService(ctx.serviceContext);
          const employees = await entityService.list(
            ['Employee'],
            {
              page: 1,
              limit: 100,
              orderBy: 'name',
              orderDirection: 'asc',
            }
          );

          // Filter employees by search query
          const matchingEmployees = employees.data
            .filter(employee =>
              matchesSearch(employee.displayName, searchQuery) ||
              matchesSearch(employee.name, searchQuery) ||
              matchesSearch(employee.email, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const employee of matchingEmployees) {
            results.push({
              id: employee.id,
              type: 'employee',
              title: employee.displayName || employee.name,
              subtitle: employee.email || undefined,
              url: `/relationships/employees/${employee.id}`,
              metadata: {
                status: employee.status,
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search vendors
      if (targetType === 'all' || targetType === 'vendor') {
        try {
          const entityService = new EntityService(ctx.serviceContext);
          const vendors = await entityService.list(
            ['Vendor'],
            {
              page: 1,
              limit: 100,
              orderBy: 'name',
              orderDirection: 'asc',
            }
          );

          // Filter vendors by search query
          const matchingVendors = vendors.data
            .filter(vendor =>
              matchesSearch(vendor.displayName, searchQuery) ||
              matchesSearch(vendor.name, searchQuery) ||
              matchesSearch(vendor.email, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const vendor of matchingVendors) {
            results.push({
              id: vendor.id,
              type: 'vendor',
              title: vendor.displayName || vendor.name,
              subtitle: vendor.email || undefined,
              url: `/relationships/vendors/${vendor.id}`,
              metadata: {
                status: vendor.status,
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search items
      if (targetType === 'all' || targetType === 'item') {
        try {
          const itemService = new ItemsService(ctx.serviceContext);
          const items = await itemService.listItems({
            page: 1,
            limit: 100,
          });

          // Filter items by search query
          type ItemType = typeof items.data[number];
          const matchingItems = items.data
            .filter((item: ItemType) =>
              matchesSearch(item.name, searchQuery) ||
              matchesSearch(item.itemCode, searchQuery) ||
              matchesSearch(item.description ?? undefined, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const item of matchingItems) {
            results.push({
              id: item.id,
              type: 'item',
              title: item.name,
              subtitle: item.itemCode ?? undefined,
              url: `/lists/items/${item.id}`,
              metadata: {
                itemType: item.itemType,
              },
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Search contacts
      if (targetType === 'all' || targetType === 'contact') {
        try {
          const entityService = new EntityService(ctx.serviceContext);
          const contacts = await entityService.list(
            ['Contact'],
            {
              page: 1,
              limit: 100,
              orderBy: 'name',
              orderDirection: 'asc',
            }
          );

          // Filter contacts by search query
          const matchingContacts = contacts.data
            .filter(contact =>
              matchesSearch(contact.displayName, searchQuery) ||
              matchesSearch(contact.name, searchQuery) ||
              matchesSearch(contact.email, searchQuery)
            )
            .slice(0, perTypeLimit);

          for (const contact of matchingContacts) {
            results.push({
              id: contact.id,
              type: 'contact',
              title: contact.displayName || contact.name,
              subtitle: contact.email || undefined,
              url: `/relationships/contacts/${contact.id}`,
            });
          }
        } catch {
          // Silently handle errors for individual searches
        }
      }

      // Limit total results
      return {
        results: results.slice(0, limit),
        query: searchQuery,
        type: targetType,
      };
    }),

  // Get search prefixes for autocomplete hints
  getPrefixes: authenticatedProcedure
    .query(() => {
      return Object.entries(SEARCH_PREFIXES).map(([type, prefix]) => ({
        type,
        prefix,
        label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
      }));
    }),
});
