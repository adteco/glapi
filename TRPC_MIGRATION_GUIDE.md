# tRPC Migration Guide

This guide explains how to migrate from direct fetch calls to tRPC in the web app.

## Overview

The migration replaces manual fetch calls with type-safe tRPC procedures, providing:
- End-to-end type safety
- Automatic error handling
- Built-in loading states
- Automatic authentication
- Request deduplication and caching

## Migration Steps

### 1. Replace Fetch Calls with tRPC Hooks

#### Before (fetch):
```typescript
const [customers, setCustomers] = useState<Customer[]>([]);
const [loading, setLoading] = useState(true);

const fetchCustomers = async () => {
  try {
    const token = await getToken();
    const response = await fetch(apiEndpoints.customers, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) throw new Error('Failed to fetch customers');
    
    const data = await response.json();
    setCustomers(data.data || []);
  } catch (error) {
    console.error('Error fetching customers:', error);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchCustomers();
}, []);
```

#### After (tRPC):
```typescript
const { data: customersData, isLoading, refetch } = trpc.customers.list.useQuery();
const customers = customersData || [];
```

### 2. Replace POST/PUT/DELETE with Mutations

#### Before (fetch):
```typescript
const handleCreate = async () => {
  try {
    const token = await getToken();
    const response = await fetch(apiEndpoints.customers, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      alert(errorData.message || 'Failed to create');
      return;
    }
    
    await fetchCustomers();
    setIsCreateOpen(false);
  } catch (error) {
    alert('Failed to create');
  }
};
```

#### After (tRPC):
```typescript
const createCustomer = trpc.customers.create.useMutation({
  onSuccess: () => {
    toast.success('Customer created successfully');
    refetch();
    setIsCreateOpen(false);
    resetForm();
  },
  onError: (error) => {
    toast.error(error.message || 'Failed to create customer');
  },
});

const handleCreate = () => {
  createCustomer.mutate(formData);
};
```

### 3. Key Changes

1. **Import trpc client**:
   ```typescript
   import { trpc } from '@/lib/trpc';
   ```

2. **Replace manual loading states**:
   - Remove `useState` for loading
   - Use `isLoading` from query

3. **Replace manual error handling**:
   - Remove try/catch blocks
   - Use `onError` callbacks

4. **Replace alerts with toast**:
   ```typescript
   import { toast } from 'sonner';
   ```

5. **Remove manual token management**:
   - No need for `getToken()`
   - Authentication handled automatically

6. **Update refetch patterns**:
   - Replace `fetchData()` calls with `refetch()`

## Available tRPC Procedures

### Customers
- `trpc.customers.list.useQuery()`
- `trpc.customers.get.useQuery({ id })`
- `trpc.customers.create.useMutation()`
- `trpc.customers.update.useMutation()`
- `trpc.customers.delete.useMutation()`

### Departments
- `trpc.departments.list.useQuery()`
- `trpc.departments.get.useQuery({ id })`
- `trpc.departments.create.useMutation()`
- `trpc.departments.update.useMutation()`
- `trpc.departments.delete.useMutation()`

### Items
- `trpc.items.list.useQuery()`
- `trpc.items.get.useQuery({ id })`
- `trpc.items.create.useMutation()`
- `trpc.items.update.useMutation()`
- `trpc.items.delete.useMutation()`
- `trpc.items.categories.list.useQuery()`
- `trpc.items.categories.tree.useQuery()`

### Other Entities
Similar patterns exist for:
- Classes
- Locations
- Subsidiaries
- Organizations
- Leads
- Vendors
- Employees
- Contacts
- Prospects

## Example Files

- **Customers**: `/apps/web/src/app/relationships/customers/page-updated.tsx`
- **Departments**: `/apps/web/src/app/lists/departments/page-updated.tsx`
- **Items**: `/apps/web/src/app/lists/items/page-trpc-example.tsx`

## Benefits

1. **Type Safety**: Full type inference from backend to frontend
2. **Developer Experience**: Auto-completion and compile-time error checking
3. **Performance**: Built-in request deduplication and caching
4. **Error Handling**: Consistent error handling across the app
5. **Loading States**: Automatic loading state management
6. **Authentication**: Seamless token management

## Notes

- The tRPC routers maintain the same business logic as the REST endpoints
- All authentication and authorization is handled automatically
- The service layer remains unchanged
- Database queries and business logic are not affected