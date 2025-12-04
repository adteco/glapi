---
name: glapi-backend-guidelines
description: GLAPI backend development guide for Next.js + TRPC + Drizzle ORM + PostgreSQL + Clerk. TRPC for internal type-safety, REST API exposure via OpenAPI. Covers layered architecture (routers → services → Drizzle), dual TRPC/REST endpoints, Clerk authentication, and testing strategies.
---

# GLAPI Backend Development Guidelines

## Purpose

Establish consistency and best practices for GLAPI's backend development using:
- **Next.js 15** - API routes and server architecture
- **TRPC** - Internal type-safe procedures
- **REST API** - External access via TRPC conversion layer
- **Drizzle ORM** - Type-safe database queries
- **PostgreSQL** - Primary database
- **Clerk** - Authentication
- **Zod** - Input validation
- **TypeScript** - Full type safety

## When to Use This Skill

Automatically activates when working on:
- Creating or modifying TRPC routers, procedures
- Building Next.js API routes (REST endpoints)
- Converting TRPC to REST
- Database operations with Drizzle ORM
- Clerk authentication integration
- Input validation with Zod
- Backend services and business logic
- Backend testing and refactoring

---

## Architecture Overview

### Dual API Pattern

**Your Unique Architecture:**
1. **TRPC (Internal)**: Type-safe procedures for Next.js frontend consumption
2. **REST (External)**: Public API endpoints created by converting TRPC procedures
3. **Shared Services**: Business logic used by both TRPC and REST
4. **Drizzle ORM**: Database access layer

```
Client Request (Frontend)
    ↓
┌─────────────────┐
│ TRPC (Internal) │ ← Next.js frontend
│ Type-safe       │
└─────────────────┘
         ↓
    Service Layer ← Shared business logic
         ↓
   Drizzle ORM
         ↓
    PostgreSQL

External Request (API)
    ↓
┌──────────────────┐
│ REST API Routes  │ ← External clients
│ (Next.js)        │
└──────────────────┘
         ↓
   TRPC Procedures (reuse)
         ↓
    Service Layer
         ↓
   Drizzle ORM
         ↓
    PostgreSQL
```

### Layered Architecture

```
HTTP/TRPC Request
    ↓
TRPC Router OR Next.js API Route (thin controller)
    ↓
Service Layer (business logic)
    ↓
Drizzle ORM (data access)
    ↓
Database (PostgreSQL)
```

**Key Principle:** Each layer has ONE responsibility.

- **TRPC Routers**: Type-safe procedures, validation, auth checks
- **Next.js API Routes**: REST endpoints that call TRPC procedures
- **Services**: Business logic, orchestration, transactions
- **Drizzle**: Database queries and mutations

---

## Directory Structure

```
apps/
  api/
    src/
      app/
        api/                    # REST API routes (external)
          users/
            [id]/
              route.ts          # GET/PATCH/DELETE /api/users/:id
            route.ts            # GET/POST /api/users

  web/
    src/
      app/
        api/                    # REST API routes (can be here too)
      server/
        routers/
          _app.ts               # Main router composition
          users.router.ts       # TRPC routers
          posts.router.ts
        trpc.ts                 # TRPC setup + procedures
        context.ts              # TRPC context creation

packages/
  database/
    src/
      schema/                   # Drizzle schemas
        users.ts
        posts.ts
        index.ts                # Export all schemas
      index.ts                  # Export db + helpers
    drizzle.config.ts

  services/
    src/
      user.service.ts           # Business logic services
      post.service.ts
      index.ts                  # Export all services
```

**Naming Conventions:**
- TRPC Routers: `camelCase.router.ts` - `users.router.ts`
- Next.js API Routes: `route.ts` in directory structure
- Services: `camelCase.service.ts` - `user.service.ts`
- Schemas: `camelCase.ts` - `users.ts`

---

## Quick Start

### New TRPC Procedure Checklist

- [ ] Define input schema with Zod
- [ ] Create procedure in appropriate router file
- [ ] Use `publicProcedure` or `protectedProcedure`
- [ ] Implement business logic in a service function
- [ ] Use Drizzle for database queries
- [ ] Handle errors properly
- [ ] Add TypeScript types
- [ ] Consider if this needs REST exposure

### New REST Endpoint Checklist

- [ ] Create Next.js API route in `apps/web/src/app/api/` or `apps/api/src/app/api/`
- [ ] Reuse existing TRPC procedure
- [ ] Create TRPC caller in API route
- [ ] Handle Clerk authentication with `auth()`
- [ ] Return proper HTTP status codes
- [ ] Add error handling
- [ ] Test both TRPC and REST versions

### New Service Function Checklist

- [ ] Create in `packages/services/src/`
- [ ] Accept typed parameters
- [ ] Use Drizzle for database access
- [ ] Keep database logic separate from business logic
- [ ] Return typed results
- [ ] Handle errors with try/catch
- [ ] Make it reusable by both TRPC and REST

---

## Core Principles (7 Key Rules)

### 1. Routers Are Thin, Services Are Thick

```typescript
// ❌ NEVER: Business logic in routers
export const usersRouter = createTRPCRouter({
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      // 200 lines of business logic here ❌
      const user = await db.insert(users).values(input);
      await sendWelcomeEmail(user);
      await createDefaultSettings(user);
      // ... more logic
    }),
});

// ✅ ALWAYS: Delegate to service
export const usersRouter = createTRPCRouter({
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      return userService.createUser(input);
    }),
});

// packages/services/src/user.service.ts
export const userService = {
  async createUser(data: CreateUserInput) {
    // All business logic here ✅
    const [user] = await db.insert(users).values(data).returning();
    await this.sendWelcomeEmail(user);
    await this.createDefaultSettings(user);
    return user;
  },
};
```

### 2. Use Protected/Public Procedures

```typescript
// ❌ NEVER: Manual auth checks
export const usersRouter = createTRPCRouter({
  getProfile: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    // ...
  }),
});

// ✅ ALWAYS: Use protectedProcedure
export const usersRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // ctx.userId is guaranteed to exist (from Clerk)
    return userService.getProfile(ctx.userId);
  }),
});
```

### 3. Validate All Inputs with Zod

```typescript
import { z } from "zod";

// Define schemas
const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "Must be 18+").optional(),
});

// Use in procedure
export const usersRouter = createTRPCRouter({
  create: publicProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      // input is typed and validated! ✅
      return userService.create(input);
    }),
});
```

### 4. Return Data Directly, No Wrappers

```typescript
// ❌ NEVER: Wrapper objects in TRPC
return {
  success: true,
  data: user,
  message: "User created",
};

// ✅ ALWAYS: Return data directly in TRPC
return user;

// Exception: REST API routes may use standard structure
// This is fine in Next.js API routes:
return NextResponse.json({ success: true, data: user });
```

### 5. Use Drizzle Queries from @glapi/database

```typescript
import { db } from '@glapi/database';
import { users } from '@glapi/database/schema';
import { eq, and } from 'drizzle-orm';

// ❌ NEVER: Raw SQL
const userList = await db.execute(sql`SELECT * FROM users WHERE id = ${id}`);

// ✅ ALWAYS: Drizzle query builder
const user = await db.query.users.findFirst({
  where: eq(users.id, id),
});

// OR using select builder
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.id, id))
  .limit(1);
```

### 6. REST Endpoints Reuse TRPC Procedures

```typescript
// apps/web/src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();

    // Create TRPC context
    const ctx = await createContext({ userId });

    // Call TRPC procedure ✅
    const caller = appRouter.createCaller(ctx);
    const user = await caller.users.getById({ id: params.id });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }
}
```

### 7. Clerk for All Authentication

```typescript
import { auth, currentUser } from '@clerk/nextjs';

// In TRPC context
export const createContext = async ({ userId }: { userId?: string | null }) => {
  return {
    userId,  // From Clerk
  };
};

// In protected procedure
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

// In Next.js API route
export async function GET(request: NextRequest) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Protected logic here
}
```

---

## Common Patterns

See [resources/complete-examples.md](resources/complete-examples.md) for full code examples including:

- TRPC Procedure + REST Endpoint pairs
- Service layer patterns
- Drizzle query examples
- Pagination and filtering
- Error handling
- Testing strategies

---

## Quick Reference Templates

### TRPC Router Template

```typescript
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { myService } from '@glapi/services';

export const myRouter = createTRPCRouter({
  // Public query
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return myService.getById(input.id);
    }),

  // Protected mutation
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return myService.create(input, ctx.userId);
    }),

  // List with pagination
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return myService.list(input);
    }),
});
```

### Next.js API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await createContext({});
    const caller = appRouter.createCaller(ctx);

    const item = await caller.myRouter.getById({ id: params.id });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const ctx = await createContext({ userId });
    const caller = appRouter.createCaller(ctx);

    const created = await caller.myRouter.create(body);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create' },
      { status: 500 }
    );
  }
}
```

### Service Template

```typescript
import { db } from '@glapi/database';
import { myTable } from '@glapi/database/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const myService = {
  async getById(id: string) {
    const item = await db.query.myTable.findFirst({
      where: eq(myTable.id, id),
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Item not found',
      });
    }

    return item;
  },

  async create(data: CreateInput, userId: string) {
    const [item] = await db.insert(myTable)
      .values({
        ...data,
        userId,
      })
      .returning();

    return item;
  },

  async list({ limit, offset }: ListInput) {
    const items = await db.query.myTable.findMany({
      limit,
      offset,
      orderBy: (myTable, { desc }) => [desc(myTable.createdAt)],
    });

    return items;
  },
};
```

---

## Common Mistakes to Avoid

### ❌ DON'T

1. **Don't put business logic in routers**
2. **Don't skip input validation**
3. **Don't use raw SQL (use Drizzle)**
4. **Don't forget authentication checks**
5. **Don't duplicate logic between TRPC and REST**
6. **Don't skip error handling**
7. **Don't return wrapper objects in TRPC**

### ✅ DO

1. **Use services for business logic**
2. **Validate all inputs with Zod**
3. **Use Drizzle's type-safe queries**
4. **Use protectedProcedure for auth**
5. **Reuse TRPC procedures in REST routes**
6. **Handle errors with try/catch**
7. **Return data directly in TRPC**
8. **Type everything with TypeScript**

---

**Remember:** TRPC for internal type-safety, REST for external access, services for shared logic, and Drizzle for database operations. Keep it simple, type-safe, and DRY!
