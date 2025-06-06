#!/bin/bash

# Script to test the GL Accounts API endpoints with Clerk authentication
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# You can set a test JWT token here if you have one from Clerk
# Otherwise, the API will use development fallback
TEST_JWT_TOKEN=""

echo -e "${YELLOW}Starting GL Accounts API tests...${NC}"

# Function to make authenticated requests
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -n "$TEST_JWT_TOKEN" ]; then
    if [ -n "$data" ]; then
      curl -s -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TEST_JWT_TOKEN" \
        -d "$data"
    else
      curl -s -X "$method" "${API_URL}${endpoint}" \
        -H "Authorization: Bearer $TEST_JWT_TOKEN"
    fi
  else
    if [ -n "$data" ]; then
      curl -s -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data"
    else
      curl -s -X "$method" "${API_URL}${endpoint}"
    fi
  fi
}

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test seeding accounts
echo -e "\n${BLUE}Testing GL Accounts Seed Endpoint...${NC}"
echo -e "${YELLOW}Seeding default chart of accounts...${NC}"
SEED_RESPONSE=$(make_request "POST" "/gl/accounts/seed" "")
echo "$SEED_RESPONSE" | jq .

# Check if seeding was successful or accounts already exist
if echo "$SEED_RESPONSE" | grep -q "Default accounts seeded successfully"; then
  echo -e "${GREEN}Successfully seeded default accounts!${NC}"
elif echo "$SEED_RESPONSE" | grep -q "Accounts already exist"; then
  echo -e "${YELLOW}Accounts already exist for this organization.${NC}"
else
  echo -e "${RED}Failed to seed accounts. Response:${NC}"
  echo "$SEED_RESPONSE" | jq .
fi

# Test getting all accounts
echo -e "\n${BLUE}Testing Get All Accounts...${NC}"
ACCOUNTS_RESPONSE=$(make_request "GET" "/gl/accounts" "")
echo "$ACCOUNTS_RESPONSE" | jq .

# Count the accounts
ACCOUNT_COUNT=$(echo "$ACCOUNTS_RESPONSE" | jq '. | length')
echo -e "${GREEN}Found ${ACCOUNT_COUNT} accounts${NC}"

# Get the first account ID for further testing
FIRST_ACCOUNT_ID=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.[0].id // empty')

if [ -n "$FIRST_ACCOUNT_ID" ]; then
  echo -e "\n${BLUE}Testing Get Single Account...${NC}"
  echo -e "${YELLOW}Getting account with ID: ${FIRST_ACCOUNT_ID}${NC}"
  SINGLE_ACCOUNT=$(make_request "GET" "/gl/accounts/${FIRST_ACCOUNT_ID}" "")
  echo "$SINGLE_ACCOUNT" | jq .
fi

# Test creating a new account
echo -e "\n${BLUE}Testing Create New Account...${NC}"
NEW_ACCOUNT_DATA='{
  "accountNumber": "19999",
  "accountName": "Test Account",
  "accountCategory": "Asset",
  "description": "Test account created via API",
  "isActive": true
}'

CREATE_RESPONSE=$(make_request "POST" "/gl/accounts" "$NEW_ACCOUNT_DATA")
echo "$CREATE_RESPONSE" | jq .

# Extract the new account ID
NEW_ACCOUNT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -n "$NEW_ACCOUNT_ID" ]; then
  echo -e "${GREEN}Successfully created account with ID: ${NEW_ACCOUNT_ID}${NC}"
  
  # Test updating the account
  echo -e "\n${BLUE}Testing Update Account...${NC}"
  UPDATE_DATA='{
    "accountName": "Updated Test Account",
    "description": "This account has been updated"
  }'
  
  UPDATE_RESPONSE=$(make_request "PUT" "/gl/accounts/${NEW_ACCOUNT_ID}" "$UPDATE_DATA")
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test deleting the account (soft delete)
  echo -e "\n${BLUE}Testing Delete Account...${NC}"
  DELETE_RESPONSE=$(make_request "DELETE" "/gl/accounts/${NEW_ACCOUNT_ID}" "")
  echo "$DELETE_RESPONSE" | jq .
else
  echo -e "${RED}Failed to create test account${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating duplicate account number
echo -e "${YELLOW}Testing duplicate account number...${NC}"
DUPLICATE_RESPONSE=$(make_request "POST" "/gl/accounts" '{
  "accountNumber": "10000",
  "accountName": "Duplicate Account",
  "accountCategory": "Asset"
}')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid account category
echo -e "\n${YELLOW}Testing invalid account category...${NC}"
INVALID_CATEGORY_RESPONSE=$(make_request "POST" "/gl/accounts" '{
  "accountNumber": "99999",
  "accountName": "Invalid Category Account",
  "accountCategory": "InvalidCategory"
}')
echo "$INVALID_CATEGORY_RESPONSE" | jq .

# Test missing required fields
echo -e "\n${YELLOW}Testing missing required fields...${NC}"
MISSING_FIELDS_RESPONSE=$(make_request "POST" "/gl/accounts" '{
  "accountName": "Missing Account Number"
}')
echo "$MISSING_FIELDS_RESPONSE" | jq .

echo -e "\n${YELLOW}GL Accounts API tests completed.${NC}"