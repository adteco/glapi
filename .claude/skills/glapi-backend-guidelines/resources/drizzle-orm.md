# Drizzle ORM Guide

Complete guide to using Drizzle ORM for database operations in Sureshake.

---

## Table of Contents

1. [Import Patterns](#import-patterns)
2. [Schema Definition](#schema-definition)
3. [Basic Queries](#basic-queries)
4. [Filtering](#filtering)
5. [Joins](#joins)
6. [Transactions](#transactions)
7. [Insert/Update/Delete](#insert-update-delete)
8. [Relations](#relations)
9. [Common Patterns](#common-patterns)

---

## Import Patterns

### Standard Import

```typescript
import { db, users, jobs, eq, and, or, like, desc, asc, count } from "@sureshake/db";
```

**Available from `@sureshake/db`:**
- `db` - Database instance
- Table schemas: `users`, `jobs`, `educations`, `skills`, etc.
- Operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `inArray`, `notInArray`
- Combinators: `and`, `or`, `not`
- Sorting: `asc`, `desc`
- Aggregates: `count`, `sum`, `avg`, `min`, `max`
- SQL helpers: `sql`

### Service Import Example

```typescript
// In service file
import { db, users, jobs, eq, and, desc, count } from "@sureshake/db";
import { TRPCError } from "@trpc/server";

export class UsersService {
  async getById(id: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!result.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return result[0];
  }
}
```

---

## Schema Definition

Schemas are defined in `packages/db/src/schema/` and exported from `packages/db/src/index.ts`.

### Basic Table Schema

```typescript
// packages/db/src/schema/users.ts
import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  slug: text("slug").unique(),
  wallet: text("wallet"),
  avatar: text("avatar"),
  bio: text("bio"),
  isAdmin: boolean("is_admin").default(false),
  preferences: jsonb("preferences").$type<{
    privacy: object;
    notifications: object;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

### Table with Foreign Keys

```typescript
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  current: boolean("current").default(false),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index("jobs_user_id_idx").on(table.userId),
}));
```

### Enums

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "invited",
  "placeholder",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  accountStatus: accountStatusEnum("account_status").notNull().default("placeholder"),
});
```

---

## Basic Queries

### Select All Columns

```typescript
const allUsers = await db
  .select()
  .from(users);

// Returns: User[]
```

### Select Specific Columns

```typescript
const userNames = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
  .from(users);

// Returns: { id: string; name: string; email: string; }[]
```

### Select One Record

```typescript
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

// Returns: User[] (always an array!)
const singleUser = user[0]; // Get first result
```

### Count Records

```typescript
const totalUsers = await db
  .select({ count: count() })
  .from(users);

const total = totalUsers[0].count;
```

---

## Filtering

### Simple Equality

```typescript
// WHERE id = 'abc-123'
await db
  .select()
  .from(users)
  .where(eq(users.id, userId));
```

### Multiple Conditions (AND)

```typescript
// WHERE email LIKE '%@example.com' AND is_admin = true
await db
  .select()
  .from(users)
  .where(
    and(
      like(users.email, '%@example.com'),
      eq(users.isAdmin, true)
    )
  );
```

### Multiple Conditions (OR)

```typescript
// WHERE role = 'admin' OR role = 'moderator'
await db
  .select()
  .from(users)
  .where(
    or(
      eq(users.role, 'admin'),
      eq(users.role, 'moderator')
    )
  );
```

### Comparison Operators

```typescript
import { gt, gte, lt, lte, ne } from "@sureshake/db";

// Greater than
await db.select().from(users).where(gt(users.age, 18));

// Greater than or equal
await db.select().from(users).where(gte(users.age, 18));

// Less than
await db.select().from(users).where(lt(users.age, 65));

// Not equal
await db.select().from(users).where(ne(users.status, 'deleted'));
```

### Pattern Matching

```typescript
// Case-sensitive LIKE
await db.select().from(users).where(like(users.email, '%@gmail.com'));

// Case-insensitive ILIKE (PostgreSQL)
await db.select().from(users).where(ilike(users.name, '%john%'));
```

### IN / NOT IN

```typescript
import { inArray, notInArray } from "@sureshake/db";

// WHERE id IN ('id1', 'id2', 'id3')
await db
  .select()
  .from(users)
  .where(inArray(users.id, ['id1', 'id2', 'id3']));

// WHERE status NOT IN ('deleted', 'suspended')
await db
  .select()
  .from(users)
  .where(notInArray(users.status, ['deleted', 'suspended']));
```

### NULL Checks

```typescript
import { isNull, isNotNull } from "@sureshake/db";

// WHERE email IS NULL
await db.select().from(users).where(isNull(users.email));

// WHERE email IS NOT NULL
await db.select().from(users).where(isNotNull(users.email));
```

---

## Joins

### Left Join

```typescript
const usersWithJobs = await db
  .select({
    userId: users.id,
    userName: users.name,
    jobTitle: jobs.title,
    companyName: jobs.companyName,
  })
  .from(users)
  .leftJoin(jobs, eq(jobs.userId, users.id));
```

### Inner Join

```typescript
const usersWithJobs = await db
  .select()
  .from(users)
  .innerJoin(jobs, eq(jobs.userId, users.id))
  .where(eq(users.id, userId));
```

### Multiple Joins

```typescript
const userData = await db
  .select({
    user: users,
    job: jobs,
    education: educations,
  })
  .from(users)
  .leftJoin(jobs, eq(jobs.userId, users.id))
  .leftJoin(educations, eq(educations.userId, users.id))
  .where(eq(users.id, userId));
```

---

## Transactions

### Basic Transaction

```typescript
const result = await db.transaction(async (tx) => {
  // All operations in this block are part of the transaction
  const user = await tx
    .insert(users)
    .values({ name: "John", email: "john@example.com" })
    .returning();

  const job = await tx
    .insert(jobs)
    .values({
      userId: user[0].id,
      companyName: "Acme Inc",
      title: "Developer",
      startDate: new Date(),
    })
    .returning();

  return { user: user[0], job: job[0] };
});
```

### Transaction with Error Handling

```typescript
try {
  const result = await db.transaction(async (tx) => {
    const user = await tx
      .insert(users)
      .values(userData)
      .returning();

    if (!user.length) {
      throw new Error("Failed to create user");
    }

    const job = await tx
      .insert(jobs)
      .values({ ...jobData, userId: user[0].id })
      .returning();

    return { user: user[0], job: job[0] };
  });

  return result;
} catch (error) {
  // Transaction automatically rolled back
  Sentry.captureException(error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create user and job",
  });
}
```

---

## Insert/Update/Delete

### Insert Single Record

```typescript
const newUser = await db
  .insert(users)
  .values({
    id: userId, // Or use .default(sql`gen_random_uuid()`) in schema
    name: "John Doe",
    email: "john@example.com",
  })
  .returning();

// Returns array: User[]
const user = newUser[0];
```

### Insert Multiple Records

```typescript
const newUsers = await db
  .insert(users)
  .values([
    { name: "John", email: "john@example.com" },
    { name: "Jane", email: "jane@example.com" },
  ])
  .returning();

// Returns: User[]
```

### Insert with Default Values

```typescript
const newUser = await db
  .insert(users)
  .values({
    name: "John",
    email: "john@example.com",
    // createdAt and updatedAt use .defaultNow() from schema
  })
  .returning();
```

### Update Records

```typescript
const updated = await db
  .update(users)
  .set({
    name: "Jane Doe",
    updatedAt: new Date(),
  })
  .where(eq(users.id, userId))
  .returning();

// Returns: User[]
const updatedUser = updated[0];
```

### Update Multiple Fields

```typescript
const updated = await db
  .update(users)
  .set({
    name: input.name,
    email: input.email,
    bio: input.bio,
    updatedAt: new Date(),
  })
  .where(eq(users.id, userId))
  .returning();
```

### Delete Records

```typescript
const deleted = await db
  .delete(users)
  .where(eq(users.id, userId))
  .returning();

// Returns: User[]
const deletedUser = deleted[0];
```

### Delete with Conditions

```typescript
// Delete all inactive users
await db
  .delete(users)
  .where(
    and(
      eq(users.accountStatus, 'inactive'),
      lt(users.lastLoginAt, thirtyDaysAgo)
    )
  );
```

---

## Relations

### Define Relations

```typescript
// packages/db/src/schema/users.ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  educations: many(educations),
  skills: many(skills),
}));

// packages/db/src/schema/jobs.ts
export const jobsRelations = relations(jobs, ({ one }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
}));
```

### Query with Relations

```typescript
import { db } from "@sureshake/db";

const userWithJobs = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    jobs: true,
    educations: true,
  },
});

// Result includes nested data:
// {
//   id: "123",
//   name: "John",
//   jobs: [{ title: "Developer", ... }],
//   educations: [{ school: "MIT", ... }]
// }
```

---

## Common Patterns

### Pattern 1: Find or Create

```typescript
async findOrCreate(email: string) {
  // Try to find
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Create if not found
  if (!user.length) {
    user = await db
      .insert(users)
      .values({ email, name: "" })
      .returning();
  }

  return user[0];
}
```

### Pattern 2: Paginated List

```typescript
async list(limit: number = 50, offset: number = 0) {
  const results = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCount = await db
    .select({ count: count() })
    .from(users);

  return {
    data: results,
    total: totalCount[0].count,
    hasMore: offset + limit < totalCount[0].count,
  };
}
```

### Pattern 3: Conditional Update

```typescript
async update(id: string, data: Partial<User>) {
  // Build update object with only provided fields
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.bio !== undefined) updateData.bio = data.bio;

  const updated = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  return updated[0];
}
```

### Pattern 4: Soft Delete

```typescript
// Add deletedAt column to schema
export const users = pgTable("users", {
  // ... other fields
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Soft delete method
async softDelete(id: string) {
  await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, id));
}

// Filter out deleted records
async list() {
  return db
    .select()
    .from(users)
    .where(isNull(users.deletedAt));
}
```

### Pattern 5: Upsert (Insert or Update)

```typescript
async upsert(email: string, data: Partial<User>) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length) {
    // Update
    const updated = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, existing[0].id))
      .returning();

    return updated[0];
  } else {
    // Insert
    const created = await db
      .insert(users)
      .values({ email, ...data })
      .returning();

    return created[0];
  }
}
```

### Pattern 6: Batch Operations

```typescript
async batchUpdate(userIds: string[], data: Partial<User>) {
  return db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(inArray(users.id, userIds))
    .returning();
}

async batchDelete(userIds: string[]) {
  return db
    .delete(users)
    .where(inArray(users.id, userIds))
    .returning();
}
```

---

## Best Practices

### ✅ DO

1. **Always use `.returning()`** to get inserted/updated records
2. **Remember results are arrays** - use `[0]` to get single record
3. **Use transactions** for multi-table operations
4. **Use proper operators** - `eq()`, `and()`, `like()`, etc.
5. **Import from `@sureshake/db`** - centralized package
6. **Add indexes** for frequently queried columns
7. **Use `limit(1)`** when fetching single records

### ❌ DON'T

1. **Forget to handle empty arrays** - check `.length` before accessing `[0]`
2. **Use raw SQL** unless absolutely necessary
3. **Skip transactions** for related inserts/updates
4. **Hardcode database names** - import from schema
5. **Forget `.defaultNow()`** for timestamps
6. **Skip validation** - always validate before DB operations
7. **Expose database errors** - wrap in TRPCError

---

## Drizzle vs Prisma

| Prisma | Drizzle |
|--------|---------|
| `findUnique()` | `.select().where(eq()).limit(1)` |
| `findMany()` | `.select().from()` |
| `create({ data })` | `.insert().values().returning()` |
| `update({ where, data })` | `.update().set().where().returning()` |
| `delete({ where })` | `.delete().where().returning()` |
| Returns single object | Returns array - use `[0]` |
| `include: { posts: true }` | `.with({ posts: true })` or manual joins |
| `where: { AND: [] }` | `and(condition1, condition2)` |
| `where: { email: { contains } }` | `like(users.email, '%search%')` |

---

## Migrations

Migrations are handled in the `packages/db` package:

```bash
# Generate migration from schema changes
cd packages/db
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push
```

---

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Drizzle Operators](https://orm.drizzle.team/docs/operators)
- [Schema Definition](../../../packages/db/src/schema/)
- [Migration Guide](prisma-to-drizzle.md)
