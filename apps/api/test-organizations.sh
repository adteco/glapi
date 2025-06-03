#!/bin/bash

# Script to test the Organizations API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
ORGANIZATION_ID=""

echo -e "${YELLOW}Starting Organizations API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new organization
echo -e "\n${BLUE}Testing Create Organization...${NC}"
ORGANIZATION_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Global Tech Corporation",
    "legalName": "Global Technology Corporation Inc.",
    "taxId": "54-1234567",
    "website": "https://globaltechcorp.com",
    "industry": "Technology",
    "settings": {
      "fiscalYearEnd": "12-31",
      "defaultCurrency": "USD",
      "multiCurrency": true,
      "timezone": "America/New_York",
      "dateFormat": "MM/DD/YYYY",
      "accountingMethod": "Accrual"
    },
    "metadata": {
      "foundedYear": 2010,
      "employeeCount": 5000,
      "annualRevenue": 1000000000,
      "stockSymbol": "GTC",
      "headquarters": "New York, NY"
    },
    "isActive": true
  }')

echo $ORGANIZATION_RESPONSE | jq .

# Extract the organization ID from the response
ORGANIZATION_ID=$(echo $ORGANIZATION_RESPONSE | jq -r '.id // empty')

if [ -n "$ORGANIZATION_ID" ] && [ "$ORGANIZATION_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created organization with ID: ${ORGANIZATION_ID}${NC}"
  
  # Test getting all organizations
  echo -e "\n${BLUE}Testing Get All Organizations...${NC}"
  ALL_ORGANIZATIONS=$(curl -s -X GET "${API_URL}/organizations")
  echo "$ALL_ORGANIZATIONS" | jq .
  
  # Count the organizations
  ORG_COUNT=$(echo "$ALL_ORGANIZATIONS" | jq '. | length')
  echo -e "${GREEN}Found ${ORG_COUNT} organizations${NC}"
  
  # Test getting a specific organization
  echo -e "\n${BLUE}Testing Get Organization by ID...${NC}"
  SINGLE_ORGANIZATION=$(curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}")
  echo "$SINGLE_ORGANIZATION" | jq .
  
  # Test getting organization settings
  echo -e "\n${BLUE}Testing Get Organization Settings...${NC}"
  SETTINGS_RESPONSE=$(curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}/settings")
  echo "$SETTINGS_RESPONSE" | jq .
  
  # Test getting organization statistics
  echo -e "\n${BLUE}Testing Get Organization Statistics...${NC}"
  STATS_RESPONSE=$(curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}/statistics")
  echo "$STATS_RESPONSE" | jq .
  
  # Test updating an organization (PUT)
  echo -e "\n${BLUE}Testing Update Organization (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/organizations/${ORGANIZATION_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Global Tech Corporation International",
      "legalName": "Global Technology Corporation International Inc.",
      "website": "https://globaltechcorp.io",
      "settings": {
        "fiscalYearEnd": "12-31",
        "defaultCurrency": "USD",
        "multiCurrency": true,
        "timezone": "America/New_York",
        "dateFormat": "MM/DD/YYYY",
        "accountingMethod": "Accrual",
        "consolidationMethod": "Full",
        "revenueRecognitionMethod": "ASC 606"
      },
      "metadata": {
        "foundedYear": 2010,
        "employeeCount": 7500,
        "annualRevenue": 1500000000,
        "stockSymbol": "GTCI",
        "headquarters": "New York, NY",
        "operatingCountries": ["USA", "Canada", "UK", "Germany", "Japan"],
        "certifications": ["ISO 9001", "SOC 2 Type II"]
      }
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Organization (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/organizations/${ORGANIZATION_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "lastAuditDate": "2024-12-15",
        "creditRating": "AA",
        "esgScore": 85
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test updating organization settings
  echo -e "\n${BLUE}Testing Update Organization Settings...${NC}"
  SETTINGS_UPDATE=$(curl -s -X PUT "${API_URL}/organizations/${ORGANIZATION_ID}/settings" \
    -H "Content-Type: application/json" \
    -d '{
      "settings": {
        "requireApprovalForPO": true,
        "poApprovalThreshold": 10000,
        "autoNumberInvoices": true,
        "invoicePrefix": "INV-",
        "defaultPaymentTerms": "Net 30"
      }
    }')
  echo "$SETTINGS_UPDATE" | jq .
  
  # Test getting the updated organization
  echo -e "\n${BLUE}Getting updated organization...${NC}"
  curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}" | jq .
  
  # Test organization hierarchy (if endpoint exists)
  echo -e "\n${BLUE}Testing Get Organization Hierarchy...${NC}"
  HIERARCHY_RESPONSE=$(curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}/hierarchy")
  echo "$HIERARCHY_RESPONSE" | jq .
  
  # Test organization users
  echo -e "\n${BLUE}Testing Get Organization Users...${NC}"
  USERS_RESPONSE=$(curl -s -X GET "${API_URL}/organizations/${ORGANIZATION_ID}/users")
  echo "$USERS_RESPONSE" | jq .
  
  # Test creating another organization
  echo -e "\n${BLUE}Creating second organization for testing...${NC}"
  SECOND_ORG_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Small Business LLC",
      "legalName": "Small Business Limited Liability Company",
      "taxId": "98-7654321",
      "industry": "Retail",
      "settings": {
        "fiscalYearEnd": "06-30",
        "defaultCurrency": "USD",
        "multiCurrency": false,
        "timezone": "America/Chicago"
      },
      "isActive": true
    }')
  
  SECOND_ORG_ID=$(echo $SECOND_ORG_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second organization with ID: ${SECOND_ORG_ID}${NC}"
  
  # Test organization merge (if endpoint exists)
  echo -e "\n${BLUE}Testing Organization Merge...${NC}"
  MERGE_RESPONSE=$(curl -s -X POST "${API_URL}/organizations/merge" \
    -H "Content-Type: application/json" \
    -d "{
      \"primaryOrganizationId\": \"${ORGANIZATION_ID}\",
      \"secondaryOrganizationId\": \"${SECOND_ORG_ID}\",
      \"mergeType\": \"acquisition\",
      \"effectiveDate\": \"2025-04-01\"
    }")
  echo "$MERGE_RESPONSE" | jq .
  
  # Test deactivating an organization
  echo -e "\n${BLUE}Testing Deactivate Organization...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/organizations/${SECOND_ORG_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "isActive": false,
      "metadata": {
        "deactivationReason": "Company acquired",
        "deactivationDate": "2025-01-03"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test archiving an organization
  echo -e "\n${BLUE}Testing Archive Organization...${NC}"
  ARCHIVE_RESPONSE=$(curl -s -X POST "${API_URL}/organizations/${SECOND_ORG_ID}/archive" \
    -H "Content-Type: application/json" \
    -d '{
      "reason": "Company dissolved",
      "archiveDate": "2025-01-03"
    }')
  echo "$ARCHIVE_RESPONSE" | jq .
  
  # Test deleting an organization
  echo -e "\n${BLUE}Testing Delete Organization...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/organizations/${ORGANIZATION_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted organization with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete organization. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the organization is deleted
  echo -e "\n${BLUE}Verifying organization is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/organizations/${ORGANIZATION_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Organization successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Organization might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second organization
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/organizations/${SECOND_ORG_ID}" > /dev/null
  echo -e "${GREEN}Deleted second organization${NC}"
  
else
  echo -e "${RED}Failed to create organization or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating organization without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "Technology"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate tax ID
echo -e "\n${YELLOW}Testing duplicate tax ID...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Org",
    "legalName": "Duplicate Organization Inc.",
    "taxId": "54-1234567"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid tax ID format
echo -e "\n${YELLOW}Testing invalid tax ID format...${NC}"
INVALID_TAX_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Tax Org",
    "legalName": "Bad Tax Organization Inc.",
    "taxId": "invalid-tax-id"
  }')
echo "$INVALID_TAX_RESPONSE" | jq .

# Test invalid fiscal year end
echo -e "\n${YELLOW}Testing invalid fiscal year end...${NC}"
INVALID_FISCAL_RESPONSE=$(curl -s -X POST "${API_URL}/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Fiscal Org",
    "legalName": "Bad Fiscal Organization Inc.",
    "taxId": "12-3456789",
    "settings": {
      "fiscalYearEnd": "13-32"
    }
  }')
echo "$INVALID_FISCAL_RESPONSE" | jq .

# Test getting non-existent organization
echo -e "\n${YELLOW}Testing get non-existent organization...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/organizations/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Organizations API tests completed.${NC}"