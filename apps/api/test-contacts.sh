#!/bin/bash

# Script to test the Contacts API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
CONTACT_ID=""
PARENT_ENTITY_ID="" # We'll need to create a customer first as parent

echo -e "${YELLOW}Starting Contacts API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# First create a parent entity (customer) for our contacts
echo -e "\n${BLUE}Creating parent customer entity...${NC}"
PARENT_RESPONSE=$(curl -s -X POST "${API_URL}/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company for Contacts",
    "code": "TESTCO-CONTACTS",
    "entityTypes": ["Customer"],
    "email": "company@test.com",
    "status": "active"
  }')

PARENT_ENTITY_ID=$(echo $PARENT_RESPONSE | jq -r '.id // empty')
echo -e "${GREEN}Created parent entity with ID: ${PARENT_ENTITY_ID}${NC}"

# Test creating a new contact
echo -e "\n${BLUE}Testing Create Contact...${NC}"
CONTACT_RESPONSE=$(curl -s -X POST "${API_URL}/contacts" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"John Doe\",
    \"email\": \"john.doe@test.com\",
    \"phone\": \"555-123-4567\",
    \"parentEntityId\": \"${PARENT_ENTITY_ID}\",
    \"metadata\": {
      \"title\": \"Senior Manager\",
      \"department\": \"Sales\"
    }
  }")

echo $CONTACT_RESPONSE | jq .

# Extract the contact ID from the response
CONTACT_ID=$(echo $CONTACT_RESPONSE | jq -r '.id // empty')

if [ -n "$CONTACT_ID" ] && [ "$CONTACT_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created contact with ID: ${CONTACT_ID}${NC}"
  
  # Test getting all contacts
  echo -e "\n${BLUE}Testing Get All Contacts...${NC}"
  ALL_CONTACTS=$(curl -s -X GET "${API_URL}/contacts")
  echo "$ALL_CONTACTS" | jq .
  
  # Count the contacts
  CONTACT_COUNT=$(echo "$ALL_CONTACTS" | jq '. | length')
  echo -e "${GREEN}Found ${CONTACT_COUNT} contacts${NC}"
  
  # Test getting a specific contact
  echo -e "\n${BLUE}Testing Get Contact by ID...${NC}"
  SINGLE_CONTACT=$(curl -s -X GET "${API_URL}/contacts/${CONTACT_ID}")
  echo "$SINGLE_CONTACT" | jq .
  
  # Test getting contacts by parent entity
  echo -e "\n${BLUE}Testing Get Contacts by Parent Entity...${NC}"
  PARENT_CONTACTS=$(curl -s -X GET "${API_URL}/contacts?parentEntityId=${PARENT_ENTITY_ID}")
  echo "$PARENT_CONTACTS" | jq .
  
  # Test updating a contact (PUT)
  echo -e "\n${BLUE}Testing Update Contact (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/contacts/${CONTACT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "John D. Doe",
      "email": "john.doe.updated@test.com",
      "phone": "555-987-6543",
      "metadata": {
        "title": "Executive Vice President",
        "department": "Sales & Marketing"
      }
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Contact (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/contacts/${CONTACT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "555-555-5555",
      "metadata": {
        "mobile": "555-222-3333"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated contact
  echo -e "\n${BLUE}Getting updated contact...${NC}"
  curl -s -X GET "${API_URL}/contacts/${CONTACT_ID}" | jq .
  
  # Test creating another contact
  echo -e "\n${BLUE}Creating second contact for testing...${NC}"
  SECOND_CONTACT_RESPONSE=$(curl -s -X POST "${API_URL}/contacts" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Jane Smith\",
      \"email\": \"jane.smith@test.com\",
      \"phone\": \"555-456-7890\",
      \"parentEntityId\": \"${PARENT_ENTITY_ID}\",
      \"metadata\": {
        \"title\": \"Account Manager\",
        \"department\": \"Support\"
      }
    }")
  
  SECOND_CONTACT_ID=$(echo $SECOND_CONTACT_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second contact with ID: ${SECOND_CONTACT_ID}${NC}"
  
  # Test deleting a contact
  echo -e "\n${BLUE}Testing Delete Contact...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/contacts/${CONTACT_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted contact with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete contact. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the contact is deleted
  echo -e "\n${BLUE}Verifying contact is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/contacts/${CONTACT_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Contact successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Contact might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second contact
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/contacts/${SECOND_CONTACT_ID}" > /dev/null
  echo -e "${GREEN}Deleted second contact${NC}"
  
else
  echo -e "${RED}Failed to create contact or extract ID from response${NC}"
fi

# Clean up - delete parent entity
if [ -n "$PARENT_ENTITY_ID" ] && [ "$PARENT_ENTITY_ID" != "null" ]; then
  curl -s -X DELETE "${API_URL}/customers/${PARENT_ENTITY_ID}" > /dev/null
  echo -e "${GREEN}Deleted parent entity${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating contact without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/contacts" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@test.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test invalid email format
echo -e "\n${YELLOW}Testing invalid email format...${NC}"
INVALID_EMAIL_RESPONSE=$(curl -s -X POST "${API_URL}/contacts" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Email Contact",
    "email": "not-an-email"
  }')
echo "$INVALID_EMAIL_RESPONSE" | jq .

# Test getting non-existent contact
echo -e "\n${YELLOW}Testing get non-existent contact...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/contacts/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Contacts API tests completed.${NC}"