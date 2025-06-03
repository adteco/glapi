#!/bin/bash

# Script to test the Classes API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
CLASS_ID=""

echo -e "${YELLOW}Starting Classes API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new class
echo -e "\n${BLUE}Testing Create Class...${NC}"
CLASS_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "CLASS001",
    "name": "Software Development",
    "description": "All software development activities",
    "classType": "Service",
    "parentClassId": null,
    "metadata": {
      "costCenter": "IT",
      "budgetCode": "IT-001",
      "managedBy": "VP Engineering"
    },
    "isActive": true
  }')

echo $CLASS_RESPONSE | jq .

# Extract the class ID from the response
CLASS_ID=$(echo $CLASS_RESPONSE | jq -r '.id // empty')

if [ -n "$CLASS_ID" ] && [ "$CLASS_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created class with ID: ${CLASS_ID}${NC}"
  
  # Test getting all classes
  echo -e "\n${BLUE}Testing Get All Classes...${NC}"
  ALL_CLASSES=$(curl -s -X GET "${API_URL}/classes")
  echo "$ALL_CLASSES" | jq .
  
  # Count the classes
  CLASS_COUNT=$(echo "$ALL_CLASSES" | jq '. | length')
  echo -e "${GREEN}Found ${CLASS_COUNT} classes${NC}"
  
  # Test getting a specific class
  echo -e "\n${BLUE}Testing Get Class by ID...${NC}"
  SINGLE_CLASS=$(curl -s -X GET "${API_URL}/classes/${CLASS_ID}")
  echo "$SINGLE_CLASS" | jq .
  
  # Test getting active classes
  echo -e "\n${BLUE}Testing Get Active Classes...${NC}"
  ACTIVE_CLASSES=$(curl -s -X GET "${API_URL}/classes?isActive=true")
  echo "$ACTIVE_CLASSES" | jq .
  
  # Test creating a child class
  echo -e "\n${BLUE}Testing Create Child Class...${NC}"
  CHILD_CLASS_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
    -H "Content-Type: application/json" \
    -d "{
      \"classId\": \"CLASS001-01\",
      \"name\": \"Frontend Development\",
      \"description\": \"Frontend development activities\",
      \"classType\": \"Service\",
      \"parentClassId\": \"${CLASS_ID}\",
      \"isActive\": true
    }")
  
  CHILD_CLASS_ID=$(echo $CHILD_CLASS_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created child class with ID: ${CHILD_CLASS_ID}${NC}"
  
  # Test getting class hierarchy
  echo -e "\n${BLUE}Testing Get Class Hierarchy...${NC}"
  HIERARCHY_RESPONSE=$(curl -s -X GET "${API_URL}/classes/${CLASS_ID}/hierarchy")
  echo "$HIERARCHY_RESPONSE" | jq .
  
  # Test updating a class (PUT)
  echo -e "\n${BLUE}Testing Update Class (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/classes/${CLASS_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Software Engineering",
      "description": "All software engineering and development activities",
      "metadata": {
        "costCenter": "IT",
        "budgetCode": "IT-001",
        "budgetAmount": 500000,
        "managedBy": "VP Engineering",
        "lastReviewDate": "2025-01-01"
      }
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Class (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/classes/${CLASS_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "currentSpend": 125000,
        "budgetUtilization": 0.25
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated class
  echo -e "\n${BLUE}Getting updated class...${NC}"
  curl -s -X GET "${API_URL}/classes/${CLASS_ID}" | jq .
  
  # Test creating another class
  echo -e "\n${BLUE}Creating second class for testing...${NC}"
  SECOND_CLASS_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
    -H "Content-Type: application/json" \
    -d '{
      "classId": "CLASS002",
      "name": "Marketing",
      "description": "Marketing and advertising activities",
      "classType": "Overhead",
      "isActive": true
    }')
  
  SECOND_CLASS_ID=$(echo $SECOND_CLASS_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second class with ID: ${SECOND_CLASS_ID}${NC}"
  
  # Test deactivating a class
  echo -e "\n${BLUE}Testing Deactivate Class...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/classes/${SECOND_CLASS_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "isActive": false,
      "metadata": {
        "deactivationReason": "Department restructuring",
        "deactivationDate": "2025-01-03"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test bulk update classes
  echo -e "\n${BLUE}Testing Bulk Update Classes...${NC}"
  BULK_UPDATE_RESPONSE=$(curl -s -X POST "${API_URL}/classes/bulk-update" \
    -H "Content-Type: application/json" \
    -d "{
      \"classIds\": [\"${CLASS_ID}\", \"${CHILD_CLASS_ID}\"],
      \"updates\": {
        \"metadata\": {
          \"fiscalYear\": \"2025\",
          \"lastUpdated\": \"2025-01-03\"
        }
      }
    }")
  echo "$BULK_UPDATE_RESPONSE" | jq .
  
  # Test deleting a class (should fail if it has children)
  echo -e "\n${BLUE}Testing Delete Class with Children (should fail)...${NC}"
  PARENT_DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/classes/${CLASS_ID}")
  
  if [ "$PARENT_DELETE_STATUS" -eq 400 ] || [ "$PARENT_DELETE_STATUS" -eq 409 ]; then
    echo -e "${GREEN}Correctly prevented deletion of class with children. Status code: ${PARENT_DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Unexpected status when trying to delete parent class. Status code: ${PARENT_DELETE_STATUS}${NC}"
  fi
  
  # Delete child class first
  echo -e "\n${BLUE}Deleting child class...${NC}"
  curl -s -X DELETE "${API_URL}/classes/${CHILD_CLASS_ID}" > /dev/null
  echo -e "${GREEN}Deleted child class${NC}"
  
  # Now delete parent class
  echo -e "\n${BLUE}Testing Delete Parent Class...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/classes/${CLASS_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted class with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete class. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the class is deleted
  echo -e "\n${BLUE}Verifying class is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/classes/${CLASS_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Class successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Class might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second class
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/classes/${SECOND_CLASS_ID}" > /dev/null
  echo -e "${GREEN}Deleted second class${NC}"
  
else
  echo -e "${RED}Failed to create class or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating class without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Incomplete class"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate class ID
echo -e "\n${YELLOW}Testing duplicate class ID...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "CLASS001",
    "name": "Duplicate Class",
    "classType": "Service"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid class type
echo -e "\n${YELLOW}Testing invalid class type...${NC}"
INVALID_TYPE_RESPONSE=$(curl -s -X POST "${API_URL}/classes" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "CLASS999",
    "name": "Invalid Type Class",
    "classType": "InvalidType"
  }')
echo "$INVALID_TYPE_RESPONSE" | jq .

# Test circular parent reference
echo -e "\n${YELLOW}Testing circular parent reference...${NC}"
CIRCULAR_RESPONSE=$(curl -s -X PATCH "${API_URL}/classes/${CLASS_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"parentClassId\": \"${CLASS_ID}\"
  }")
echo "$CIRCULAR_RESPONSE" | jq .

# Test getting non-existent class
echo -e "\n${YELLOW}Testing get non-existent class...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/classes/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Classes API tests completed.${NC}"