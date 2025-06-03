# Commit Checklist

Use this checklist before making any commit to ensure code quality and consistency across the GLAPI project.

## Pre-Commit Checklist

### 1. Code Quality
- [ ] **Code compiles without errors** - Run `pnpm build` in the affected workspace
- [ ] **No TypeScript errors** - Run `pnpm type-check` 
- [ ] **Linting passes** - Run `pnpm lint`
- [ ] **Code follows project conventions** - Check CLAUDE.md for guidelines
- [ ] **No console.log statements** - Remove debugging logs (except intentional logging)
- [ ] **No commented-out code** - Remove or document why it's kept
- [ ] **No hardcoded values** - Use environment variables or constants

### 2. Testing
- [ ] **Existing tests pass** - Run `pnpm test` if applicable
- [ ] **New features have tests** - Add unit/integration tests for new functionality
- [ ] **Manual testing completed** - Verify the feature works as expected
- [ ] **Edge cases considered** - Test error states, empty states, loading states

### 3. Security
- [ ] **No secrets in code** - API keys, passwords, tokens are in .env files
- [ ] **Input validation added** - Validate user inputs, especially for API endpoints
- [ ] **SQL injection prevention** - Use parameterized queries (Drizzle ORM)
- [ ] **Authentication checked** - Ensure protected routes have proper auth checks

### 4. Database Changes
- [ ] **Migration created** - Run `pnpm db:generate` for schema changes
- [ ] **Migration tested** - Run `pnpm db:migrate` successfully
- [ ] **Backwards compatible** - Consider impact on existing data
- [ ] **Indexes added** - For new queries that need performance optimization

### 5. API Changes (CRITICAL)
- [ ] **OpenAPI spec updated** - Update `/docs/api-specs/*.openapi.yaml` for the endpoint
- [ ] **User docs updated** - Add/update page in `/apps/docs/src/app/api/`
- [ ] **API tested** - Manual testing with test scripts or HTTP files
- [ ] **Example requests added** - Include curl/fetch examples in user docs
- [ ] **Response examples added** - Show successful and error responses
- [ ] **Authentication documented** - Explain required headers/tokens
- [ ] **Rate limits documented** - Specify any rate limiting
- [ ] **Backwards compatibility** - Don't break existing API contracts
- [ ] **Error handling added** - Proper error messages and status codes
- [ ] **Changelog updated** - Add to `/apps/docs/CHANGELOG.md`

### 6. Frontend Changes
- [ ] **Responsive design** - Works on mobile, tablet, and desktop
- [ ] **Cross-browser tested** - Chrome, Firefox, Safari, Edge
- [ ] **Loading states** - Show appropriate feedback during async operations
- [ ] **Error states** - Handle and display errors gracefully
- [ ] **Accessibility** - Keyboard navigation, ARIA labels, color contrast
- [ ] **Icons documented** - New icons added to `/docs/design/icons.md`

### 7. Performance
- [ ] **No N+1 queries** - Check database query efficiency
- [ ] **Images optimized** - Use Next.js Image component, appropriate formats
- [ ] **Bundle size checked** - No unnecessary dependencies added
- [ ] **Lazy loading used** - For heavy components or routes

### 8. Documentation
- [ ] **Code comments added** - For complex logic or business rules
- [ ] **README updated** - If setup or usage changes
- [ ] **API docs updated** - For new endpoints or changes
- [ ] **CLAUDE.md updated** - If development patterns change

### 9. Dependencies
- [ ] **Dependencies justified** - Each new package has a clear purpose
- [ ] **Lock file committed** - `pnpm-lock.yaml` is updated
- [ ] **No vulnerable packages** - Run `pnpm audit`
- [ ] **Licenses compatible** - Check new dependencies' licenses

### 10. Git Hygiene
- [ ] **Branch up to date** - Rebase or merge latest main
- [ ] **Commits are atomic** - Each commit does one thing
- [ ] **Commit messages clear** - Follow conventional commits format
- [ ] **No merge conflicts** - Resolve all conflicts properly

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI/CD changes

### Examples
```
feat(api): add customer export endpoint

- Add new GET /api/v1/customers/export endpoint
- Support CSV and JSON formats
- Include pagination for large datasets

Closes #123

---

fix(web): resolve input focus issue in entity forms

- Move form components outside parent to prevent re-renders
- Update all entity pages to use consistent pattern
- Add proper TypeScript types for form props

Fixes #456

---

docs: add commit checklist and icon guidelines

- Create comprehensive commit checklist
- Document standard icons and usage patterns
- Add examples for implementation
```

## Quick Commands

### Before committing, run:
```bash
# Check everything at once
pnpm precommit

# Or run individually:
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

### Fix common issues:
```bash
# Auto-fix linting issues
pnpm lint:fix

# Update dependencies
pnpm update

# Clean and reinstall
pnpm clean && pnpm install
```

## Special Considerations

### Monorepo Commits
- Consider impact across workspaces
- Test in all affected packages
- Update cross-dependencies if needed

### Database Migrations
- Always backup production before deploying
- Test rollback procedures
- Document any manual steps required

### Breaking Changes
- Clearly mark in commit message
- Update version numbers appropriately
- Provide migration guide

### Hotfixes
- Can skip some checks for critical fixes
- Document what was skipped and why
- Create follow-up tasks for skipped items

## PR Checklist

If creating a Pull Request:
- [ ] PR title follows commit message format
- [ ] PR description explains the why, not just the what
- [ ] Screenshots/recordings added for UI changes
- [ ] Reviewers assigned
- [ ] Labels added (bug, feature, etc.)
- [ ] Linked to issue if applicable
- [ ] Draft PR if work in progress

---

Remember: This checklist is a guide. Use judgment based on the change size and impact. A typo fix doesn't need the full checklist, but a new feature should check all items.