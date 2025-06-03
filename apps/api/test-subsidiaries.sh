#!/bin/bash

# Script to test the Subsidiaries API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
SUBSIDIARY_ID=""
PARENT_SUB_ID=""

echo -e "${YELLOW}Starting Subsidiaries API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new subsidiary
echo -e "\n${BLUE}Testing Create Subsidiary...${NC}"
SUBSIDIARY_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "subsidiaryId": "SUB001",
    "name": "North America Operations",
    "legalName": "Global Tech North America Inc.",
    "taxId": "87-6543210",
    "currency": "USD",
    "country": "USA",
    "metadata": {
      "region": "North America",
      "establishedDate": "2015-01-01",
      "employeeCount": 2000,
      "revenue": 500000000,
      "profitCenter": "PC-NA-001",
      "consolidationMethod": "Full",
      "ownershipPercentage": 100,
      "registrationNumber": "DEL-12345678"
    },
    "isActive": true,
    "isElimination": false
  }')

echo $SUBSIDIARY_RESPONSE | jq .

# Extract the subsidiary ID from the response
SUBSIDIARY_ID=$(echo $SUBSIDIARY_RESPONSE | jq -r '.id // empty')

if [ -n "$SUBSIDIARY_ID" ] && [ "$SUBSIDIARY_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created subsidiary with ID: ${SUBSIDIARY_ID}${NC}"
  
  # Save parent subsidiary ID for hierarchy testing
  PARENT_SUB_ID=$SUBSIDIARY_ID
  
  # Test getting all subsidiaries
  echo -e "\n${BLUE}Testing Get All Subsidiaries...${NC}"
  ALL_SUBSIDIARIES=$(curl -s -X GET "${API_URL}/subsidiaries")
  echo "$ALL_SUBSIDIARIES" | jq .
  
  # Count the subsidiaries
  SUBSIDIARY_COUNT=$(echo "$ALL_SUBSIDIARIES" | jq '. | length')
  echo -e "${GREEN}Found ${SUBSIDIARY_COUNT} subsidiaries${NC}"
  
  # Test getting a specific subsidiary
  echo -e "\n${BLUE}Testing Get Subsidiary by ID...${NC}"
  SINGLE_SUBSIDIARY=$(curl -s -X GET "${API_URL}/subsidiaries/${SUBSIDIARY_ID}")
  echo "$SINGLE_SUBSIDIARY" | jq .
  
  # Test getting active subsidiaries
  echo -e "\n${BLUE}Testing Get Active Subsidiaries...${NC}"
  ACTIVE_SUBSIDIARIES=$(curl -s -X GET "${API_URL}/subsidiaries?isActive=true")
  echo "$ACTIVE_SUBSIDIARIES" | jq .
  
  # Test getting subsidiaries by country
  echo -e "\n${BLUE}Testing Get Subsidiaries by Country...${NC}"
  COUNTRY_SUBSIDIARIES=$(curl -s -X GET "${API_URL}/subsidiaries?country=USA")
  echo "$COUNTRY_SUBSIDIARIES" | jq .
  
  # Test creating a child subsidiary
  echo -e "\n${BLUE}Testing Create Child Subsidiary...${NC}"
  CHILD_SUB_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
    -H "Content-Type: application/json" \
    -d "{
      \"subsidiaryId\": \"SUB001-01\",
      \"name\": \"US West Coast Division\",
      \"legalName\": \"Global Tech US West Inc.\",
      \"parentSubsidiaryId\": \"${PARENT_SUB_ID}\",
      \"taxId\": \"87-6543211\",
      \"currency\": \"USD\",
      \"country\": \"USA\",
      \"metadata\": {
        \"region\": \"North America\",
        \"subRegion\": \"West Coast\",
        \"establishedDate\": \"2018-06-01\",
        \"employeeCount\": 500,
        \"revenue\": 125000000,
        \"state\": \"California\",
        \"ownershipPercentage\": 100
      },
      \"isActive\": true,
      \"isElimination\": false
    }")
  
  CHILD_SUB_ID=$(echo $CHILD_SUB_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created child subsidiary with ID: ${CHILD_SUB_ID}${NC}"
  
  # Test getting subsidiary hierarchy
  echo -e "\n${BLUE}Testing Get Subsidiary Hierarchy...${NC}"
  HIERARCHY_RESPONSE=$(curl -s -X GET "${API_URL}/subsidiaries/${PARENT_SUB_ID}/hierarchy")
  echo "$HIERARCHY_RESPONSE" | jq .
  
  # Test subsidiary consolidation report
  echo -e "\n${BLUE}Testing Get Consolidation Report...${NC}"
  CONSOLIDATION_RESPONSE=$(curl -s -X GET "${API_URL}/subsidiaries/${PARENT_SUB_ID}/consolidation-report")
  echo "$CONSOLIDATION_RESPONSE" | jq .
  
  # Test updating a subsidiary (PUT)
  echo -e "\n${BLUE}Testing Update Subsidiary (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/subsidiaries/${SUBSIDIARY_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "North America Operations Hub",
      "legalName": "Global Tech North America Holdings Inc.",
      "metadata": {
        "region": "North America",
        "establishedDate": "2015-01-01",
        "employeeCount": 2500,
        "revenue": 650000000,
        "profitCenter": "PC-NA-001",
        "consolidationMethod": "Full",
        "ownershipPercentage": 100,
        "registrationNumber": "DEL-12345678",
        "lastAuditDate": "2024-12-15",
        "auditor": "Big Four Auditor"
      },
      "notes": "Expanded operations after acquisitions"
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Subsidiary (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/subsidiaries/${SUBSIDIARY_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "currentYearRevenue": 165000000,
        "currentQuarter": "Q1-2025",
        "performanceRating": "Exceeds Expectations"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated subsidiary
  echo -e "\n${BLUE}Getting updated subsidiary...${NC}"
  curl -s -X GET "${API_URL}/subsidiaries/${SUBSIDIARY_ID}" | jq .
  
  # Test creating another subsidiary
  echo -e "\n${BLUE}Creating second subsidiary for testing...${NC}"
  SECOND_SUB_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
    -H "Content-Type: application/json" \
    -d '{
      "subsidiaryId": "SUB002",
      "name": "European Operations",
      "legalName": "Global Tech Europe GmbH",
      "taxId": "DE123456789",
      "currency": "EUR",
      "country": "Germany",
      "metadata": {
        "region": "Europe",
        "establishedDate": "2016-01-01",
        "employeeCount": 1500,
        "revenue": 400000000,
        "vatNumber": "DE123456789",
        "ownershipPercentage": 100
      },
      "isActive": true,
      "isElimination": false
    }')
  
  SECOND_SUB_ID=$(echo $SECOND_SUB_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second subsidiary with ID: ${SECOND_SUB_ID}${NC}"
  
  # Test creating elimination subsidiary
  echo -e "\n${BLUE}Testing Create Elimination Subsidiary...${NC}"
  ELIM_SUB_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
    -H "Content-Type: application/json" \
    -d '{
      "subsidiaryId": "SUB-ELIM",
      "name": "Intercompany Eliminations",
      "legalName": "Consolidation Eliminations",
      "currency": "USD",
      "country": "USA",
      "metadata": {
        "purpose": "Consolidation eliminations",
        "automatedEliminations": true
      },
      "isActive": true,
      "isElimination": true
    }')
  
  ELIM_SUB_ID=$(echo $ELIM_SUB_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created elimination subsidiary with ID: ${ELIM_SUB_ID}${NC}"
  
  # Test intercompany transaction
  echo -e "\n${BLUE}Testing Record Intercompany Transaction...${NC}"
  INTERCO_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries/intercompany-transaction" \
    -H "Content-Type: application/json" \
    -d "{
      \"fromSubsidiaryId\": \"${SUBSIDIARY_ID}\",
      \"toSubsidiaryId\": \"${SECOND_SUB_ID}\",
      \"amount\": 1000000,
      \"currency\": \"USD\",
      \"transactionType\": \"Service Fee\",
      \"description\": \"Q1 2025 Management Services\"
    }")
  echo "$INTERCO_RESPONSE" | jq .
  
  # Test deactivating a subsidiary
  echo -e "\n${BLUE}Testing Deactivate Subsidiary...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/subsidiaries/${SECOND_SUB_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "isActive": false,
      "metadata": {
        "deactivationReason": "Restructuring",
        "deactivationDate": "2025-01-03",
        "transferredTo": "North America Operations"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test deleting a subsidiary (should fail if it has children)
  echo -e "\n${BLUE}Testing Delete Subsidiary with Children (should fail)...${NC}"
  PARENT_DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/subsidiaries/${PARENT_SUB_ID}")
  
  if [ "$PARENT_DELETE_STATUS" -eq 400 ] || [ "$PARENT_DELETE_STATUS" -eq 409 ]; then
    echo -e "${GREEN}Correctly prevented deletion of subsidiary with children. Status code: ${PARENT_DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Unexpected status when trying to delete parent subsidiary. Status code: ${PARENT_DELETE_STATUS}${NC}"
  fi
  
  # Delete child subsidiary first
  echo -e "\n${BLUE}Deleting child subsidiary...${NC}"
  curl -s -X DELETE "${API_URL}/subsidiaries/${CHILD_SUB_ID}" > /dev/null
  echo -e "${GREEN}Deleted child subsidiary${NC}"
  
  # Now delete parent subsidiary
  echo -e "\n${BLUE}Testing Delete Subsidiary...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/subsidiaries/${SUBSIDIARY_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted subsidiary with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete subsidiary. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the subsidiary is deleted
  echo -e "\n${BLUE}Verifying subsidiary is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/subsidiaries/${SUBSIDIARY_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Subsidiary successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Subsidiary might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete other subsidiaries
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/subsidiaries/${SECOND_SUB_ID}" > /dev/null
  curl -s -X DELETE "${API_URL}/subsidiaries/${ELIM_SUB_ID}" > /dev/null
  echo -e "${GREEN}Deleted remaining test subsidiaries${NC}"
  
else
  echo -e "${RED}Failed to create subsidiary or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating subsidiary without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate subsidiary ID
echo -e "\n${YELLOW}Testing duplicate subsidiary ID...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "subsidiaryId": "SUB001",
    "name": "Duplicate Subsidiary",
    "currency": "USD",
    "country": "USA"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid currency code
echo -e "\n${YELLOW}Testing invalid currency code...${NC}"
INVALID_CURRENCY_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "subsidiaryId": "SUB999",
    "name": "Invalid Currency Sub",
    "currency": "XXX",
    "country": "USA"
  }')
echo "$INVALID_CURRENCY_RESPONSE" | jq .

# Test invalid country code
echo -e "\n${YELLOW}Testing invalid country code...${NC}"
INVALID_COUNTRY_RESPONSE=$(curl -s -X POST "${API_URL}/subsidiaries" \
  -H "Content-Type: application/json" \
  -d '{
    "subsidiaryId": "SUB998",
    "name": "Invalid Country Sub",
    "currency": "USD",
    "country": "XX"
  }')
echo "$INVALID_COUNTRY_RESPONSE" | jq .

# Test circular parent reference
echo -e "\n${YELLOW}Testing circular parent reference...${NC}"
CIRCULAR_RESPONSE=$(curl -s -X PATCH "${API_URL}/subsidiaries/${SUBSIDIARY_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"parentSubsidiaryId\": \"${SUBSIDIARY_ID}\"
  }")
echo "$CIRCULAR_RESPONSE" | jq .

# Test getting non-existent subsidiary
echo -e "\n${YELLOW}Testing get non-existent subsidiary...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/subsidiaries/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Subsidiaries API tests completed.${NC}"