# CI/CD Quality Gates

This document describes the automated quality gates that run on every pull request to ensure code quality and prevent regressions.

## Overview

The CI pipeline runs automatically on:
- All pull requests targeting `main` or `develop` branches
- All pushes to `main` branch

## Quality Gates

| Check | Command | Description |
|-------|---------|-------------|
| **Lint** | `pnpm lint` | ESLint checks across all workspaces |
| **Type Check** | `pnpm type-check` | TypeScript compilation checks |
| **Test** | `pnpm turbo test` | Unit and integration tests |
| **Build** | `pnpm build` | Full production build |

All checks must pass before a PR can be merged.

## Reproducing Failures Locally

If CI fails, you can reproduce and fix issues locally:

```bash
# 1. Install dependencies
pnpm install

# 2. Run the specific check that failed

# For lint failures:
pnpm lint           # See all lint errors
pnpm lint:fix       # Auto-fix where possible

# For type errors:
pnpm type-check

# For test failures:
pnpm turbo test --filter='./packages/*'

# For build failures:
pnpm build
```

### Workspace-Specific Commands

To run checks on a specific workspace:

```bash
# Lint a specific package
pnpm --filter @glapi/api lint
pnpm --filter @glapi/database lint

# Type-check a specific package
pnpm --filter web type-check

# Run tests for a specific package
pnpm --filter @glapi/business test
```

## Build Metrics

The CI pipeline tracks build duration and reports it in the GitHub Actions summary. This provides baseline metrics for monitoring build performance over time.

## Caching

The pipeline uses:
- **pnpm cache**: Node modules are cached based on `pnpm-lock.yaml`
- **Turborepo remote cache** (optional): Set `TURBO_TOKEN` and `TURBO_TEAM` secrets to enable

## Troubleshooting

### Common Issues

1. **Lock file out of sync**
   ```bash
   pnpm install --frozen-lockfile
   # If this fails locally, update the lock file:
   pnpm install
   # Then commit pnpm-lock.yaml
   ```

2. **Node version mismatch**
   The project requires Node.js >= 22.0.0. Check your version:
   ```bash
   node --version
   ```

3. **Type errors from dependencies**
   Ensure all packages are built before type-checking:
   ```bash
   pnpm build
   pnpm type-check
   ```

## Configuration Files

- **Workflow**: `.github/workflows/ci.yml`
- **Turborepo**: `turbo.json`
- **ESLint**: Individual `eslint.config.js` files per workspace
- **TypeScript**: Individual `tsconfig.json` files per workspace
