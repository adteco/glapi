#!/bin/bash

# Check API Documentation Completeness

# Get the script's directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Checking API Documentation Status..."
echo "====================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find all route files
ROUTES=$(find "$PROJECT_ROOT/apps/api/src/routes" -name "*.ts" -not -name "*.test.ts" -not -name "gl.router.ts" | sort)

# Summary counters
TOTAL_ROUTES=0
COMPLETE_ROUTES=0
MISSING_OPENAPI=0
MISSING_DOCS=0
MISSING_TESTS=0

echo -e "${BLUE}Entity${NC}          | OpenAPI | User Docs | Tests  | Status"
echo "---------------|---------|-----------|--------|--------"

for ROUTE in $ROUTES; do
    ROUTE_NAME=$(basename "$ROUTE" .ts)
    ENTITY=${ROUTE_NAME%Routes}
    
    # Skip index files
    if [ "$ENTITY" = "index" ]; then
        continue
    fi
    
    TOTAL_ROUTES=$((TOTAL_ROUTES + 1))
    
    # Check what exists
    HAS_OPENAPI=false
    HAS_DOCS=false
    HAS_TESTS=false
    
    # Check for both singular and plural forms of OpenAPI specs
    # Special case for subsidiary -> subsidiaries
    if [ "$ENTITY" = "subsidiary" ]; then
        if [ -f "$PROJECT_ROOT/docs/api-specs/subsidiaries.openapi.yaml" ]; then
            HAS_OPENAPI=true
            OPENAPI_STATUS="${GREEN}✓${NC}"
        else
            MISSING_OPENAPI=$((MISSING_OPENAPI + 1))
            OPENAPI_STATUS="${RED}✗${NC}"
        fi
    elif [ -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}.openapi.yaml" ] || [ -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}s.openapi.yaml" ] || [ -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}es.openapi.yaml" ]; then
        HAS_OPENAPI=true
        OPENAPI_STATUS="${GREEN}✓${NC}"
    else
        MISSING_OPENAPI=$((MISSING_OPENAPI + 1))
        OPENAPI_STATUS="${RED}✗${NC}"
    fi
    
    # Check for both singular and plural forms of user docs
    # Special case for subsidiary -> subsidiaries
    if [ "$ENTITY" = "subsidiary" ]; then
        if [ -f "$PROJECT_ROOT/apps/docs/src/app/api/subsidiaries/page.mdx" ]; then
            HAS_DOCS=true
            DOCS_STATUS="${GREEN}✓${NC}"
        else
            MISSING_DOCS=$((MISSING_DOCS + 1))
            DOCS_STATUS="${RED}✗${NC}"
        fi
    elif [ -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}/page.mdx" ] || [ -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}s/page.mdx" ] || [ -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}es/page.mdx" ]; then
        HAS_DOCS=true
        DOCS_STATUS="${GREEN}✓${NC}"
    else
        MISSING_DOCS=$((MISSING_DOCS + 1))
        DOCS_STATUS="${RED}✗${NC}"
    fi
    
    # Special case for subsidiary -> subsidiaries and class -> classes
    if [ "$ENTITY" = "subsidiary" ]; then
        if [ -f "$PROJECT_ROOT/apps/api/test-subsidiaries.sh" ] || [ -f "$PROJECT_ROOT/apps/api/test-subsidiaries.http" ]; then
            HAS_TESTS=true
            TESTS_STATUS="${GREEN}✓${NC}"
        else
            MISSING_TESTS=$((MISSING_TESTS + 1))
            TESTS_STATUS="${YELLOW}⚠${NC}"
        fi
    elif [ "$ENTITY" = "class" ]; then
        if [ -f "$PROJECT_ROOT/apps/api/test-classes.sh" ] || [ -f "$PROJECT_ROOT/apps/api/test-classes.http" ]; then
            HAS_TESTS=true
            TESTS_STATUS="${GREEN}✓${NC}"
        else
            MISSING_TESTS=$((MISSING_TESTS + 1))
            TESTS_STATUS="${YELLOW}⚠${NC}"
        fi
    elif [ -f "$PROJECT_ROOT/apps/api/test-${ENTITY}.sh" ] || [ -f "$PROJECT_ROOT/apps/api/test-${ENTITY}.http" ] || [ -f "$PROJECT_ROOT/apps/api/test-${ENTITY}s.sh" ] || [ -f "$PROJECT_ROOT/apps/api/test-${ENTITY}s.http" ]; then
        HAS_TESTS=true
        TESTS_STATUS="${GREEN}✓${NC}"
    else
        MISSING_TESTS=$((MISSING_TESTS + 1))
        TESTS_STATUS="${YELLOW}⚠${NC}"
    fi
    
    # Overall status
    if [ "$HAS_OPENAPI" = true ] && [ "$HAS_DOCS" = true ] && [ "$HAS_TESTS" = true ]; then
        STATUS="${GREEN}Complete${NC}"
        COMPLETE_ROUTES=$((COMPLETE_ROUTES + 1))
    elif [ "$HAS_OPENAPI" = true ] && [ "$HAS_DOCS" = true ]; then
        STATUS="${YELLOW}No Tests${NC}"
    else
        STATUS="${RED}Missing${NC}"
    fi
    
    # Format entity name with padding
    printf "%-14s | %b       | %b         | %b      | %b\n" "$ENTITY" "$OPENAPI_STATUS" "$DOCS_STATUS" "$TESTS_STATUS" "$STATUS"
done

echo ""
echo "======================================"
echo "Summary:"
echo "--------"
echo -e "Total API Routes:    ${TOTAL_ROUTES}"
echo -e "Complete:           ${GREEN}${COMPLETE_ROUTES}${NC}"
echo -e "Missing OpenAPI:    ${RED}${MISSING_OPENAPI}${NC}"
echo -e "Missing User Docs:  ${RED}${MISSING_DOCS}${NC}"
echo -e "Missing Tests:      ${YELLOW}${MISSING_TESTS}${NC}"

echo ""

# Calculate completion percentage
if [ $TOTAL_ROUTES -gt 0 ]; then
    OPENAPI_PERCENT=$((100 - (MISSING_OPENAPI * 100 / TOTAL_ROUTES)))
    DOCS_PERCENT=$((100 - (MISSING_DOCS * 100 / TOTAL_ROUTES)))
    TESTS_PERCENT=$((100 - (MISSING_TESTS * 100 / TOTAL_ROUTES)))
    COMPLETE_PERCENT=$((COMPLETE_ROUTES * 100 / TOTAL_ROUTES))
    
    echo "Completion Rates:"
    echo "-----------------"
    echo "OpenAPI Specs:  ${OPENAPI_PERCENT}%"
    echo "User Docs:      ${DOCS_PERCENT}%"
    echo "Test Scripts:   ${TESTS_PERCENT}%"
    echo -e "Overall:        ${COMPLETE_PERCENT}%"
fi

echo ""

# Provide actionable next steps
if [ $MISSING_OPENAPI -gt 0 ] || [ $MISSING_DOCS -gt 0 ]; then
    echo -e "${RED}⚠️  Action Required:${NC}"
    echo "The following entities need documentation:"
    echo ""
    
    for ROUTE in $ROUTES; do
        ROUTE_NAME=$(basename "$ROUTE" .ts)
        ENTITY=${ROUTE_NAME%Routes}
        
        if [ "$ENTITY" = "index" ]; then
            continue
        fi
        
        NEEDS_WORK=false
        MISSING_ITEMS=""
        
        if [ ! -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}.openapi.yaml" ] && [ ! -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}s.openapi.yaml" ] && [ ! -f "$PROJECT_ROOT/docs/api-specs/${ENTITY}es.openapi.yaml" ]; then
            NEEDS_WORK=true
            MISSING_ITEMS="${MISSING_ITEMS}OpenAPI "
        fi
        
        if [ ! -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}/page.mdx" ] && [ ! -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}s/page.mdx" ] && [ ! -f "$PROJECT_ROOT/apps/docs/src/app/api/${ENTITY}es/page.mdx" ]; then
            NEEDS_WORK=true
            MISSING_ITEMS="${MISSING_ITEMS}UserDocs "
        fi
        
        if [ ! -f "$PROJECT_ROOT/apps/api/test-${ENTITY}.sh" ] && [ ! -f "$PROJECT_ROOT/apps/api/test-${ENTITY}.http" ] && [ ! -f "$PROJECT_ROOT/apps/api/test-${ENTITY}s.sh" ] && [ ! -f "$PROJECT_ROOT/apps/api/test-${ENTITY}s.http" ]; then
            MISSING_ITEMS="${MISSING_ITEMS}Tests"
        fi
        
        if [ "$NEEDS_WORK" = true ]; then
            echo "  - ${ENTITY}: Missing ${MISSING_ITEMS}"
        fi
    done
    
    echo ""
    echo "To fix:"
    echo "1. Create OpenAPI spec:  docs/api-specs/[entity].openapi.yaml"
    echo "2. Create user docs:     apps/docs/src/app/api/[entity]/page.mdx"
    echo "3. Create test script:   apps/api/test-[entity].sh"
    echo ""
    echo "See /docs/api-documentation-guide.md for templates and examples."
fi

# Exit with error if documentation is incomplete
if [ $MISSING_OPENAPI -gt 0 ] || [ $MISSING_DOCS -gt 0 ]; then
    exit 1
else
    echo -e "${GREEN}✅ API documentation is complete!${NC}"
    exit 0
fi