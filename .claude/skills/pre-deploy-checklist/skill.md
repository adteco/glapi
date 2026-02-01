# Pre-Deployment Checklist Skill

## Purpose

Run comprehensive quality checks before committing code and creating pull requests. This skill ensures code quality, documentation, API specs, and tests are all in order before deployment.

## When to Use This Skill

- Before committing significant changes
- Before creating a pull request
- When user invokes `/ship`, `/pre-deploy`, or `/checklist`
- When preparing code for production deployment

## Checklist Items

### 1. TypeScript Compilation
**Command**: `pnpm type-check` or `npx tsc --noEmit`
**Purpose**: Ensure no type errors
**Required**: Yes

### 2. Linting
**Command**: `pnpm lint` or `npx eslint .`
**Purpose**: Code style and best practices
**Required**: Yes

### 3. Build Validation
**Command**: `pnpm build`
**Purpose**: Ensure production build succeeds
**Required**: Yes (for PRs)

### 4. OpenAPI Spec Sync
**Command**: `pnpm --filter @glapi/trpc generate-openapi` (project-specific)
**Purpose**: Ensure API documentation matches code
**Check**: Compare generated spec with committed spec
**Required**: If API routes changed

### 5. Documentation Validation
**Command**: Check for `apps/docs/scripts/validate-snippets.ts` and run if exists
**Purpose**: Validate code snippets in documentation
**Required**: If docs exist

### 6. Test Execution
**Commands**:
- Unit tests: `pnpm test` or `vitest run`
- E2E tests: `pnpm test:e2e` or `playwright test`
**Purpose**: Ensure tests pass
**Required**: Tests covering changed code

### 7. Changelog Update
**Check**: CHANGELOG.md modified if user-facing changes
**Purpose**: Document changes for users
**Required**: For features and fixes

### 8. Database Migration Validation
**Check**: New migrations run successfully
**Command**: `source .env && psql "$DATABASE_ADMIN_URL" -f <migration>`
**Required**: If schema changed

### 9. RLS Policy Check
**Check**: New tables have Row Level Security policies
**Purpose**: Multi-tenant data isolation
**Required**: For new database tables

### 10. Secrets Check
**Check**: No .env, credentials, API keys in staged files
**Purpose**: Security
**Required**: Always

## Execution Flow

```
1. Identify what changed (git status, git diff)
2. Run applicable checks based on changes
3. Report results with pass/fail status
4. Block commit if critical checks fail
5. Warn for advisory checks
```

## Check Categories

### Critical (Must Pass)
- TypeScript compilation
- No secrets in code
- Linting errors

### Required (Should Pass)
- Build succeeds
- Tests pass for changed code
- OpenAPI spec up-to-date (if API changed)

### Advisory (Warning Only)
- Changelog updated
- Documentation updated
- Full test suite passes

## Project Detection

The skill auto-detects project capabilities:

| File/Directory | Capability |
|----------------|------------|
| `package.json` with `type-check` script | TypeScript checking |
| `package.json` with `lint` script | Linting |
| `packages/trpc/scripts/generate-openapi.ts` | OpenAPI generation |
| `apps/docs/` | Documentation |
| `CHANGELOG.md` | Changelog tracking |
| `tests/` or `__tests__/` | Test suites |
| `packages/database/drizzle/` | Migrations |
| `.env.example` | Environment variables |

## Output Format

```
Pre-Deployment Checklist
========================

[PASS] TypeScript Compilation
[PASS] Linting
[PASS] Build
[WARN] OpenAPI Spec - regenerate with: pnpm --filter @glapi/trpc generate-openapi
[FAIL] Tests - 2 failing in contacts.spec.ts
[SKIP] Changelog - no user-facing changes detected
[PASS] No Secrets Detected

Summary: 4 passed, 1 warning, 1 failed, 1 skipped

Action Required:
- Fix failing tests before committing
- Consider regenerating OpenAPI spec
```

## Integration Options

### As a Skill (Manual)
Invoke with `/ship` or `/pre-deploy` command

### As a Hook (Automatic)
Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PreCommit": {
      "command": "claude-code skill pre-deploy-checklist"
    }
  }
}
```

### In CI/CD
Run checks in GitHub Actions or other CI systems

## Cross-Project Usage

This skill is designed to be portable. Copy the skill to any project's `.claude/skills/` directory. It will:

1. Auto-detect available tooling
2. Skip checks that don't apply
3. Use project-specific commands from package.json
4. Adapt to monorepo or single-package layouts

## Customization

Create `.claude/pre-deploy-config.json` to customize:

```json
{
  "required_checks": ["typescript", "lint", "build"],
  "skip_checks": ["changelog"],
  "custom_commands": {
    "openapi": "pnpm generate:api-spec",
    "test": "pnpm test:unit"
  },
  "paths": {
    "changelog": "CHANGELOG.md",
    "migrations": "db/migrations"
  }
}
```
