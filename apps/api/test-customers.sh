#!/bin/bash

# Script to test the Customers API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
CUSTOMER_ID=""
CONTACT_ID=""

echo -e "${YELLOW}Starting Customers API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new customer
echo -e "\n${BLUE}Testing Create Customer...${NC}"
CUSTOMER_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "code": "CUST001",
    "email": "billing@acmecorp.com",
    "phone": "555-123-4567",
    "website": "https://acmecorp.com",
    "taxId": "87-6543210",
    "metadata": {
      "customerType": "Enterprise",
      "industry": "Technology",
      "accountManager": "John Smith",
      "contractValue": 250000,
      "paymentTerms": "Net 30",
      "creditLimit": 100000,
      "preferredCurrency": "USD",
      "billingCycle": "Monthly",
      "customerSince": "2020-01-15"
    },
    "status": "active",
    "description": "Enterprise customer with multi-year contract"
  }')

echo $CUSTOMER_RESPONSE | jq .

# Extract the customer ID from the response
CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | jq -r '.id // empty')

if [ -n "$CUSTOMER_ID" ] && [ "$CUSTOMER_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created customer with ID: ${CUSTOMER_ID}${NC}"
  
  # Test getting all customers
  echo -e "\n${BLUE}Testing Get All Customers...${NC}"
  ALL_CUSTOMERS=$(curl -s -X GET "${API_URL}/customers")
  echo "$ALL_CUSTOMERS" | jq .
  
  # Count the customers
  CUSTOMER_COUNT=$(echo "$ALL_CUSTOMERS" | jq '. | length')
  echo -e "${GREEN}Found ${CUSTOMER_COUNT} customers${NC}"
  
  # Test getting a specific customer
  echo -e "\n${BLUE}Testing Get Customer by ID...${NC}"
  SINGLE_CUSTOMER=$(curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}")
  echo "$SINGLE_CUSTOMER" | jq .
  
  # Test getting active customers
  echo -e "\n${BLUE}Testing Get Active Customers...${NC}"
  ACTIVE_CUSTOMERS=$(curl -s -X GET "${API_URL}/customers?status=active")
  echo "$ACTIVE_CUSTOMERS" | jq .
  
  # Test creating a contact for the customer
  echo -e "\n${BLUE}Testing Add Contact to Customer...${NC}"
  CONTACT_RESPONSE=$(curl -s -X POST "${API_URL}/customers/${CUSTOMER_ID}/contacts" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Jane Doe",
      "email": "jane.doe@acmecorp.com",
      "phone": "555-123-4568",
      "metadata": {
        "title": "VP of Operations",
        "department": "Operations",
        "isPrimary": true
      }
    }')
  
  CONTACT_ID=$(echo $CONTACT_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Added contact with ID: ${CONTACT_ID}${NC}"
  
  # Test getting customer contacts
  echo -e "\n${BLUE}Testing Get Customer Contacts...${NC}"
  CONTACTS_RESPONSE=$(curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}/contacts")
  echo "$CONTACTS_RESPONSE" | jq .
  
  # Test updating a customer (PUT)
  echo -e "\n${BLUE}Testing Update Customer (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/customers/${CUSTOMER_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Acme Corporation International",
      "email": "accounts@acmecorp.com",
      "phone": "555-987-6543",
      "metadata": {
        "customerType": "Enterprise Plus",
        "industry": "Technology",
        "accountManager": "Jane Smith",
        "contractValue": 500000,
        "paymentTerms": "Net 45",
        "creditLimit": 200000,
        "preferredCurrency": "USD",
        "billingCycle": "Quarterly",
        "customerSince": "2020-01-15",
        "renewalDate": "2026-01-15",
        "satisfaction_score": 4.8
      },
      "notes": "Upgraded to Enterprise Plus tier. Doubled contract value."
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Customer (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/customers/${CUSTOMER_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "lastOrderDate": "2025-01-02",
        "totalRevenue": 125000,
        "outstandingBalance": 15000
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated customer
  echo -e "\n${BLUE}Getting updated customer...${NC}"
  curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}" | jq .
  
  # Test customer credit check
  echo -e "\n${BLUE}Testing Customer Credit Check...${NC}"
  CREDIT_CHECK_RESPONSE=$(curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}/credit-check")
  echo "$CREDIT_CHECK_RESPONSE" | jq .
  
  # Test customer transaction history
  echo -e "\n${BLUE}Testing Get Customer Transactions...${NC}"
  TRANSACTIONS_RESPONSE=$(curl -s -X GET "${API_URL}/customers/${CUSTOMER_ID}/transactions?limit=10")
  echo "$TRANSACTIONS_RESPONSE" | jq .
  
  # Test creating another customer
  echo -e "\n${BLUE}Creating second customer for testing...${NC}"
  SECOND_CUSTOMER_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Small Business Inc",
      "code": "CUST002",
      "email": "info@smallbusiness.com",
      "phone": "555-234-5678",
      "metadata": {
        "customerType": "SMB",
        "industry": "Retail",
        "accountManager": "Bob Johnson",
        "contractValue": 25000,
        "paymentTerms": "Net 15"
      },
      "status": "active"
    }')
  
  SECOND_CUSTOMER_ID=$(echo $SECOND_CUSTOMER_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second customer with ID: ${SECOND_CUSTOMER_ID}${NC}"
  
  # Test customer merge
  echo -e "\n${BLUE}Testing Customer Merge...${NC}"
  MERGE_RESPONSE=$(curl -s -X POST "${API_URL}/customers/merge" \
    -H "Content-Type: application/json" \
    -d "{
      \"primaryCustomerId\": \"${CUSTOMER_ID}\",
      \"secondaryCustomerId\": \"${SECOND_CUSTOMER_ID}\",
      \"mergeReason\": \"Duplicate customer records\"
    }")
  echo "$MERGE_RESPONSE" | jq .
  
  # Test deactivating a customer
  echo -e "\n${BLUE}Testing Deactivate Customer...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/customers/${CUSTOMER_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "inactive",
      "metadata": {
        "deactivationReason": "Contract expired",
        "deactivationDate": "2025-01-03"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test deleting a customer
  echo -e "\n${BLUE}Testing Delete Customer...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/customers/${CUSTOMER_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted customer with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete customer. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the customer is deleted
  echo -e "\n${BLUE}Verifying customer is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/customers/${CUSTOMER_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Customer successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Customer might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - try to delete second customer if it wasn't merged
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/customers/${SECOND_CUSTOMER_ID}" > /dev/null 2>&1
  echo -e "${GREEN}Cleanup completed${NC}"
  
else
  echo -e "${RED}Failed to create customer or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating customer without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@customer.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate customer code
echo -e "\n${YELLOW}Testing duplicate customer code...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Customer",
    "code": "CUST001",
    "email": "duplicate@customer.com"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid credit limit
echo -e "\n${YELLOW}Testing invalid credit limit...${NC}"
INVALID_CREDIT_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Credit Customer",
    "code": "CUST999",
    "email": "credit@customer.com",
    "metadata": {
      "creditLimit": -1000
    }
  }')
echo "$INVALID_CREDIT_RESPONSE" | jq .

# Test getting non-existent customer
echo -e "\n${YELLOW}Testing get non-existent customer...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/customers/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Customers API tests completed.${NC}"