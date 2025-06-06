#!/bin/bash

# Script to test the Departments API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
DEPARTMENT_ID=""
PARENT_DEPT_ID=""

echo -e "${YELLOW}Starting Departments API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new department
echo -e "\n${BLUE}Testing Create Department...${NC}"
DEPARTMENT_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "DEPT001",
    "name": "Information Technology",
    "description": "IT department responsible for all technology infrastructure",
    "managerId": "00000000-0000-0000-0000-000000000001",
    "costCenter": "CC-IT-001",
    "metadata": {
      "budget": 2000000,
      "headcount": 50,
      "location": "HQ",
      "establishedDate": "2015-01-01",
      "functions": ["Infrastructure", "Security", "Development", "Support"]
    },
    "isActive": true
  }')

echo $DEPARTMENT_RESPONSE | jq .

# Extract the department ID from the response
DEPARTMENT_ID=$(echo $DEPARTMENT_RESPONSE | jq -r '.id // empty')

if [ -n "$DEPARTMENT_ID" ] && [ "$DEPARTMENT_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created department with ID: ${DEPARTMENT_ID}${NC}"
  
  # Save parent department ID for hierarchy testing
  PARENT_DEPT_ID=$DEPARTMENT_ID
  
  # Test getting all departments
  echo -e "\n${BLUE}Testing Get All Departments...${NC}"
  ALL_DEPARTMENTS=$(curl -s -X GET "${API_URL}/departments")
  echo "$ALL_DEPARTMENTS" | jq .
  
  # Count the departments
  DEPARTMENT_COUNT=$(echo "$ALL_DEPARTMENTS" | jq '. | length')
  echo -e "${GREEN}Found ${DEPARTMENT_COUNT} departments${NC}"
  
  # Test getting a specific department
  echo -e "\n${BLUE}Testing Get Department by ID...${NC}"
  SINGLE_DEPARTMENT=$(curl -s -X GET "${API_URL}/departments/${DEPARTMENT_ID}")
  echo "$SINGLE_DEPARTMENT" | jq .
  
  # Test getting active departments
  echo -e "\n${BLUE}Testing Get Active Departments...${NC}"
  ACTIVE_DEPARTMENTS=$(curl -s -X GET "${API_URL}/departments?isActive=true")
  echo "$ACTIVE_DEPARTMENTS" | jq .
  
  # Test creating a sub-department
  echo -e "\n${BLUE}Testing Create Sub-Department...${NC}"
  SUB_DEPT_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
    -H "Content-Type: application/json" \
    -d "{
      \"departmentId\": \"DEPT001-01\",
      \"name\": \"Software Development\",
      \"description\": \"Software development team within IT\",
      \"parentDepartmentId\": \"${PARENT_DEPT_ID}\",
      \"managerId\": \"00000000-0000-0000-0000-000000000002\",
      \"costCenter\": \"CC-IT-001-01\",
      \"metadata\": {
        \"budget\": 500000,
        \"headcount\": 20,
        \"teamType\": \"Engineering\"
      },
      \"isActive\": true
    }")
  
  SUB_DEPT_ID=$(echo $SUB_DEPT_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created sub-department with ID: ${SUB_DEPT_ID}${NC}"
  
  # Test getting department hierarchy
  echo -e "\n${BLUE}Testing Get Department Hierarchy...${NC}"
  HIERARCHY_RESPONSE=$(curl -s -X GET "${API_URL}/departments/${PARENT_DEPT_ID}/hierarchy")
  echo "$HIERARCHY_RESPONSE" | jq .
  
  # Test getting department employees
  echo -e "\n${BLUE}Testing Get Department Employees...${NC}"
  EMPLOYEES_RESPONSE=$(curl -s -X GET "${API_URL}/departments/${DEPARTMENT_ID}/employees")
  echo "$EMPLOYEES_RESPONSE" | jq .
  
  # Test updating a department (PUT)
  echo -e "\n${BLUE}Testing Update Department (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/departments/${DEPARTMENT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Information Technology & Digital Services",
      "description": "IT and digital transformation department",
      "metadata": {
        "budget": 2500000,
        "headcount": 65,
        "location": "HQ",
        "establishedDate": "2015-01-01",
        "functions": ["Infrastructure", "Security", "Development", "Support", "Digital Innovation"],
        "certifications": ["ISO 27001", "SOC 2"]
      }
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Department (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/departments/${DEPARTMENT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "currentSpend": 625000,
        "budgetUtilization": 0.25,
        "quarterlyReview": "2025-01-03"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated department
  echo -e "\n${BLUE}Getting updated department...${NC}"
  curl -s -X GET "${API_URL}/departments/${DEPARTMENT_ID}" | jq .
  
  # Test department budget report
  echo -e "\n${BLUE}Testing Department Budget Report...${NC}"
  BUDGET_REPORT=$(curl -s -X GET "${API_URL}/departments/${DEPARTMENT_ID}/budget-report")
  echo "$BUDGET_REPORT" | jq .
  
  # Test creating another department
  echo -e "\n${BLUE}Creating second department for testing...${NC}"
  SECOND_DEPT_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
    -H "Content-Type: application/json" \
    -d '{
      "departmentId": "DEPT002",
      "name": "Human Resources",
      "description": "HR department",
      "managerId": "00000000-0000-0000-0000-000000000003",
      "costCenter": "CC-HR-001",
      "metadata": {
        "budget": 500000,
        "headcount": 10
      },
      "isActive": true
    }')
  
  SECOND_DEPT_ID=$(echo $SECOND_DEPT_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second department with ID: ${SECOND_DEPT_ID}${NC}"
  
  # Test department transfer
  echo -e "\n${BLUE}Testing Department Transfer...${NC}"
  TRANSFER_RESPONSE=$(curl -s -X POST "${API_URL}/departments/transfer" \
    -H "Content-Type: application/json" \
    -d "{
      \"fromDepartmentId\": \"${SUB_DEPT_ID}\",
      \"toDepartmentId\": \"${SECOND_DEPT_ID}\",
      \"transferType\": \"merge\",
      \"effectiveDate\": \"2025-02-01\"
    }")
  echo "$TRANSFER_RESPONSE" | jq .
  
  # Test deactivating a department
  echo -e "\n${BLUE}Testing Deactivate Department...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/departments/${SECOND_DEPT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "isActive": false,
      "metadata": {
        "deactivationReason": "Department restructuring",
        "deactivationDate": "2025-01-03"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test deleting a department (should fail if it has sub-departments)
  echo -e "\n${BLUE}Testing Delete Department with Sub-departments (should fail)...${NC}"
  PARENT_DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/departments/${PARENT_DEPT_ID}")
  
  if [ "$PARENT_DELETE_STATUS" -eq 400 ] || [ "$PARENT_DELETE_STATUS" -eq 409 ]; then
    echo -e "${GREEN}Correctly prevented deletion of department with sub-departments. Status code: ${PARENT_DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Unexpected status when trying to delete parent department. Status code: ${PARENT_DELETE_STATUS}${NC}"
  fi
  
  # Delete sub-department first
  echo -e "\n${BLUE}Deleting sub-department...${NC}"
  curl -s -X DELETE "${API_URL}/departments/${SUB_DEPT_ID}" > /dev/null
  echo -e "${GREEN}Deleted sub-department${NC}"
  
  # Now delete parent department
  echo -e "\n${BLUE}Testing Delete Department...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/departments/${DEPARTMENT_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted department with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete department. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the department is deleted
  echo -e "\n${BLUE}Verifying department is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/departments/${DEPARTMENT_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Department successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Department might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second department
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/departments/${SECOND_DEPT_ID}" > /dev/null
  echo -e "${GREEN}Deleted second department${NC}"
  
else
  echo -e "${RED}Failed to create department or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating department without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Incomplete department"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate department ID
echo -e "\n${YELLOW}Testing duplicate department ID...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "DEPT001",
    "name": "Duplicate Department",
    "managerId": "00000000-0000-0000-0000-000000000001"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid manager ID
echo -e "\n${YELLOW}Testing invalid manager ID...${NC}"
INVALID_MANAGER_RESPONSE=$(curl -s -X POST "${API_URL}/departments" \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "DEPT999",
    "name": "Invalid Manager Department",
    "managerId": "invalid-uuid"
  }')
echo "$INVALID_MANAGER_RESPONSE" | jq .

# Test circular parent reference
echo -e "\n${YELLOW}Testing circular parent reference...${NC}"
CIRCULAR_RESPONSE=$(curl -s -X PATCH "${API_URL}/departments/${DEPARTMENT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"parentDepartmentId\": \"${DEPARTMENT_ID}\"
  }")
echo "$CIRCULAR_RESPONSE" | jq .

# Test getting non-existent department
echo -e "\n${YELLOW}Testing get non-existent department...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/departments/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Departments API tests completed.${NC}"