#!/bin/bash

# GLAPI Pre-commit Script
# Run this before committing to ensure code quality

echo "🔍 Running pre-commit checks..."
echo "================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to run a check
run_check() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    
    if eval $command > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED=1
        return 1
    fi
}

# Function to run a check with output
run_check_with_output() {
    local name=$1
    local command=$2
    
    echo ""
    echo "🔧 $name"
    echo "-------------------"
    
    if eval $command; then
        echo -e "${GREEN}✓ $name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $name failed${NC}"
        FAILED=1
        return 1
    fi
    echo ""
}

# 1. Check for console.log statements
echo -n "Checking for console.log statements... "
CONSOLE_LOGS=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -exec grep -l "console\.log" {} \; 2>/dev/null | head -10)

if [ -z "$CONSOLE_LOGS" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  Found console.log in:"
    echo "$CONSOLE_LOGS" | sed 's/^/    /'
    echo "  Consider removing debugging statements"
fi

# 2. Check for hardcoded secrets
echo -n "Checking for potential secrets... "
SECRETS=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -not -name "package*.json" \
    -exec grep -E -l "(api_key|apiKey|API_KEY|secret|SECRET|password|PASSWORD|token|TOKEN).*=.*['\"][^'\"]*['\"]" {} \; 2>/dev/null | head -10)

if [ -z "$SECRETS" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Potential secrets found in:"
    echo "$SECRETS" | sed 's/^/    /'
    FAILED=1
fi

# 3. Run TypeScript check
run_check_with_output "TypeScript" "pnpm type-check"

# 4. Run linting
run_check_with_output "ESLint" "pnpm lint"

# 5. Check if package-lock exists (should only have pnpm-lock.yaml)
echo -n "Checking for package-lock.json... "
if [ -f "package-lock.json" ]; then
    echo -e "${RED}✗${NC}"
    echo "  Found package-lock.json - this project uses pnpm"
    echo "  Run: rm package-lock.json"
    FAILED=1
else
    echo -e "${GREEN}✓${NC}"
fi

# 6. Check for uncommitted schema changes
echo -n "Checking for uncommitted schema changes... "
SCHEMA_CHANGES=$(git status --porcelain | grep -E "(schema|migration)" | grep -v ".md")
if [ -z "$SCHEMA_CHANGES" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  Found uncommitted schema/migration files:"
    echo "$SCHEMA_CHANGES" | sed 's/^/    /'
    echo "  Make sure to run: pnpm db:generate && pnpm db:migrate"
fi

# 6.5. Auto-regenerate AI tools if TRPC routers changed
TRPC_ROUTER_CHANGES=$(git diff --cached --name-only | grep -E "packages/trpc/src/routers/.*\.ts$" | grep -v ".test.ts")
TRPC_SCRIPT_CHANGES=$(git diff --cached --name-only | grep -E "packages/trpc/(scripts|src)/(generate|ai-meta|openapi)")

if [ -n "$TRPC_ROUTER_CHANGES" ] || [ -n "$TRPC_SCRIPT_CHANGES" ]; then
    echo ""
    echo -e "${YELLOW}🔄 TRPC changes detected - regenerating AI tools and OpenAPI...${NC}"

    # Run generation
    if pnpm turbo run generate:ai-tools generate:openapi --filter=@glapi/trpc > /dev/null 2>&1; then
        # Check if generated files changed
        GENERATED_CHANGES=$(git status --porcelain apps/docs/public/api/openapi.json apps/web/src/lib/ai/generated/ 2>/dev/null)

        if [ -n "$GENERATED_CHANGES" ]; then
            echo -e "${GREEN}✓${NC} Generated files updated. Staging changes..."
            git add apps/docs/public/api/openapi.json apps/web/src/lib/ai/generated/
            echo "  Staged:"
            echo "$GENERATED_CHANGES" | sed 's/^/    /'
        else
            echo -e "${GREEN}✓${NC} Generated files already up to date"
        fi
    else
        echo -e "${RED}✗${NC} Generation failed!"
        echo "  Run manually: pnpm turbo run generate:ai-tools generate:openapi --filter=@glapi/trpc"
        FAILED=1
    fi
    echo ""
fi

# 7. Check for TODO comments
echo -n "Checking for TODO comments... "
TODOS=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -exec grep -l "TODO\|FIXME\|HACK" {} \; 2>/dev/null | head -10)

if [ -z "$TODOS" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  Found TODO/FIXME/HACK in:"
    echo "$TODOS" | sed 's/^/    /'
    echo "  Consider addressing or creating issues for these"
fi

# 8. Check for large files
echo -n "Checking for large files... "
LARGE_FILES=$(find . -type f -size +1M -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/.git/*" | head -10)
if [ -z "$LARGE_FILES" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  Found large files (>1MB):"
    echo "$LARGE_FILES" | sed 's/^/    /'
    echo "  Consider using Git LFS or optimizing these files"
fi

# 9. Check for API documentation (for route changes)
echo -n "Checking API documentation... "
ROUTE_CHANGES=$(git diff --cached --name-only | grep -E "apps/api/src/routes/.*\.ts$" | grep -v ".test.ts")
if [ -n "$ROUTE_CHANGES" ]; then
    echo ""
    echo "  Found API route changes:"
    MISSING_DOCS=0
    
    for ROUTE in $ROUTE_CHANGES; do
        ROUTE_NAME=$(basename "$ROUTE" .ts)
        ENTITY=${ROUTE_NAME%Routes}
        echo -n "    $ENTITY: "
        
        CHECKS=""
        # Check OpenAPI spec
        if [ -f "docs/api-specs/${ENTITY}.openapi.yaml" ]; then
            CHECKS="${CHECKS}OpenAPI✓ "
        else
            CHECKS="${CHECKS}OpenAPI✗ "
            MISSING_DOCS=1
        fi
        
        # Check user docs
        if [ -f "apps/docs/src/app/api/${ENTITY}/page.mdx" ]; then
            CHECKS="${CHECKS}Docs✓ "
        else
            CHECKS="${CHECKS}Docs✗ "
            MISSING_DOCS=1
        fi
        
        # Check test files
        if [ -f "apps/api/test-${ENTITY}.sh" ] || [ -f "apps/api/test-${ENTITY}.http" ]; then
            CHECKS="${CHECKS}Tests✓"
        else
            CHECKS="${CHECKS}Tests⚠"
        fi
        
        echo "$CHECKS"
    done
    
    if [ $MISSING_DOCS -eq 1 ]; then
        echo -e "  ${RED}✗ Missing required API documentation${NC}"
        echo "  Every API change MUST include:"
        echo "    - OpenAPI spec in /docs/api-specs/"
        echo "    - User docs in /apps/docs/src/app/api/"
        echo "    - Test scripts in /apps/api/"
        FAILED=1
    fi
else
    echo -e "${GREEN}✓${NC}"
fi

# Final summary
echo ""
echo "================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Ready to commit. Don't forget to:"
    echo "  - Write a clear commit message"
    echo "  - Reference any related issues"
    echo "  - Update documentation if needed"
else
    echo -e "${RED}❌ Some checks failed!${NC}"
    echo ""
    echo "Please fix the issues above before committing."
    echo "You can override this with 'git commit --no-verify' but it's not recommended."
    exit 1
fi

echo ""
echo "💡 Tip: Add this as a git hook with:"
echo "   ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit"