#!/bin/bash

# Script to test the Customer API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test variables
ORG_ID="00000000-0000-0000-0000-000000000001" # Example organization ID
CUSTOMER_ID=""

echo -e "${YELLOW}Starting API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new customer
echo -e "\n${YELLOW}Creating a new customer...${NC}"
CUSTOMER_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "companyName": "ACME Test Corp",
    "customerId": "ACME001",
    "contactEmail": "test@acme.com",
    "contactPhone": "555-123-4567",
    "status": "active",
    "billingAddress": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345",
      "country": "USA"
    }
  }')

echo $CUSTOMER_RESPONSE | jq .

# Extract the customer ID from the response
CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | jq -r '.id')

if [ "$CUSTOMER_ID" != "null" ] && [ "$CUSTOMER_ID" != "" ]; then
  echo -e "${GREEN}Successfully created customer with ID: ${CUSTOMER_ID}${NC}"
  
  # Test getting all customers
  echo -e "\n${YELLOW}Getting all customers...${NC}"
  curl -s -X GET "${API_URL}/customers" | jq .
  
  # Test getting a specific customer
  echo -e "\n${YELLOW}Getting customer with ID: ${CUSTOMER_ID}...${NC}"
  curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}" | jq .
  
  # Test updating a customer (PUT)
  echo -e "\n${YELLOW}Updating customer with PUT...${NC}"
  curl -s -X PUT "${API_URL}/customers/${CUSTOMER_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "companyName": "ACME Corporation Updated",
      "contactEmail": "updated@acme.com",
      "contactPhone": "555-987-6543",
      "status": "active",
      "billingAddress": {
        "street": "456 New St",
        "city": "Newtown",
        "state": "NY",
        "postalCode": "54321",
        "country": "USA"
      }
    }' | jq .
  
  # Test partial update a customer (PATCH)
  echo -e "\n${YELLOW}Partially updating customer with PATCH...${NC}"
  curl -s -X PATCH "${API_URL}/customers/${CUSTOMER_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "contactPhone": "555-555-5555"
    }' | jq .
  
  # Test getting the updated customer
  echo -e "\n${YELLOW}Getting updated customer...${NC}"
  curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}" | jq .
  
  # Test deleting a customer
  echo -e "\n${YELLOW}Deleting customer with ID: ${CUSTOMER_ID}...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/customers/${CUSTOMER_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted customer with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete customer. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the customer is deleted
  echo -e "\n${YELLOW}Verifying customer is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/customers/${CUSTOMER_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Customer successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Customer might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
else
  echo -e "${RED}Failed to create customer or extract ID from response${NC}"
fi

echo -e "\n${YELLOW}API tests completed.${NC}"