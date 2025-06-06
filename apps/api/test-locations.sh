#!/bin/bash

# Script to test the Locations API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
LOCATION_ID=""
PARENT_LOC_ID=""

echo -e "${YELLOW}Starting Locations API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new location
echo -e "\n${BLUE}Testing Create Location...${NC}"
LOCATION_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "LOC001",
    "name": "San Francisco Headquarters",
    "locationType": "Headquarters",
    "address": {
      "street1": "100 Market Street",
      "street2": "Suite 500",
      "city": "San Francisco",
      "stateProvince": "CA",
      "postalCode": "94105",
      "country": "USA"
    },
    "timezone": "America/Los_Angeles",
    "metadata": {
      "facilitySize": 50000,
      "capacity": 500,
      "departments": ["IT", "Sales", "Marketing", "Executive"],
      "amenities": ["Cafeteria", "Gym", "Parking"],
      "securityLevel": "High",
      "leaseExpiry": "2028-12-31"
    },
    "isActive": true,
    "isOperational": true
  }')

echo $LOCATION_RESPONSE | jq .

# Extract the location ID from the response
LOCATION_ID=$(echo $LOCATION_RESPONSE | jq -r '.id // empty')

if [ -n "$LOCATION_ID" ] && [ "$LOCATION_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created location with ID: ${LOCATION_ID}${NC}"
  
  # Save parent location ID for hierarchy testing
  PARENT_LOC_ID=$LOCATION_ID
  
  # Test getting all locations
  echo -e "\n${BLUE}Testing Get All Locations...${NC}"
  ALL_LOCATIONS=$(curl -s -X GET "${API_URL}/locations")
  echo "$ALL_LOCATIONS" | jq .
  
  # Count the locations
  LOCATION_COUNT=$(echo "$ALL_LOCATIONS" | jq '. | length')
  echo -e "${GREEN}Found ${LOCATION_COUNT} locations${NC}"
  
  # Test getting a specific location
  echo -e "\n${BLUE}Testing Get Location by ID...${NC}"
  SINGLE_LOCATION=$(curl -s -X GET "${API_URL}/locations/${LOCATION_ID}")
  echo "$SINGLE_LOCATION" | jq .
  
  # Test getting active locations
  echo -e "\n${BLUE}Testing Get Active Locations...${NC}"
  ACTIVE_LOCATIONS=$(curl -s -X GET "${API_URL}/locations?isActive=true")
  echo "$ACTIVE_LOCATIONS" | jq .
  
  # Test getting locations by type
  echo -e "\n${BLUE}Testing Get Locations by Type...${NC}"
  TYPE_LOCATIONS=$(curl -s -X GET "${API_URL}/locations?locationType=Headquarters")
  echo "$TYPE_LOCATIONS" | jq .
  
  # Test creating a sub-location
  echo -e "\n${BLUE}Testing Create Sub-Location...${NC}"
  SUB_LOC_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
    -H "Content-Type: application/json" \
    -d "{
      \"locationId\": \"LOC001-01\",
      \"name\": \"SF HQ - Building A\",
      \"locationType\": \"Building\",
      \"parentLocationId\": \"${PARENT_LOC_ID}\",
      \"address\": {
        \"street1\": \"100 Market Street\",
        \"street2\": \"Building A\",
        \"city\": \"San Francisco\",
        \"stateProvince\": \"CA\",
        \"postalCode\": \"94105\",
        \"country\": \"USA\"
      },
      \"timezone\": \"America/Los_Angeles\",
      \"metadata\": {
        \"floor\": \"1-10\",
        \"capacity\": 250
      },
      \"isActive\": true,
      \"isOperational\": true
    }")
  
  SUB_LOC_ID=$(echo $SUB_LOC_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created sub-location with ID: ${SUB_LOC_ID}${NC}"
  
  # Test getting location hierarchy
  echo -e "\n${BLUE}Testing Get Location Hierarchy...${NC}"
  HIERARCHY_RESPONSE=$(curl -s -X GET "${API_URL}/locations/${PARENT_LOC_ID}/hierarchy")
  echo "$HIERARCHY_RESPONSE" | jq .
  
  # Test getting nearby locations
  echo -e "\n${BLUE}Testing Get Nearby Locations...${NC}"
  NEARBY_RESPONSE=$(curl -s -X GET "${API_URL}/locations/${LOCATION_ID}/nearby?radius=10")
  echo "$NEARBY_RESPONSE" | jq .
  
  # Test updating a location (PUT)
  echo -e "\n${BLUE}Testing Update Location (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/locations/${LOCATION_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "San Francisco Global Headquarters",
      "address": {
        "street1": "100 Market Street",
        "street2": "Floors 5-10",
        "city": "San Francisco",
        "stateProvince": "CA",
        "postalCode": "94105",
        "country": "USA"
      },
      "metadata": {
        "facilitySize": 75000,
        "capacity": 750,
        "departments": ["IT", "Sales", "Marketing", "Executive", "R&D"],
        "amenities": ["Cafeteria", "Gym", "Parking", "Wellness Center"],
        "securityLevel": "High",
        "leaseExpiry": "2030-12-31",
        "renovationDate": "2024-06-01",
        "certifications": ["LEED Gold", "WELL Certified"]
      },
      "notes": "Expanded facility after renovation"
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Location (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/locations/${LOCATION_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "currentOccupancy": 425,
        "utilizationRate": 0.85,
        "lastInspectionDate": "2025-01-02"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated location
  echo -e "\n${BLUE}Getting updated location...${NC}"
  curl -s -X GET "${API_URL}/locations/${LOCATION_ID}" | jq .
  
  # Test location capacity report
  echo -e "\n${BLUE}Testing Location Capacity Report...${NC}"
  CAPACITY_REPORT=$(curl -s -X GET "${API_URL}/locations/${LOCATION_ID}/capacity-report")
  echo "$CAPACITY_REPORT" | jq .
  
  # Test creating another location
  echo -e "\n${BLUE}Creating second location for testing...${NC}"
  SECOND_LOC_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
    -H "Content-Type: application/json" \
    -d '{
      "locationId": "LOC002",
      "name": "Austin Satellite Office",
      "locationType": "Office",
      "address": {
        "street1": "200 Congress Ave",
        "city": "Austin",
        "stateProvince": "TX",
        "postalCode": "78701",
        "country": "USA"
      },
      "timezone": "America/Chicago",
      "metadata": {
        "facilitySize": 10000,
        "capacity": 50
      },
      "isActive": true,
      "isOperational": true
    }')
  
  SECOND_LOC_ID=$(echo $SECOND_LOC_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second location with ID: ${SECOND_LOC_ID}${NC}"
  
  # Test location transfer
  echo -e "\n${BLUE}Testing Location Operations Transfer...${NC}"
  TRANSFER_RESPONSE=$(curl -s -X POST "${API_URL}/locations/transfer-operations" \
    -H "Content-Type: application/json" \
    -d "{
      \"fromLocationId\": \"${SECOND_LOC_ID}\",
      \"toLocationId\": \"${LOCATION_ID}\",
      \"transferDate\": \"2025-03-01\",
      \"reason\": \"Office consolidation\"
    }")
  echo "$TRANSFER_RESPONSE" | jq .
  
  # Test marking location as non-operational
  echo -e "\n${BLUE}Testing Mark Location Non-Operational...${NC}"
  NON_OP_RESPONSE=$(curl -s -X PATCH "${API_URL}/locations/${SECOND_LOC_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "isOperational": false,
      "metadata": {
        "closureReason": "Office consolidation",
        "closureDate": "2025-03-01",
        "forwardingLocation": "San Francisco HQ"
      }
    }')
  echo "$NON_OP_RESPONSE" | jq .
  
  # Test deleting a location (should fail if it has sub-locations)
  echo -e "\n${BLUE}Testing Delete Location with Sub-locations (should fail)...${NC}"
  PARENT_DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/locations/${PARENT_LOC_ID}")
  
  if [ "$PARENT_DELETE_STATUS" -eq 400 ] || [ "$PARENT_DELETE_STATUS" -eq 409 ]; then
    echo -e "${GREEN}Correctly prevented deletion of location with sub-locations. Status code: ${PARENT_DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Unexpected status when trying to delete parent location. Status code: ${PARENT_DELETE_STATUS}${NC}"
  fi
  
  # Delete sub-location first
  echo -e "\n${BLUE}Deleting sub-location...${NC}"
  curl -s -X DELETE "${API_URL}/locations/${SUB_LOC_ID}" > /dev/null
  echo -e "${GREEN}Deleted sub-location${NC}"
  
  # Now delete parent location
  echo -e "\n${BLUE}Testing Delete Location...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/locations/${LOCATION_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted location with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete location. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the location is deleted
  echo -e "\n${BLUE}Verifying location is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/locations/${LOCATION_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Location successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Location might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second location
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/locations/${SECOND_LOC_ID}" > /dev/null
  echo -e "${GREEN}Deleted second location${NC}"
  
else
  echo -e "${RED}Failed to create location or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating location without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "locationType": "Office"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate location ID
echo -e "\n${YELLOW}Testing duplicate location ID...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "LOC001",
    "name": "Duplicate Location",
    "locationType": "Office"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid location type
echo -e "\n${YELLOW}Testing invalid location type...${NC}"
INVALID_TYPE_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "LOC999",
    "name": "Invalid Type Location",
    "locationType": "InvalidType"
  }')
echo "$INVALID_TYPE_RESPONSE" | jq .

# Test invalid timezone
echo -e "\n${YELLOW}Testing invalid timezone...${NC}"
INVALID_TZ_RESPONSE=$(curl -s -X POST "${API_URL}/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "LOC998",
    "name": "Invalid Timezone Location",
    "locationType": "Office",
    "timezone": "Invalid/Timezone"
  }')
echo "$INVALID_TZ_RESPONSE" | jq .

# Test circular parent reference
echo -e "\n${YELLOW}Testing circular parent reference...${NC}"
CIRCULAR_RESPONSE=$(curl -s -X PATCH "${API_URL}/locations/${LOCATION_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"parentLocationId\": \"${LOCATION_ID}\"
  }")
echo "$CIRCULAR_RESPONSE" | jq .

# Test getting non-existent location
echo -e "\n${YELLOW}Testing get non-existent location...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/locations/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Locations API tests completed.${NC}"