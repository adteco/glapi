# TYPES-001: Create @glapi/types Package Skeleton

## Task Overview

**Description**: Create the foundational structure for the `@glapi/types` package, including package.json, tsconfig.json, and directory structure.

**Layer**: Infrastructure / Foundational

**Estimated Time**: 2 hours

**Dependencies**: None

**Blocks**: TYPES-002 through TYPES-014

---

## Acceptance Criteria

- [ ] `packages/types/package.json` exists with correct configuration
- [ ] `packages/types/tsconfig.json` exists with proper TypeScript settings
- [ ] Directory structure matches planned layout
- [ ] Package is recognized by pnpm workspace
- [ ] Package can be built without errors
- [ ] Package can be imported by other packages
- [ ] `@glapi/types` resolves correctly in dependent packages

---

## TDD Approach

### 1. Write Tests First

Create `packages/types/tests/package.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('@glapi/types package', () => {
  it('should export from main entry point', async () => {
    const types = await import('@glapi/types');
    expect(types).toBeDefined();
  });

  it('should have z (zod) re-exported for convenience', async () => {
    const { z } = await import('@glapi/types');
    expect(z).toBeDefined();
    expect(typeof z.string).toBe('function');
  });
});
```

### 2. Implement to Pass Tests

Create the package structure as specified below.

### 3. Verify

```bash
pnpm --filter @glapi/types test
pnpm --filter @glapi/types type-check
pnpm --filter @glapi/types build
```

---

## Implementation Details

### File: `packages/types/package.json`

```json
{
  "name": "@glapi/types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "require": "./src/index.ts"
    },
    "./common": {
      "types": "./src/common/index.ts",
      "import": "./src/common/index.ts"
    },
    "./entities": {
      "types": "./src/entities/index.ts",
      "import": "./src/entities/index.ts"
    },
    "./accounting": {
      "types": "./src/accounting/index.ts",
      "import": "./src/accounting/index.ts"
    },
    "./items": {
      "types": "./src/items/index.ts",
      "import": "./src/items/index.ts"
    },
    "./projects": {
      "types": "./src/projects/index.ts",
      "import": "./src/projects/index.ts"
    },
    "./time-tracking": {
      "types": "./src/time-tracking/index.ts",
      "import": "./src/time-tracking/index.ts"
    },
    "./transactions": {
      "types": "./src/transactions/index.ts",
      "import": "./src/transactions/index.ts"
    },
    "./revenue": {
      "types": "./src/revenue/index.ts",
      "import": "./src/revenue/index.ts"
    },
    "./integrations": {
      "types": "./src/integrations/index.ts",
      "import": "./src/integrations/index.ts"
    },
    "./reporting": {
      "types": "./src/reporting/index.ts",
      "import": "./src/reporting/index.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.25.51"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "typescript": "^5.3.3",
    "vitest": "^1.6.0"
  }
}
```

### File: `packages/types/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### File: `packages/types/src/index.ts`

```typescript
/**
 * @glapi/types - Centralized type definitions for GLAPI
 *
 * This package serves as the single source of truth for all Zod schemas
 * and TypeScript types used across the GLAPI monorepo.
 *
 * @example
 * // Import specific schemas
 * import { customerSchema, type Customer } from '@glapi/types';
 *
 * // Import from submodules
 * import { timeEntrySchema } from '@glapi/types/time-tracking';
 *
 * // Use z for custom schemas that extend base types
 * import { z } from '@glapi/types';
 */

// Re-export Zod for convenience
export { z } from 'zod';

// Export all submodules
export * from './common';
// Placeholder exports - will be added as types are migrated
// export * from './entities';
// export * from './accounting';
// export * from './items';
// export * from './projects';
// export * from './time-tracking';
// export * from './transactions';
// export * from './revenue';
// export * from './integrations';
// export * from './reporting';
```

### File: `packages/types/src/common/index.ts`

```typescript
/**
 * Common types used across all domains
 */

// Placeholder - will be populated in TYPES-002
export {};
```

### Directory Structure to Create

```bash
mkdir -p packages/types/src/{common,entities,accounting,items,projects,time-tracking,transactions,revenue,integrations,reporting}
mkdir -p packages/types/tests
```

---

## Verification Steps

1. **Workspace Recognition**
   ```bash
   pnpm list --filter @glapi/types
   ```
   Should show the package.

2. **Build Test**
   ```bash
   pnpm --filter @glapi/types build
   ```
   Should complete without errors.

3. **Type Check**
   ```bash
   pnpm --filter @glapi/types type-check
   ```
   Should pass.

4. **Import Test** (manual)
   Add to another package temporarily:
   ```typescript
   import { z } from '@glapi/types';
   console.log(typeof z.string);
   ```

---

## Rollback Plan

If issues arise:
1. Remove `packages/types` directory
2. No other packages affected at this stage

---

## Notes

- The package uses `main` pointing to TypeScript source files directly, following the pattern used by `@glapi/trpc` and `@glapi/api-service`
- Subpath exports enable tree-shaking and targeted imports
- Zod is the only runtime dependency

---

## Git Commit

```
feat(types): create @glapi/types package skeleton

- Add package.json with subpath exports
- Add TypeScript configuration
- Create directory structure for domain modules
- Add placeholder exports

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
