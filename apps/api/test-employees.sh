#!/bin/bash

# Script to test the Employees API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
EMPLOYEE_ID=""

echo -e "${YELLOW}Starting Employees API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new employee
echo -e "\n${BLUE}Testing Create Employee...${NC}"
EMPLOYEE_RESPONSE=$(curl -s -X POST "${API_URL}/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Johnson",
    "code": "EMP001",
    "email": "sarah.johnson@company.com",
    "phone": "555-234-5678",
    "metadata": {
      "employeeId": "EMP001",
      "department": "Engineering",
      "title": "Senior Software Engineer",
      "startDate": "2023-01-15",
      "manager": "Mike Davis",
      "location": "San Francisco",
      "employmentType": "Full-time"
    },
    "status": "active"
  }')

echo $EMPLOYEE_RESPONSE | jq .

# Extract the employee ID from the response
EMPLOYEE_ID=$(echo $EMPLOYEE_RESPONSE | jq -r '.id // empty')

if [ -n "$EMPLOYEE_ID" ] && [ "$EMPLOYEE_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created employee with ID: ${EMPLOYEE_ID}${NC}"
  
  # Test getting all employees
  echo -e "\n${BLUE}Testing Get All Employees...${NC}"
  ALL_EMPLOYEES=$(curl -s -X GET "${API_URL}/employees")
  echo "$ALL_EMPLOYEES" | jq .
  
  # Count the employees
  EMPLOYEE_COUNT=$(echo "$ALL_EMPLOYEES" | jq '. | length')
  echo -e "${GREEN}Found ${EMPLOYEE_COUNT} employees${NC}"
  
  # Test getting a specific employee
  echo -e "\n${BLUE}Testing Get Employee by ID...${NC}"
  SINGLE_EMPLOYEE=$(curl -s -X GET "${API_URL}/employees/${EMPLOYEE_ID}")
  echo "$SINGLE_EMPLOYEE" | jq .
  
  # Test getting active employees
  echo -e "\n${BLUE}Testing Get Active Employees...${NC}"
  ACTIVE_EMPLOYEES=$(curl -s -X GET "${API_URL}/employees?status=active")
  echo "$ACTIVE_EMPLOYEES" | jq .
  
  # Test updating an employee (PUT)
  echo -e "\n${BLUE}Testing Update Employee (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/employees/${EMPLOYEE_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Sarah M. Johnson",
      "email": "sarah.m.johnson@company.com",
      "phone": "555-987-6543",
      "metadata": {
        "employeeId": "EMP001",
        "department": "Engineering",
        "title": "Engineering Manager",
        "startDate": "2023-01-15",
        "promotionDate": "2024-06-01",
        "manager": "CEO",
        "location": "San Francisco",
        "employmentType": "Full-time",
        "directReports": 5
      }
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Employee (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/employees/${EMPLOYEE_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "salary": "Confidential",
        "emergencyContact": "555-111-2222"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated employee
  echo -e "\n${BLUE}Getting updated employee...${NC}"
  curl -s -X GET "${API_URL}/employees/${EMPLOYEE_ID}" | jq .
  
  # Test creating another employee
  echo -e "\n${BLUE}Creating second employee for testing...${NC}"
  SECOND_EMPLOYEE_RESPONSE=$(curl -s -X POST "${API_URL}/employees" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Robert Chen",
      "code": "EMP002",
      "email": "robert.chen@company.com",
      "phone": "555-345-6789",
      "metadata": {
        "employeeId": "EMP002",
        "department": "Marketing",
        "title": "Marketing Specialist",
        "startDate": "2024-03-01",
        "manager": "Sarah Johnson",
        "location": "Remote",
        "employmentType": "Contract"
      },
      "status": "active"
    }')
  
  SECOND_EMPLOYEE_ID=$(echo $SECOND_EMPLOYEE_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second employee with ID: ${SECOND_EMPLOYEE_ID}${NC}"
  
  # Test deactivating an employee (soft delete)
  echo -e "\n${BLUE}Testing Deactivate Employee...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/employees/${EMPLOYEE_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "inactive",
      "metadata": {
        "terminationDate": "2025-01-01",
        "terminationReason": "Resigned"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test deleting an employee
  echo -e "\n${BLUE}Testing Delete Employee...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/employees/${EMPLOYEE_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted employee with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete employee. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the employee is deleted
  echo -e "\n${BLUE}Verifying employee is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/employees/${EMPLOYEE_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Employee successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Employee might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second employee
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/employees/${SECOND_EMPLOYEE_ID}" > /dev/null
  echo -e "${GREEN}Deleted second employee${NC}"
  
else
  echo -e "${RED}Failed to create employee or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating employee without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@company.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate employee code
echo -e "\n${YELLOW}Testing duplicate employee code...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Employee",
    "code": "EMP001",
    "email": "duplicate@company.com"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid email format
echo -e "\n${YELLOW}Testing invalid email format...${NC}"
INVALID_EMAIL_RESPONSE=$(curl -s -X POST "${API_URL}/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Email Employee",
    "code": "EMP999",
    "email": "not-an-email"
  }')
echo "$INVALID_EMAIL_RESPONSE" | jq .

# Test getting non-existent employee
echo -e "\n${YELLOW}Testing get non-existent employee...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/employees/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Employees API tests completed.${NC}"