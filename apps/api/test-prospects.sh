#!/bin/bash

# Script to test the Prospects API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
PROSPECT_ID=""

echo -e "${YELLOW}Starting Prospects API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new prospect
echo -e "\n${BLUE}Testing Create Prospect...${NC}"
PROSPECT_RESPONSE=$(curl -s -X POST "${API_URL}/prospects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Future Tech Solutions",
    "code": "PROS001",
    "email": "sales@futuretechsolutions.com",
    "phone": "555-456-7890",
    "website": "https://futuretechsolutions.com",
    "metadata": {
      "source": "Lead Conversion",
      "industry": "Software",
      "companySize": "200-500",
      "estimatedValue": 125000,
      "opportunityScore": 88,
      "products": ["Enterprise Suite", "Professional Services"],
      "assignedTo": "Senior Sales Rep",
      "stage": "Solution Design",
      "probability": 0.75,
      "expectedCloseDate": "2025-03-31",
      "budget": "100k-150k",
      "decisionMakers": ["CTO", "CFO", "VP Engineering"]
    },
    "status": "active",
    "description": "Qualified prospect interested in full enterprise implementation"
  }')

echo $PROSPECT_RESPONSE | jq .

# Extract the prospect ID from the response
PROSPECT_ID=$(echo $PROSPECT_RESPONSE | jq -r '.id // empty')

if [ -n "$PROSPECT_ID" ] && [ "$PROSPECT_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created prospect with ID: ${PROSPECT_ID}${NC}"
  
  # Test getting all prospects
  echo -e "\n${BLUE}Testing Get All Prospects...${NC}"
  ALL_PROSPECTS=$(curl -s -X GET "${API_URL}/prospects")
  echo "$ALL_PROSPECTS" | jq .
  
  # Count the prospects
  PROSPECT_COUNT=$(echo "$ALL_PROSPECTS" | jq '. | length')
  echo -e "${GREEN}Found ${PROSPECT_COUNT} prospects${NC}"
  
  # Test getting a specific prospect
  echo -e "\n${BLUE}Testing Get Prospect by ID...${NC}"
  SINGLE_PROSPECT=$(curl -s -X GET "${API_URL}/prospects/${PROSPECT_ID}")
  echo "$SINGLE_PROSPECT" | jq .
  
  # Test getting active prospects
  echo -e "\n${BLUE}Testing Get Active Prospects...${NC}"
  ACTIVE_PROSPECTS=$(curl -s -X GET "${API_URL}/prospects?status=active")
  echo "$ACTIVE_PROSPECTS" | jq .
  
  # Test getting high-value prospects
  echo -e "\n${BLUE}Testing Get High-Value Prospects...${NC}"
  HIGH_VALUE_PROSPECTS=$(curl -s -X GET "${API_URL}/prospects?minValue=100000")
  echo "$HIGH_VALUE_PROSPECTS" | jq .
  
  # Test updating a prospect (PUT)
  echo -e "\n${BLUE}Testing Update Prospect (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/prospects/${PROSPECT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Future Tech Solutions Inc.",
      "email": "enterprise@futuretechsolutions.com",
      "phone": "555-987-6543",
      "metadata": {
        "source": "Lead Conversion",
        "industry": "Software",
        "companySize": "200-500",
        "estimatedValue": 150000,
        "opportunityScore": 92,
        "products": ["Enterprise Suite", "Professional Services", "Support Package"],
        "assignedTo": "Senior Sales Rep",
        "stage": "Contract Negotiation",
        "probability": 0.90,
        "expectedCloseDate": "2025-02-28",
        "budget": "140k-160k",
        "decisionMakers": ["CTO", "CFO", "VP Engineering", "CEO"],
        "competitorAnalysis": "Currently evaluating 2 other vendors",
        "lastMeetingDate": "2025-01-02",
        "nextSteps": "Final pricing proposal due Jan 10"
      },
      "notes": "Very engaged. CEO joined last call. Budget approved."
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Prospect (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/prospects/${PROSPECT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "opportunityScore": 95,
        "stage": "Verbal Commitment",
        "proposalSentDate": "2025-01-03",
        "contractDraftStatus": "In Legal Review"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated prospect
  echo -e "\n${BLUE}Getting updated prospect...${NC}"
  curl -s -X GET "${API_URL}/prospects/${PROSPECT_ID}" | jq .
  
  # Test creating another prospect
  echo -e "\n${BLUE}Creating second prospect for testing...${NC}"
  SECOND_PROSPECT_RESPONSE=$(curl -s -X POST "${API_URL}/prospects" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "MidSize Manufacturing Co",
      "code": "PROS002",
      "email": "procurement@midsizemanufacturing.com",
      "phone": "555-567-8901",
      "metadata": {
        "source": "Trade Show",
        "industry": "Manufacturing",
        "companySize": "100-200",
        "estimatedValue": 45000,
        "opportunityScore": 70,
        "products": ["Standard Package"],
        "assignedTo": "Sales Rep 3",
        "stage": "Discovery",
        "probability": 0.40
      },
      "status": "active"
    }')
  
  SECOND_PROSPECT_ID=$(echo $SECOND_PROSPECT_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second prospect with ID: ${SECOND_PROSPECT_ID}${NC}"
  
  # Test converting a prospect to customer
  echo -e "\n${BLUE}Testing Convert Prospect to Customer...${NC}"
  CONVERT_RESPONSE=$(curl -s -X POST "${API_URL}/prospects/${PROSPECT_ID}/convert-to-customer" \
    -H "Content-Type: application/json" \
    -d '{
      "contractValue": 145000,
      "contractStartDate": "2025-03-01",
      "contractEndDate": "2026-02-28",
      "convertedBy": "Sales Manager",
      "notes": "Signed 1-year contract with option to renew"
    }')
  echo "$CONVERT_RESPONSE" | jq .
  
  # Test marking a prospect as lost
  echo -e "\n${BLUE}Testing Mark Prospect as Lost...${NC}"
  LOST_RESPONSE=$(curl -s -X PATCH "${API_URL}/prospects/${SECOND_PROSPECT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "inactive",
      "metadata": {
        "stage": "Lost",
        "lostReason": "Went with competitor",
        "lostDate": "2025-01-03",
        "lostToCompetitor": "Competitor Y",
        "lessonsLearned": "Price was main factor"
      }
    }')
  echo "$LOST_RESPONSE" | jq .
  
  # Test deleting a prospect
  echo -e "\n${BLUE}Testing Delete Prospect...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/prospects/${PROSPECT_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted prospect with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete prospect. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the prospect is deleted
  echo -e "\n${BLUE}Verifying prospect is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/prospects/${PROSPECT_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Prospect successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Prospect might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second prospect
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/prospects/${SECOND_PROSPECT_ID}" > /dev/null
  echo -e "${GREEN}Deleted second prospect${NC}"
  
else
  echo -e "${RED}Failed to create prospect or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating prospect without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/prospects" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@prospect.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate prospect code
echo -e "\n${YELLOW}Testing duplicate prospect code...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/prospects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Prospect",
    "code": "PROS001",
    "email": "duplicate@prospect.com"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid probability value
echo -e "\n${YELLOW}Testing invalid probability value...${NC}"
INVALID_PROB_RESPONSE=$(curl -s -X POST "${API_URL}/prospects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Probability Prospect",
    "code": "PROS999",
    "email": "prob@prospect.com",
    "metadata": {
      "probability": 1.5
    }
  }')
echo "$INVALID_PROB_RESPONSE" | jq .

# Test getting non-existent prospect
echo -e "\n${YELLOW}Testing get non-existent prospect...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/prospects/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Prospects API tests completed.${NC}"