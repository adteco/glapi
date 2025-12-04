# Data Fetching with TRPC

Guide to fetching data in Sureshake using the TRPC client.

---

## TRPC Client Setup

TRPC client is already configured in Sureshake at `/utils/api.ts`:

```typescript
import { api } from '@/utils/api';
```

---

## Query Pattern (GET operations)

### Basic Query

```typescript
import { api } from '@/utils/api';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = api.users.getProfile.useQuery({
    id: userId,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data.name}</div>;
}
```

### Query with Options

```typescript
const { data, isLoading, refetch } = api.users.getProfile.useQuery(
  { id: userId },
  {
    enabled: !!userId,           // Only fetch if userId exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    staleTime: 60000,            // Consider data fresh for 1 minute
  }
);
```

### Conditional Query

```typescript
const { data } = api.users.getProfile.useQuery(
  { id: userId },
  {
    enabled: !!userId && isAuthenticated,  // Only fetch when conditions met
  }
);
```

---

## Mutation Pattern (POST/PUT/DELETE operations)

### Basic Mutation

```typescript
const updateProfile = api.users.updateProfile.useMutation();

const handleSubmit = async (data: UpdateProfileInput) => {
  try {
    await updateProfile.mutateAsync(data);
    toast({ title: "Profile updated!" });
  } catch (error) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  }
};

// In JSX
<Button
  onClick={() => handleSubmit(formData)}
  disabled={updateProfile.isPending}
>
  {updateProfile.isPending ? "Saving..." : "Save"}
</Button>
```

### Mutation with Optimistic Updates

```typescript
const utils = api.useUtils();

const updateProfile = api.users.updateProfile.useMutation({
  // Optimistic update
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await utils.users.getProfile.cancel();

    // Snapshot previous value
    const previousData = utils.users.getProfile.getData({ id: userId });

    // Optimistically update
    utils.users.getProfile.setData({ id: userId }, (old) => ({
      ...old!,
      ...newData,
    }));

    return { previousData };
  },

  // On error, rollback
  onError: (err, newData, context) => {
    utils.users.getProfile.setData(
      { id: userId },
      context?.previousData
    );
  },

  // Always refetch after error or success
  onSettled: () => {
    utils.users.getProfile.invalidate({ id: userId });
  },
});
```

### Mutation with Cache Invalidation

```typescript
const deleteJob = api.jobs.delete.useMutation({
  onSuccess: () => {
    // Invalidate jobs list to trigger refetch
    utils.jobs.getAll.invalidate();

    toast({ title: "Job deleted successfully" });
  },
});
```

---

## Infinite Queries (Pagination)

```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = api.jobs.getAll.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);

// Render
<div>
  {data?.pages.map((page) =>
    page.items.map((job) => <JobCard key={job.id} job={job} />)
  )}

  {hasNextPage && (
    <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
      {isFetchingNextPage ? "Loading..." : "Load More"}
    </Button>
  )}
</div>
```

---

## Suspense Pattern (React 19)

```typescript
import { api } from '@/utils/api';
import { Suspense } from 'react';

function UserProfile({ userId }: { userId: string }) {
  // This suspends until data is loaded
  const { data } = api.users.getProfile.useSuspenseQuery({
    id: userId,
  });

  return <div>{data.name}</div>;
}

// Wrap in Suspense boundary
<Suspense fallback={<LoadingSpinner />}>
  <UserProfile userId={userId} />
</Suspense>
```

---

## Error Handling

### Query Error

```typescript
const { data, error, isError } = api.users.getProfile.useQuery({ id: userId });

if (isError) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
```

### Mutation Error

```typescript
const updateProfile = api.users.updateProfile.useMutation({
  onError: (error) => {
    toast({
      variant: "destructive",
      title: "Failed to update profile",
      description: error.message,
    });
  },
});
```

### Global Error Boundary

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <UserProfile userId={userId} />
</ErrorBoundary>
```

---

## Type Safety

TRPC provides full type safety:

```typescript
// Input types are inferred
const { data } = api.users.getProfile.useQuery({
  id: "123",  // TypeScript knows this should be a string
});

// Output types are inferred
data.name  // TypeScript knows data has a 'name' property

// Mutation input is typed
updateProfile.mutate({
  name: "John",
  email: "john@example.com",
  // TypeScript will error if you pass invalid fields
});
```

---

## Common Patterns

### Dependent Queries

```typescript
const { data: user } = api.users.getProfile.useQuery({ id: userId });

const { data: jobs } = api.jobs.getAll.useQuery(
  { userId: user?.id },
  {
    enabled: !!user?.id,  // Only fetch jobs after user is loaded
  }
);
```

### Parallel Queries

```typescript
const userQuery = api.users.getProfile.useQuery({ id: userId });
const jobsQuery = api.jobs.getAll.useQuery({ userId });
const skillsQuery = api.skills.getAll.useQuery({ userId });

// Wait for all
if (userQuery.isLoading || jobsQuery.isLoading || skillsQuery.isLoading) {
  return <LoadingSpinner />;
}
```

### Prefetching

```typescript
const utils = api.useUtils();

// Prefetch on hover
const handleMouseEnter = () => {
  utils.users.getProfile.prefetch({ id: userId });
};

<Link
  href={`/users/${userId}`}
  onMouseEnter={handleMouseEnter}
>
  View Profile
</Link>
```

---

## Best Practices

1. **Use TRPC client** - Never use fetch() for API calls
2. **Handle loading states** - Show spinner or skeleton
3. **Handle errors** - Show user-friendly messages
4. **Invalidate cache** - After mutations that affect lists
5. **Use enabled option** - For conditional queries
6. **Leverage type safety** - Let TypeScript guide you
7. **Use Suspense** - For simpler loading states (React 19)
8. **Optimistic updates** - For better UX on mutations
9. **Prefetch on hover** - For instant navigation
10. **Use utils** - For manual cache manipulation
