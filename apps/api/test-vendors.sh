#!/bin/bash

# Script to test the Vendors API endpoints
API_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test variables
VENDOR_ID=""

echo -e "${YELLOW}Starting Vendors API tests...${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
curl -s -X GET "http://localhost:3001/health" | jq .

# Test creating a new vendor
echo -e "\n${BLUE}Testing Create Vendor...${NC}"
VENDOR_RESPONSE=$(curl -s -X POST "${API_URL}/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Office Supplies Direct",
    "code": "VEND001",
    "email": "orders@officesuppliesdirect.com",
    "phone": "555-678-9012",
    "website": "https://officesuppliesdirect.com",
    "taxId": "12-3456789",
    "metadata": {
      "vendorType": "Supplier",
      "category": "Office Supplies",
      "paymentTerms": "Net 30",
      "preferredPaymentMethod": "ACH",
      "accountNumber": "ACC-12345",
      "bankInfo": {
        "bankName": "Business Bank",
        "routingNumber": "123456789",
        "accountNumber": "987654321"
      },
      "contacts": {
        "primary": "John Smith",
        "accounts": "Jane Doe",
        "support": "support@officesuppliesdirect.com"
      },
      "contractEndDate": "2025-12-31",
      "minimumOrderAmount": 100,
      "deliveryLeadTime": "2-3 business days"
    },
    "status": "active",
    "description": "Primary office supplies vendor"
  }')

echo $VENDOR_RESPONSE | jq .

# Extract the vendor ID from the response
VENDOR_ID=$(echo $VENDOR_RESPONSE | jq -r '.id // empty')

if [ -n "$VENDOR_ID" ] && [ "$VENDOR_ID" != "null" ]; then
  echo -e "${GREEN}Successfully created vendor with ID: ${VENDOR_ID}${NC}"
  
  # Test getting all vendors
  echo -e "\n${BLUE}Testing Get All Vendors...${NC}"
  ALL_VENDORS=$(curl -s -X GET "${API_URL}/vendors")
  echo "$ALL_VENDORS" | jq .
  
  # Count the vendors
  VENDOR_COUNT=$(echo "$ALL_VENDORS" | jq '. | length')
  echo -e "${GREEN}Found ${VENDOR_COUNT} vendors${NC}"
  
  # Test getting a specific vendor
  echo -e "\n${BLUE}Testing Get Vendor by ID...${NC}"
  SINGLE_VENDOR=$(curl -s -X GET "${API_URL}/vendors/${VENDOR_ID}")
  echo "$SINGLE_VENDOR" | jq .
  
  # Test getting active vendors
  echo -e "\n${BLUE}Testing Get Active Vendors...${NC}"
  ACTIVE_VENDORS=$(curl -s -X GET "${API_URL}/vendors?status=active")
  echo "$ACTIVE_VENDORS" | jq .
  
  # Test getting vendors by category
  echo -e "\n${BLUE}Testing Get Vendors by Category...${NC}"
  CATEGORY_VENDORS=$(curl -s -X GET "${API_URL}/vendors?category=Office%20Supplies")
  echo "$CATEGORY_VENDORS" | jq .
  
  # Test updating a vendor (PUT)
  echo -e "\n${BLUE}Testing Update Vendor (PUT)...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/vendors/${VENDOR_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Office Supplies Direct LLC",
      "email": "vendor@officesuppliesdirect.com",
      "phone": "555-987-6543",
      "metadata": {
        "vendorType": "Preferred Supplier",
        "category": "Office Supplies",
        "paymentTerms": "Net 45",
        "preferredPaymentMethod": "ACH",
        "accountNumber": "ACC-12345",
        "discountRate": 0.05,
        "annualSpend": 50000,
        "performanceRating": 4.8,
        "certifications": ["ISO 9001", "Green Business Certified"],
        "contractEndDate": "2026-12-31",
        "minimumOrderAmount": 75,
        "deliveryLeadTime": "1-2 business days",
        "lastAuditDate": "2024-11-15"
      },
      "notes": "Excellent vendor. Renewed contract for 2 years."
    }')
  echo "$UPDATE_RESPONSE" | jq .
  
  # Test partial update (PATCH)
  echo -e "\n${BLUE}Testing Partial Update Vendor (PATCH)...${NC}"
  PATCH_RESPONSE=$(curl -s -X PATCH "${API_URL}/vendors/${VENDOR_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "metadata": {
        "creditLimit": 25000,
        "w9OnFile": true,
        "insuranceCertificateExpiry": "2025-06-30"
      }
    }')
  echo "$PATCH_RESPONSE" | jq .
  
  # Test getting the updated vendor
  echo -e "\n${BLUE}Getting updated vendor...${NC}"
  curl -s -X GET "${API_URL}/vendors/${VENDOR_ID}" | jq .
  
  # Test creating another vendor
  echo -e "\n${BLUE}Creating second vendor for testing...${NC}"
  SECOND_VENDOR_RESPONSE=$(curl -s -X POST "${API_URL}/vendors" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Tech Services Provider",
      "code": "VEND002",
      "email": "support@techservicesprovider.com",
      "phone": "555-789-0123",
      "taxId": "98-7654321",
      "metadata": {
        "vendorType": "Service Provider",
        "category": "IT Services",
        "paymentTerms": "Due on receipt",
        "hourlyRate": 150,
        "serviceTypes": ["Cloud Infrastructure", "Security Consulting", "DevOps"],
        "slaResponseTime": "4 hours"
      },
      "status": "active"
    }')
  
  SECOND_VENDOR_ID=$(echo $SECOND_VENDOR_RESPONSE | jq -r '.id // empty')
  echo -e "${GREEN}Created second vendor with ID: ${SECOND_VENDOR_ID}${NC}"
  
  # Test deactivating a vendor
  echo -e "\n${BLUE}Testing Deactivate Vendor...${NC}"
  DEACTIVATE_RESPONSE=$(curl -s -X PATCH "${API_URL}/vendors/${SECOND_VENDOR_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "inactive",
      "metadata": {
        "deactivationReason": "Contract expired",
        "deactivationDate": "2025-01-03"
      }
    }')
  echo "$DEACTIVATE_RESPONSE" | jq .
  
  # Test vendor performance update
  echo -e "\n${BLUE}Testing Vendor Performance Update...${NC}"
  PERFORMANCE_RESPONSE=$(curl -s -X POST "${API_URL}/vendors/${VENDOR_ID}/performance" \
    -H "Content-Type: application/json" \
    -d '{
      "rating": 4.9,
      "onTimeDeliveryRate": 0.98,
      "qualityScore": 0.95,
      "reviewDate": "2025-01-03",
      "reviewedBy": "Procurement Manager"
    }')
  echo "$PERFORMANCE_RESPONSE" | jq .
  
  # Test deleting a vendor
  echo -e "\n${BLUE}Testing Delete Vendor...${NC}"
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/vendors/${VENDOR_ID}")
  
  if [ "$DELETE_STATUS" -eq 204 ]; then
    echo -e "${GREEN}Successfully deleted vendor with status code: ${DELETE_STATUS}${NC}"
  else
    echo -e "${RED}Failed to delete vendor. Status code: ${DELETE_STATUS}${NC}"
  fi
  
  # Verify the vendor is deleted
  echo -e "\n${BLUE}Verifying vendor is deleted...${NC}"
  NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/vendors/${VENDOR_ID}")
  
  if [ "$NOT_FOUND_STATUS" -eq 404 ]; then
    echo -e "${GREEN}Vendor successfully deleted. Got 404 status as expected.${NC}"
  else
    echo -e "${RED}Vendor might not be properly deleted. Got status: ${NOT_FOUND_STATUS} (expected 404)${NC}"
  fi
  
  # Clean up - delete second vendor
  echo -e "\n${BLUE}Cleaning up test data...${NC}"
  curl -s -X DELETE "${API_URL}/vendors/${SECOND_VENDOR_ID}" > /dev/null
  echo -e "${GREEN}Deleted second vendor${NC}"
  
else
  echo -e "${RED}Failed to create vendor or extract ID from response${NC}"
fi

# Test error cases
echo -e "\n${BLUE}Testing Error Cases...${NC}"

# Test creating vendor without required fields
echo -e "${YELLOW}Testing missing required fields...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "${API_URL}/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@vendor.com"
  }')
echo "$ERROR_RESPONSE" | jq .

# Test duplicate vendor code
echo -e "\n${YELLOW}Testing duplicate vendor code...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "${API_URL}/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Vendor",
    "code": "VEND001",
    "email": "duplicate@vendor.com"
  }')
echo "$DUPLICATE_RESPONSE" | jq .

# Test invalid tax ID format
echo -e "\n${YELLOW}Testing invalid tax ID format...${NC}"
INVALID_TAX_RESPONSE=$(curl -s -X POST "${API_URL}/vendors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Tax ID Vendor",
    "code": "VEND999",
    "email": "tax@vendor.com",
    "taxId": "invalid-tax-id"
  }')
echo "$INVALID_TAX_RESPONSE" | jq .

# Test getting non-existent vendor
echo -e "\n${YELLOW}Testing get non-existent vendor...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET "${API_URL}/vendors/00000000-0000-0000-0000-000000000000")
echo "$NOT_FOUND_RESPONSE" | jq .

echo -e "\n${YELLOW}Vendors API tests completed.${NC}"