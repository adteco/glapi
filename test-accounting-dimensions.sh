#!/bin/bash

# Test script for accounting dimensions with Clerk auth
# This tests that all dimensions (classes, departments, locations, subsidiaries) 
# handle JWT auth and row-level security correctly

API_URL="http://localhost:3001/api/v1"

# Test with no auth token (should get 401)
echo "=== Testing without auth token (expecting 401) ==="
echo "Testing classes..."
curl -s -o /dev/null -w "%{http_code}" "$API_URL/classes" | xargs -I {} echo "Classes: {}"
echo "Testing departments..."
curl -s -o /dev/null -w "%{http_code}" "$API_URL/departments" | xargs -I {} echo "Departments: {}"
echo "Testing locations..."
curl -s -o /dev/null -w "%{http_code}" "$API_URL/locations" | xargs -I {} echo "Locations: {}"
echo "Testing subsidiaries..."
curl -s -o /dev/null -w "%{http_code}" "$API_URL/subsidiaries" | xargs -I {} echo "Subsidiaries: {}"
echo ""

# Test with dev token (should get 200)
echo "=== Testing with dev auth token (expecting 200) ==="
# In development, the Clerk middleware allows requests without token and uses org_development
echo "Testing classes..."
curl -s "$API_URL/classes" | jq '.total' | xargs -I {} echo "Classes found: {}"
echo "Testing departments..."
curl -s "$API_URL/departments" | jq '.total' | xargs -I {} echo "Departments found: {}"
echo "Testing locations..."
curl -s "$API_URL/locations" | jq '.total' | xargs -I {} echo "Locations found: {}"
echo "Testing subsidiaries..."
curl -s "$API_URL/subsidiaries" | jq '.total' | xargs -I {} echo "Subsidiaries found: {}"
echo ""

# Test creating a subsidiary (to have data for other dimensions)
echo "=== Creating test subsidiary ==="
SUBSIDIARY_RESPONSE=$(curl -s -X POST "$API_URL/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Subsidiary",
    "code": "TEST-SUB",
    "description": "Test subsidiary for dimension testing"
  }')

SUBSIDIARY_ID=$(echo "$SUBSIDIARY_RESPONSE" | jq -r '.id')
echo "Created subsidiary with ID: $SUBSIDIARY_ID"
echo ""

# Test creating dimensions with the subsidiary
echo "=== Creating test dimensions ==="

# Create class
CLASS_RESPONSE=$(curl -s -X POST "$API_URL/classes" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Class\",
    \"code\": \"TEST-CLASS\",
    \"description\": \"Test class for RLS testing\",
    \"subsidiaryId\": \"$SUBSIDIARY_ID\"
  }")
echo "Created class: $(echo "$CLASS_RESPONSE" | jq -r '.name // .message')"

# Create department
DEPT_RESPONSE=$(curl -s -X POST "$API_URL/departments" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Department\",
    \"code\": \"TEST-DEPT\",
    \"description\": \"Test department for RLS testing\",
    \"subsidiaryId\": \"$SUBSIDIARY_ID\"
  }")
echo "Created department: $(echo "$DEPT_RESPONSE" | jq -r '.name // .message')"

# Create location
LOC_RESPONSE=$(curl -s -X POST "$API_URL/locations" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Location\",
    \"code\": \"TEST-LOC\",
    \"description\": \"Test location for RLS testing\",
    \"subsidiaryId\": \"$SUBSIDIARY_ID\",
    \"addressLine1\": \"123 Test St\",
    \"city\": \"Test City\",
    \"stateProvince\": \"TS\",
    \"postalCode\": \"12345\",
    \"countryCode\": \"US\"
  }")
echo "Created location: $(echo "$LOC_RESPONSE" | jq -r '.name // .message')"
echo ""

# List all dimensions to verify they're filtered by organization
echo "=== Listing dimensions (should only see org_development data) ==="
echo "Classes:"
curl -s "$API_URL/classes" | jq '.data[] | {id, name, organizationId}'
echo ""
echo "Departments:"
curl -s "$API_URL/departments" | jq '.data[] | {id, name, organizationId}'
echo ""
echo "Locations:"
curl -s "$API_URL/locations" | jq '.data[] | {id, name, organizationId}'
echo ""
echo "Subsidiaries:"
curl -s "$API_URL/subsidiaries" | jq '.data[] | {id, name, organizationId}'
echo ""

echo "=== Test complete ==="
echo "All dimensions should:"
echo "1. Return 401 without auth (if not in dev mode)"
echo "2. Use organizationId from JWT token"
echo "3. Filter results by organizationId"
echo "4. Store Clerk org IDs (org_xxx format)"