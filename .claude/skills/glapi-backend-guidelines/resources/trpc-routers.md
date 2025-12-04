# TRPC Routers Guide

Complete guide to creating TRPC routers, procedures, and OpenAPI integration for Sureshake.

---

## Table of Contents

1. [Router Basics](#router-basics)
2. [Procedures (Query vs Mutation)](#procedures)
3. [Input Validation with Zod](#input-validation)
4. [Output Typing](#output-typing)
5. [OpenAPI Metadata](#openapi-metadata)
6. [Protected vs Public Procedures](#protected-vs-public)
7. [Error Handling](#error-handling)
8. [Complete Examples](#complete-examples)

---

## Router Basics

### Creating a New Router

```typescript
// apps/api/src/server/routers/users.router.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { UsersService } from "../../services/users.service";

// Initialize service
const usersService = new UsersService();

export const usersRouter = createTRPCRouter({
  // Procedures go here
});
```

### Adding Router to App Router

```typescript
// apps/api/src/server/routers/_app.ts
import { createTRPCRouter } from "../trpc";
import { usersRouter } from "./users.router";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  // ... other routers
});

export type AppRouter = typeof appRouter;
```

**Access from frontend:**
```typescript
// Frontend
trpc.users.getProfile.useQuery();
```

---

## Procedures

### Query vs Mutation

**Queries** - READ operations (GET):
- Fetching data
- No side effects
- Cacheable
- Use `.query()`

**Mutations** - WRITE operations (POST/PUT/DELETE):
- Creating, updating, deleting
- Has side effects
- Not cacheable
- Use `.mutation()`

### Query Example

```typescript
export const usersRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      return usersService.getById(input.id, ctx.user.id);
    }),

  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return usersService.list(input.limit, input.offset);
    }),
});
```

### Mutation Example

```typescript
export const usersRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return usersService.create(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return usersService.update(input.id, input, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      return usersService.delete(input.id, ctx.user.id);
    }),
});
```

---

## Input Validation

### Simple Validation

```typescript
.input(z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(18),
}))
```

### Advanced Validation

```typescript
const createJobSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  title: z.string().min(1, "Job title is required"),
  location: z.string().optional(),
  startDate: z.date({
    required_error: "Start date is required",
    invalid_type_error: "Start date must be a valid date",
  }),
  endDate: z.date().nullable().optional(),
  current: z.boolean().default(false),
  description: z.string().max(5000, "Description too long").optional(),
  collectionId: z.string().uuid("Invalid collection ID"),
});
```

### Reusable Schemas

```typescript
// Define once
const userIdSchema = z.object({
  userId: z.string().uuid(),
});

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// Reuse
export const usersRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(userIdSchema)
    .query(/* ... */),

  list: protectedProcedure
    .input(paginationSchema)
    .query(/* ... */),
});
```

### Schema Composition

```typescript
const baseUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8),
});

const updateUserSchema = baseUserSchema.partial();
```

---

## Output Typing

### Explicit Output Schema

```typescript
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

export const usersRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(userSchema)
    .query(async ({ input }) => {
      return usersService.getById(input.id);
    }),
});
```

### Inferred Output

```typescript
// Service returns typed data
export const usersRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Return type inferred from service
      return usersService.getById(input.id);
    }),
});
```

---

## OpenAPI Metadata

### Basic OpenAPI

```typescript
import { OpenApiMeta } from 'trpc-openapi';

export const usersRouter = createTRPCRouter({
  create: publicProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'POST',
        path: '/users',
        tags: ['users'],
        summary: 'Create a new user',
        description: 'Creates a new user account',
      },
    })
    .input(createUserSchema)
    .output(userSchema)
    .mutation(async ({ input }) => {
      return usersService.create(input);
    }),
});
```

**This generates:**
- TRPC: `trpc.users.create.mutate(data)`
- REST: `POST /api/v1/users`

### Protected OpenAPI Endpoint

```typescript
export const usersRouter = createTRPCRouter({
  getProfile: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'GET',
        path: '/users/me',
        tags: ['users'],
        summary: 'Get current user profile',
        protect: true, // Requires authentication
      },
    })
    .output(userSchema)
    .query(async ({ ctx }) => {
      return usersService.getById(ctx.user.id);
    }),
});
```

### Path Parameters

```typescript
export const usersRouter = createTRPCRouter({
  getById: publicProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'GET',
        path: '/users/{id}',
        tags: ['users'],
        summary: 'Get user by ID',
      },
    })
    .input(z.object({
      id: z.string().uuid(),
    }))
    .output(userSchema)
    .query(async ({ input }) => {
      return usersService.getById(input.id);
    }),
});
```

**REST URL:** `GET /api/v1/users/abc-123-def`

### Query Parameters

```typescript
export const usersRouter = createTRPCRouter({
  list: publicProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'GET',
        path: '/users',
        tags: ['users'],
        summary: 'List users',
      },
    })
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return usersService.list(input);
    }),
});
```

**REST URL:** `GET /api/v1/users?limit=10&offset=0&search=john`

### OpenAPI Tags

Tags are defined in `apps/api/src/server/openapi.ts`:

```typescript
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Sureshake API',
  version: '1.0.0',
  baseUrl: 'http://localhost:3041/api',
  tags: [
    { name: 'users', description: 'User operations' },
    { name: 'jobs', description: 'Employment history' },
    { name: 'educations', description: 'Education history' },
    { name: 'skills', description: 'Professional skills' },
  ],
});
```

---

## Protected vs Public

### Public Procedure

```typescript
export const usersRouter = createTRPCRouter({
  getPublic: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // No authentication required
      // ctx.user may be undefined
      return usersService.getPublicProfile(input.id);
    }),
});
```

### Protected Procedure

```typescript
export const usersRouter = createTRPCRouter({
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.user is GUARANTEED to exist
      // TypeScript knows this!
      return usersService.getProfile(ctx.user.id);
    }),
});
```

### Conditional Logic

```typescript
export const usersRouter = createTRPCRouter({
  getProfile: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Show more details if requesting own profile
      const isOwnProfile = ctx.user?.id === input.id;

      return usersService.getProfile(input.id, isOwnProfile);
    }),
});
```

---

## Error Handling

### Standard Errors

```typescript
import { TRPCError } from "@trpc/server";

export const usersRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await usersService.getById(input.id);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user;
    }),
});
```

### Error with Context

```typescript
throw new TRPCError({
  code: "FORBIDDEN",
  message: "Cannot update another user's profile",
  cause: new Error("Original error"),
});
```

### Common Error Codes

```typescript
// 400 - Bad Request
throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid input" });

// 401 - Unauthorized (not logged in)
throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });

// 403 - Forbidden (logged in but not allowed)
throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });

// 404 - Not Found
throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });

// 409 - Conflict
throw new TRPCError({ code: "CONFLICT", message: "Resource already exists" });

// 500 - Internal Server Error
throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" });
```

---

## Complete Examples

### CRUD Router

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { OpenApiMeta } from 'trpc-openapi';
import { JobsService } from "../../services/jobs.service";

const jobsService = new JobsService();

// Schemas
const createJobSchema = z.object({
  companyName: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  current: z.boolean().default(false),
  description: z.string().optional(),
  collectionId: z.string().uuid(),
});

const jobSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  startDate: z.date(),
  endDate: z.date().nullable(),
  current: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const jobsRouter = createTRPCRouter({
  // CREATE
  create: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'POST',
        path: '/jobs',
        tags: ['jobs'],
        summary: 'Create employment history entry',
        protect: true,
      },
    })
    .input(createJobSchema)
    .output(jobSchema)
    .mutation(async ({ input, ctx }) => {
      return jobsService.create(input, ctx.user.id);
    }),

  // READ (single)
  getById: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'GET',
        path: '/jobs/{id}',
        tags: ['jobs'],
        summary: 'Get job by ID',
        protect: true,
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(jobSchema)
    .query(async ({ input, ctx }) => {
      return jobsService.getById(input.id, ctx.user.id);
    }),

  // READ (list)
  list: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'GET',
        path: '/jobs',
        tags: ['jobs'],
        summary: 'List jobs',
        protect: true,
      },
    })
    .input(z.object({
      userId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .output(z.array(jobSchema))
    .query(async ({ input, ctx }) => {
      const userId = input.userId || ctx.user.id;
      return jobsService.listByUserId(userId);
    }),

  // UPDATE
  update: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'PATCH',
        path: '/jobs/{id}',
        tags: ['jobs'],
        summary: 'Update job',
        protect: true,
      },
    })
    .input(createJobSchema.partial().extend({
      id: z.string().uuid(),
    }))
    .output(jobSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return jobsService.update(id, data, ctx.user.id);
    }),

  // DELETE
  delete: protectedProcedure
    .meta<OpenApiMeta>({
      openapi: {
        method: 'DELETE',
        path: '/jobs/{id}',
        tags: ['jobs'],
        summary: 'Delete job',
        protect: true,
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await jobsService.delete(input.id, ctx.user.id);
      return { success: true };
    }),
});
```

---

## Best Practices

### ✅ DO

1. **Keep routers thin** - Delegate to services
2. **Use Zod validation** - Validate all inputs
3. **Type outputs** - Use `.output()` for type safety
4. **Add OpenAPI** - For public/partner APIs
5. **Use correct procedure type** - Query for reads, mutation for writes
6. **Handle errors properly** - Use TRPCError with correct codes
7. **Document with comments** - Explain complex logic

### ❌ DON'T

1. **Put business logic in routers** - That's for services
2. **Skip input validation** - Always validate
3. **Use wrong procedure type** - Queries should not mutate
4. **Forget error handling** - Always handle errors
5. **Hardcode values** - Use environment variables
6. **Skip OpenAPI metadata** - If building public API
7. **Return inconsistent shapes** - Be consistent

---

## Frontend Usage

### TRPC Client

```typescript
// React component
import { trpc } from '@/utils/trpc';

function UserProfile() {
  const { data, isLoading } = trpc.users.getProfile.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      // Refetch
    },
  });

  return <div>{data?.name}</div>;
}
```

### REST Client

```typescript
// HTTP request
const response = await fetch('/api/v1/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
  }),
});

const user = await response.json();
```

---

## Testing

See [testing-guide.md](testing-guide.md) for complete testing examples.

**Quick example:**
```typescript
describe('users.create', () => {
  it('should create user', async () => {
    const caller = appRouter.createCaller(mockContext);

    const result = await caller.users.create({
      name: "John",
      email: "john@example.com",
    });

    expect(result).toHaveProperty('id');
  });
});
```

---

## Migration from Express

See [express-to-trpc.md](express-to-trpc.md) for complete migration guide.

**Quick reference:**
- `router.get('/path')` → `.query()`
- `router.post('/path')` → `.mutation()`
- `req.params.id` → `input.id`
- `req.body` → `input`
- `res.json(data)` → `return data`
- `res.status(404)` → `throw new TRPCError({ code: "NOT_FOUND" })`
