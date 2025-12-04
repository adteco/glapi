# Privy Authentication Guide

Complete guide to Privy authentication integration in Sureshake.

---

## Overview

Sureshake uses **Privy** for Web3-native authentication. Privy provides:
- Wallet-based authentication
- Email/social login fallbacks
- Decentralized identifiers (DIDs)
- JWT token management

---

## Key Concepts

### Privy DID (Decentralized Identifier)

```typescript
// Example Privy DID
const privyId = "did:privy:clo9v9w5r00001mp6yfh58qv3";
```

- Used as primary user ID
- Unique per user
- Immutable
- Works across wallet addresses

### Authentication Flow

```
1. User connects wallet (or email)
     ↓
2. Privy generates JWT token
     ↓
3. Frontend sends token in Authorization header
     ↓
4. Backend verifies token
     ↓
5. Extract user info from token
     ↓
6. Set ctx.user in TRPC context
```

---

## TRPC Context Setup

### Creating Context with Privy User

```typescript
// apps/api/src/server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { verifyPrivyToken } from '../utils/privy';

// Define context type
export interface Context {
  user?: {
    id: string;           // Privy DID
    email?: string;
    walletAddress?: string;
    name?: string;
  };
}

// Create context from request
export const createContext = async ({
  req,
  res,
}: {
  req: any;
  res: any;
}): Promise<Context> => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {}; // No user context
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  try {
    // Verify Privy token
    const verifiedUser = await verifyPrivyToken(token);

    return {
      user: {
        id: verifiedUser.userId,  // Privy DID
        email: verifiedUser.email,
        walletAddress: verifiedUser.walletAddress,
        name: verifiedUser.name,
      },
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {}; // Invalid token, no user context
  }
};

// Initialize TRPC with context
const t = initTRPC.context<Context>().create();
```

---

## Protected Procedures

### Define Protected Procedure

```typescript
// apps/api/src/server/trpc.ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check if user exists in context
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Must be logged in',
    });
  }

  // Continue with user guaranteed to exist
  return next({
    ctx: {
      user: ctx.user, // TypeScript knows user exists!
    },
  });
});
```

### Using Protected Procedure

```typescript
// In router
export const usersRouter = createTRPCRouter({
  // Public - no auth required
  getPublic: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return usersService.getPublicProfile(input.id);
    }),

  // Protected - auth required
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.user.id is guaranteed to exist
      return usersService.getProfile(ctx.user.id);
    }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      // Pass authenticated user ID to service
      return usersService.update(ctx.user.id, input);
    }),
});
```

---

## Privy Token Verification

### Verify Token Utility

```typescript
// apps/api/src/utils/privy.ts
import { PrivyClient } from '@privy-io/server-auth';

// Initialize Privy client
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export interface VerifiedUser {
  userId: string;        // Privy DID
  email?: string;
  walletAddress?: string;
  name?: string;
}

export async function verifyPrivyToken(token: string): Promise<VerifiedUser> {
  try {
    // Verify token with Privy
    const claims = await privyClient.verifyAuthToken(token);

    return {
      userId: claims.userId,
      email: claims.email,
      walletAddress: claims.walletAddress,
      name: claims.name,
    };
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}
```

---

## User ID Patterns

### Store Privy DID as Primary Key

```typescript
// packages/db/src/schema/users.ts
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Privy DID
  privyId: text("privy_id").unique(), // Duplicate for compatibility
  name: text("name").notNull(),
  email: text("email").notNull(),
  wallet: text("wallet"),
  // ... other fields
});
```

### Create User on First Login

```typescript
// Service pattern
export class UsersService {
  async getOrCreateUser(privyId: string, email?: string, name?: string) {
    // Try to find existing user
    let user = await db
      .select()
      .from(users)
      .where(eq(users.id, privyId))
      .limit(1);

    // Create if doesn't exist
    if (!user.length) {
      user = await db
        .insert(users)
        .values({
          id: privyId,
          privyId: privyId,
          name: name || '',
          email: email || '',
          accountStatus: 'active',
        })
        .returning();
    }

    return user[0];
  }
}
```

---

## Authorization Patterns

### Ownership Check

```typescript
export class JobsService {
  async update(
    jobId: string,
    data: UpdateJobInput,
    requestingUserId: string
  ): Promise<Job> {
    // Get existing job
    const existing = await this.getById(jobId);

    // Verify ownership
    if (existing.userId !== requestingUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot update another user's job",
      });
    }

    // Proceed with update
    const updated = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();

    return updated[0];
  }
}
```

### Role-Based Access

```typescript
// Add role to user schema
export const users = pgTable("users", {
  // ... other fields
  role: text("role").notNull().default("user"), // user, admin, moderator
});

// Role check middleware
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Get user from database
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  if (!user.length || user[0].role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx });
});

// Use in router
export const adminRouter = createTRPCRouter({
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      return adminService.deleteUser(input.userId);
    }),
});
```

---

## Frontend Integration

### Send Token in Requests

```typescript
// Frontend - React hook
import { usePrivy } from '@privy-io/react-auth';
import { trpc } from '@/utils/trpc';

function MyComponent() {
  const { getAccessToken } = usePrivy();

  // TRPC automatically includes token
  const { data } = trpc.users.getProfile.useQuery();

  // Manual fetch with token
  const handleManualRequest = async () => {
    const token = await getAccessToken();

    const response = await fetch('/api/v1/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  };

  return <div>{data?.name}</div>;
}
```

### TRPC Link with Auth

```typescript
// Frontend - TRPC setup
import { httpBatchLink } from '@trpc/client';
import { usePrivy } from '@privy-io/react-auth';

export const trpc = createTRPCReact<AppRouter>();

function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = usePrivy();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3041/api/trpc',
          async headers() {
            const token = await getAccessToken();
            return {
              authorization: token ? `Bearer ${token}` : '',
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
```

---

## Testing with Privy Auth

### Mock Privy Token

```typescript
// Test utility
export function createMockPrivyToken(userId: string): string {
  // In tests, use a mock token
  return `mock-token-${userId}`;
}

export function createMockContext(userId?: string): Context {
  if (!userId) {
    return {}; // No auth
  }

  return {
    user: {
      id: userId,
      email: 'test@example.com',
    },
  };
}
```

### Test Protected Procedures

```typescript
import { appRouter } from '../routers/_app';
import { createMockContext } from '../test/utils';

describe('users.getProfile', () => {
  it('should return profile for authenticated user', async () => {
    const ctx = createMockContext('did:privy:test-user-123');
    const caller = appRouter.createCaller(ctx);

    const result = await caller.users.getProfile();

    expect(result.id).toBe('did:privy:test-user-123');
  });

  it('should throw UNAUTHORIZED for unauthenticated request', async () => {
    const ctx = createMockContext(); // No user
    const caller = appRouter.createCaller(ctx);

    await expect(caller.users.getProfile()).rejects.toThrow('Must be logged in');
  });
});
```

---

## Common Patterns

### Pattern 1: Auto-Create User on Auth

```typescript
// Middleware to ensure user exists in database
export const ensureUserExists = protectedProcedure.use(async ({ ctx, next }) => {
  // User is authenticated (has Privy DID)
  const userId = ctx.user.id;

  // Check if user exists in database
  let dbUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Create if doesn't exist
  if (!dbUser.length) {
    dbUser = await db
      .insert(users)
      .values({
        id: userId,
        privyId: userId,
        name: ctx.user.name || '',
        email: ctx.user.email || '',
        wallet: ctx.user.walletAddress,
      })
      .returning();
  }

  return next({
    ctx: {
      user: ctx.user,
      dbUser: dbUser[0],
    },
  });
});
```

### Pattern 2: Optional Auth

```typescript
export const optionalAuthProcedure = publicProcedure.use(async ({ ctx, next }) => {
  // User may or may not be authenticated
  return next({
    ctx: {
      user: ctx.user, // May be undefined
    },
  });
});

// Use in router
export const postsRouter = createTRPCRouter({
  list: optionalAuthProcedure
    .query(async ({ ctx }) => {
      // Show more if authenticated
      const includePrivate = !!ctx.user;

      return postsService.list({ includePrivate });
    }),
});
```

---

## Environment Variables

```bash
# .env
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret

# Frontend
NEXT_PUBLIC_PRIVY_APP_ID=your-app-id
```

---

## Best Practices

### ✅ DO

1. **Use Privy DID as primary key** - Stable across wallet changes
2. **Verify tokens on every request** - Don't trust client
3. **Use protectedProcedure** - Don't manually check auth
4. **Store user in context** - Available in all procedures
5. **Check ownership** - Verify user owns resource
6. **Create user on first login** - Auto-provisioning
7. **Handle missing users** - Graceful degradation

### ❌ DON'T

1. **Trust client-provided user ID** - Always verify token
2. **Skip ownership checks** - Verify user can access resource
3. **Store passwords** - Privy handles authentication
4. **Hardcode Privy credentials** - Use environment variables
5. **Forget to handle wallet changes** - DID stays same
6. **Skip token expiration** - Tokens expire, handle gracefully
7. **Expose Privy secrets** - Keep server-side only

---

## Debugging

### Check Token in Browser

```javascript
// In browser console
const token = localStorage.getItem('privy:token');
console.log('Token:', token);

// Decode JWT (base64)
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('Decoded:', payload);
```

### Log Auth in Backend

```typescript
export const createContext = async ({ req, res }: any): Promise<Context> => {
  const authHeader = req.headers.authorization;

  console.log('Auth header:', authHeader);

  if (!authHeader) {
    console.log('No auth header found');
    return {};
  }

  const token = authHeader.substring(7);

  try {
    const user = await verifyPrivyToken(token);
    console.log('Verified user:', user);
    return { user };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {};
  }
};
```

---

## Resources

- [Privy Docs](https://docs.privy.io/)
- [TRPC Context](https://trpc.io/docs/server/context)
- [Protected Procedures](trpc-routers.md#protected-vs-public)
- [Service Layer](service-layer.md)
