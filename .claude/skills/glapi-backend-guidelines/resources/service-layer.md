# Service Layer Guide

Complete guide to implementing the service layer in Sureshake backend.

---

## Table of Contents

1. [Service Layer Overview](#service-layer-overview)
2. [Service Structure](#service-structure)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [Validation](#validation)
6. [Service Composition](#service-composition)
7. [Testing Services](#testing-services)

---

## Service Layer Overview

### Purpose

The service layer contains ALL business logic. It sits between TRPC routers (HTTP layer) and Drizzle ORM (data layer).

```
TRPC Router (HTTP)
    ↓ delegates to
Service Layer (BUSINESS LOGIC)
    ↓ uses
Drizzle ORM (DATA ACCESS)
```

### Responsibilities

**Services handle:**
- ✅ Business logic and rules
- ✅ Data validation
- ✅ Complex queries and transactions
- ✅ Integration with other services
- ✅ Error handling with Sentry
- ✅ Authorization checks

**Services DO NOT handle:**
- ❌ HTTP request/response concerns
- ❌ Input validation (that's Zod in routers)
- ❌ Direct database access (use Drizzle queries)

---

## Service Structure

### Basic Service Class

```typescript
// apps/api/src/services/users.service.ts
import { db, users, eq, and, desc } from "@sureshake/db";
import { TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/node";

export interface CreateUserInput {
  name: string;
  email: string;
  slug?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  bio?: string;
}

export class UsersService {
  /**
   * Get user by ID
   */
  async getById(id: string, requestingUserId?: string): Promise<User> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getById', userId: id },
      });
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(data: CreateUserInput): Promise<User> {
    try {
      // Business logic here
      const slug = data.slug || this.generateSlug(data.name);

      const newUser = await db
        .insert(users)
        .values({
          ...data,
          slug,
        })
        .returning();

      if (!newUser.length) {
        throw new Error("Failed to create user");
      }

      // Post-creation tasks
      await this.sendWelcomeEmail(newUser[0]);

      return newUser[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'create' },
        extra: { data },
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create user",
        cause: error,
      });
    }
  }

  /**
   * Update user
   */
  async update(
    id: string,
    data: UpdateUserInput,
    requestingUserId: string
  ): Promise<User> {
    // Authorization check
    if (id !== requestingUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot update another user's profile",
      });
    }

    try {
      const updated = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updated.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updated[0];
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async delete(id: string, requestingUserId: string): Promise<void> {
    // Authorization
    if (id !== requestingUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot delete another user",
      });
    }

    try {
      await db
        .delete(users)
        .where(eq(users.id, id));
    } catch (error) {
      Sentry.captureException(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete user",
      });
    }
  }

  // Private helper methods
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    // Email sending logic
  }
}
```

---

## Common Patterns

### Pattern 1: CRUD Operations

```typescript
export class ResourceService {
  async getById(id: string): Promise<Resource> {
    const result = await db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .limit(1);

    if (!result.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Resource not found",
      });
    }

    return result[0];
  }

  async list(limit: number = 50, offset: number = 0): Promise<Resource[]> {
    return db
      .select()
      .from(resources)
      .orderBy(desc(resources.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async create(data: CreateResourceInput): Promise<Resource> {
    const created = await db
      .insert(resources)
      .values(data)
      .returning();

    return created[0];
  }

  async update(id: string, data: UpdateResourceInput): Promise<Resource> {
    const updated = await db
      .update(resources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();

    if (!updated.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Resource not found",
      });
    }

    return updated[0];
  }

  async delete(id: string): Promise<void> {
    await db
      .delete(resources)
      .where(eq(resources.id, id));
  }
}
```

### Pattern 2: Service with Dependency Injection

```typescript
export class JobsService {
  private entityService: EntityAutoCreateService;

  constructor(entityService?: EntityAutoCreateService) {
    this.entityService = entityService || new EntityAutoCreateService();
  }

  async createJob(input: CreateJobInput): Promise<JobWithEntity> {
    // Use injected service
    const entity = await this.entityService.findOrCreateCompany({
      name: input.companyName,
      createdBy: input.userId,
    });

    const job = await db
      .insert(jobs)
      .values({
        ...input,
        entityId: entity.id,
      })
      .returning();

    return {
      ...job[0],
      entity,
    };
  }
}
```

### Pattern 3: Transaction Pattern

```typescript
export class UsersService {
  async createUserWithProfile(
    userData: CreateUserInput,
    profileData: CreateProfileInput
  ) {
    return db.transaction(async (tx) => {
      // Create user
      const user = await tx
        .insert(users)
        .values(userData)
        .returning();

      if (!user.length) {
        throw new Error("Failed to create user");
      }

      // Create profile
      const profile = await tx
        .insert(profiles)
        .values({
          ...profileData,
          userId: user[0].id,
        })
        .returning();

      // Create default settings
      await tx
        .insert(settings)
        .values({
          userId: user[0].id,
          theme: 'light',
          notifications: true,
        });

      return {
        user: user[0],
        profile: profile[0],
      };
    });
  }
}
```

### Pattern 4: Authorization Pattern

```typescript
export class JobsService {
  async update(
    id: string,
    data: UpdateJobInput,
    requestingUserId: string
  ): Promise<Job> {
    // Verify ownership
    const existing = await this.getById(id);

    if (existing.userId !== requestingUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot update another user's job",
      });
    }

    // Perform update
    const updated = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();

    return updated[0];
  }
}
```

### Pattern 5: Pagination Pattern

```typescript
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export class UsersService {
  async listPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResult<User>> {
    const [data, totalCount] = await Promise.all([
      db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(users),
    ]);

    return {
      data,
      total: totalCount[0].count,
      hasMore: offset + limit < totalCount[0].count,
      limit,
      offset,
    };
  }
}
```

### Pattern 6: Search Pattern

```typescript
export class UsersService {
  async search(query: string, limit: number = 20): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        or(
          ilike(users.name, `%${query}%`),
          ilike(users.email, `%${query}%`)
        )
      )
      .limit(limit);
  }
}
```

---

## Error Handling

### Standard Error Pattern

```typescript
async getById(id: string): Promise<User> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user[0];
  } catch (error) {
    // Log to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'getById' },
      extra: { userId: id },
    });

    // Re-throw if already TRPCError
    if (error instanceof TRPCError) {
      throw error;
    }

    // Wrap other errors
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get user",
      cause: error,
    });
  }
}
```

### Validation Errors

```typescript
async create(data: CreateUserInput): Promise<User> {
  // Business validation (beyond Zod schema validation)
  if (await this.emailExists(data.email)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Email already exists",
    });
  }

  if (data.slug && await this.slugExists(data.slug)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Slug already taken",
    });
  }

  // Proceed with creation
  const user = await db
    .insert(users)
    .values(data)
    .returning();

  return user[0];
}

private async emailExists(email: string): Promise<boolean> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return existing.length > 0;
}
```

---

## Validation

### Input Validation

```typescript
export class JobsService {
  async createJob(input: CreateJobInput): Promise<Job> {
    // Validate required fields
    this.validateCreateJobInput(input);

    // Validate business rules
    if (input.endDate && input.endDate < input.startDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "End date cannot be before start date",
      });
    }

    if (input.current && input.endDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Current job cannot have an end date",
      });
    }

    // Create job
    const job = await db
      .insert(jobs)
      .values(input)
      .returning();

    return job[0];
  }

  private validateCreateJobInput(input: CreateJobInput): void {
    if (!input.userId?.trim()) {
      throw new Error('User ID is required');
    }

    if (!input.title?.trim()) {
      throw new Error('Job title is required');
    }

    if (!input.companyName?.trim()) {
      throw new Error('Company name is required');
    }
  }
}
```

---

## Service Composition

### Using Multiple Services

```typescript
export class ReportsService {
  private usersService: UsersService;
  private jobsService: JobsService;
  private educationsService: EducationsService;

  constructor() {
    this.usersService = new UsersService();
    this.jobsService = new JobsService();
    this.educationsService = new EducationsService();
  }

  async generateUserReport(userId: string): Promise<UserReport> {
    // Get data from multiple services
    const [user, jobs, educations] = await Promise.all([
      this.usersService.getById(userId),
      this.jobsService.listByUserId(userId),
      this.educationsService.listByUserId(userId),
    ]);

    // Generate report
    return {
      user,
      employment: {
        jobs,
        totalYears: this.calculateTotalYears(jobs),
        currentJob: jobs.find(j => j.current),
      },
      education: educations,
      generatedAt: new Date(),
    };
  }

  private calculateTotalYears(jobs: Job[]): number {
    // Business logic
    return jobs.reduce((total, job) => {
      const start = job.startDate.getTime();
      const end = (job.endDate || new Date()).getTime();
      return total + (end - start) / (365 * 24 * 60 * 60 * 1000);
    }, 0);
  }
}
```

---

## Testing Services

### Unit Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  describe('create', () => {
    it('should create user with generated slug', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = await service.create(input);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('John Doe');
      expect(result.slug).toBe('john-doe');
    });

    it('should throw on duplicate email', async () => {
      const input = {
        name: 'John Doe',
        email: 'existing@example.com',
      };

      await expect(service.create(input)).rejects.toThrow('Email already exists');
    });
  });

  describe('update', () => {
    it('should prevent updating another user', async () => {
      const userId = 'user-123';
      const requestingUserId = 'user-456';

      await expect(
        service.update(userId, { name: 'New Name' }, requestingUserId)
      ).rejects.toThrow('Cannot update another user');
    });
  });
});
```

---

## Best Practices

### ✅ DO

1. **Keep services focused** - One service per domain entity
2. **Use TypeScript interfaces** - Define input/output types
3. **Add JSDoc comments** - Document public methods
4. **Handle all errors** - Catch and wrap with TRPCError
5. **Log to Sentry** - Capture exceptions with context
6. **Validate business rules** - Not just input structure
7. **Use transactions** - For multi-table operations
8. **Return typed data** - No `any` types
9. **Test services** - Unit test business logic

### ❌ DON'T

1. **Put HTTP logic in services** - No `req`/`res` objects
2. **Access database directly in routers** - Always use services
3. **Forget authorization checks** - Verify ownership/permissions
4. **Skip error handling** - Always wrap operations
5. **Hardcode values** - Use config or parameters
6. **Mix concerns** - Keep services focused
7. **Return database errors** - Wrap in TRPCError
8. **Forget to update timestamps** - Set `updatedAt`

---

## Service Template

```typescript
// apps/api/src/services/resource.service.ts
import { db, resources, eq, and, desc, count } from "@sureshake/db";
import { TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/node";

export interface CreateResourceInput {
  // Define input type
}

export interface UpdateResourceInput {
  // Define update type
}

export class ResourceService {
  /**
   * Get resource by ID
   */
  async getById(id: string): Promise<Resource> {
    try {
      const result = await db
        .select()
        .from(resources)
        .where(eq(resources.id, id))
        .limit(1);

      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      return result[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getById' },
        extra: { id },
      });
      throw error;
    }
  }

  /**
   * Create new resource
   */
  async create(data: CreateResourceInput): Promise<Resource> {
    try {
      const created = await db
        .insert(resources)
        .values(data)
        .returning();

      if (!created.length) {
        throw new Error("Failed to create resource");
      }

      return created[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'create' },
        extra: { data },
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create resource",
        cause: error,
      });
    }
  }

  // Add more methods as needed
}
```

---

## Resources

- [TRPC Routers Guide](trpc-routers.md)
- [Drizzle ORM Guide](drizzle-orm.md)
- [Testing Guide](testing-guide.md)
- [Complete Examples](complete-examples.md)
