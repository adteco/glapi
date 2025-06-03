#!/bin/bash

# Script to test the Leads API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
LEAD_ID=""

echo -e "${YELLOW}Starting Leads API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new lead
echo -e "\n${BLUE}Testing Create Lead...${NC}"
LEAD_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Potential Corp",
    "code": "LEAD001",
    "email": "contact@potentialcorp.com",
    "phone": "555-345-6789",
    "website": "https://potentialcorp.com",
    "metadata": {
      "source": "Website",
      "industry": "Technology",
      "companySize": "50-100",
      "estimatedValue": 50000,
      "leadScore": 85,
      "interests": ["Cloud Services", "Security"],
      "assignedTo": "Sales Rep 1",
      "stage": "Qualification"
    },
    "status": "active",
    "description": "Interested in enterprise cloud solutions"
  }')

echo $LEAD_RESPONSE | jq .

# Extract the lead ID from the response
LEAD_ID=$(echo $LEAD_RESPONSE | jq -r '.id // empty')

if [ -n "$LEAD_ID" ] && [ "$LEAD_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created lead with ID: ${LEAD_ID}${NC}"
  
  # Test getting all leads
  echo -e "\n${BLUE}Testing Get All Leads...${NC}"
  ALL_LEADS=$(curl -s -X GET "${API_URL}/leads")
  echo "$ALL_LEADS" | jq .
  
  # Count the leads
  LEAD_COUNT=$(echo "$ALL_LEADS" | jq '. | length')
  echo -e "${GREEN}Found ${LEAD_COUNT} leads${NC}"
  
  # Test getting a specific lead
  echo -e "\n${BLUE}Testing Get Lead by ID...${NC}"
  SINGLE_LEAD=$(curl -s -X GET "${API_URL}/leads/${LEAD_ID}")
  echo "$SINGLE_LEAD" | jq .
  
  # Test getting active leads
  echo -e "\n${BLUE}Testing Get Active Leads...${NC}"
  ACTIVE_LEADS=$(curl -s -X GET "${API_URL}/leads?status=active")
  echo "$ACTIVE_LEADS" | jq .
  
  # Test updating a lead (PUT)
  echo -e "\n${BLUE}Testing Update Lead (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/leads/${LEAD_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Potential Corp Inc.",
      "email": "sales@potentialcorp.com",
      "phone": "555-987-6543",
      "metadata": {
        "source": "Website",
        "industry": "Technology",
        "companySize": "100-200",
        "estimatedValue": 75000,
        "leadScore": 92,
        "interests": ["Cloud Services", "Security", "AI/ML"],
        "assignedTo": "Sales Rep 1",
        "stage": "Proposal",
        "lastContactDate": "2025-01-03",
        "nextFollowUp": "2025-01-10"
      },
      "notes": "Had initial demo call. Very interested in security features."
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Lead (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/leads/${LEAD_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "leadScore": 95,
        "stage": "Negotiation",
        "competitorInfo": "Currently using competitor X"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated lead
  echo -e "\n${BLUE}Getting updated lead...${NC}"
  curl -s -X GET "${API_URL}/leads/${LEAD_ID}" | jq .
  
  # Test creating another lead
  echo -e "\n${BLUE}Creating second lead for testing...${NC}"
  SECOND_LEAD_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Small Business LLC",
      "code": "LEAD002",
      "email": "info@smallbusiness.com",
      "phone": "555-456-7890",
      "metadata": {
        "source": "Referral",
        "industry": "Retail",
        "companySize": "10-50",
        "estimatedValue": 15000,
        "leadScore": 65,
        "interests": ["Basic Package"],
        "assignedTo": "Sales Rep 2",
        "stage": "New"
      },
      "status": "active"
    }')
  
  SECOND_LEAD_ID=$(echo $SECOND_LEAD_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second lead with ID: ${SECOND_LEAD_ID}${NC}"
  
  # Test converting a lead to prospect
  echo -e "\n${BLUE}Testing Convert Lead to Prospect...${NC}"
  CONVERT_RESPONSE=$(curl -s -X POST "${API_URL}/leads/${LEAD_ID}/convert-to-prospect" \
    -H "Content-Type: application/json" \
    -d '{
      "reason": "Qualified and ready for sales process",
      "convertedBy": "Sales Manager"
    }')
  echo "$CONVERT_RESPONSE" | jq .
  
  # Test marking a lead as lost
  echo -e "\n${BLUE}Testing Mark Lead as Lost...${NC}"
  LOST_RESPONSE=$(curl -s -X PATCH "${API_URL}/leads/${SECOND_LEAD_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "inactive",
      "metadata": {
        "stage": "Lost",
        "lostReason": "Budget constraints",
        "lostDate": "2025-01-03"
      }
    }')
  echo "$LOST_RESPONSE" | jq .
  
  # Test deleting a lead
  echo -e "\n${BLUE}Testing Delete Lead...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/leads/${LEAD_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted lead with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete lead. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the lead is deleted
  echo -e "\n${BLUE}Verifying lead is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/leads/${LEAD_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Lead successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Lead might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second lead
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/leads/${SECOND_LEAD_ID}" > /dev/null
  echo -e "${GREEN}Deleted second lead${NC}"
  
else
  echo -e "${RED}Failed to create lead or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating lead without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@lead.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate lead code
echo -e "\n${YELLOW}Testing duplicate lead code...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Lead",
    "code": "LEAD001",
    "email": "duplicate@lead.com"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid email format
echo -e "\n${YELLOW}Testing invalid email format...${NC}"
INVALID_EMAIL_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Email Lead",
    "code": "LEAD999",
    "email": "not-an-email"
  }')
echo "$INVALID_EMAIL_RESPONSE" | jq .

# Test invalid lead score
echo -e "\n${YELLOW}Testing invalid lead score...${NC}"
INVALID_SCORE_RESPONSE=$(curl -s -X POST "${API_URL}/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Score Lead",
    "code": "LEAD998",
    "email": "score@lead.com",
    "metadata": {
      "leadScore": 150
    }
  }')
echo "$INVALID_SCORE_RESPONSE" | jq .

# Test getting non-existent lead
echo -e "\n${YELLOW}Testing get non-existent lead...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/leads/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Leads API tests completed.${NC}"