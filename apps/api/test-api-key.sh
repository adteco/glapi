#!/bin/bash

# Test script for API key authentication

API_URL="http://localhost:3001"
API_KEY="glapi_test_sk_1234567890abcdef"

echo "Testing API key authentication..."
echo "================================"

# Test 1: Request with valid API key
echo -e "\n1. Testing with valid API key:"
curl -X GET "$API_URL/api/v1/customers" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 2: Request without API key (should use Clerk fallback)
echo -e "\n\n2. Testing without API key (Clerk fallback):"
curl -X GET "$API_URL/api/v1/customers" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 3: Request with invalid API key
echo -e "\n\n3. Testing with invalid API key:"
curl -X GET "$API_URL/api/v1/customers" \
  -H "X-API-Key: invalid_key_12345" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 4: Test creating a customer with API key
echo -e "\n\n4. Testing POST with API key:"
curl -X POST "$API_URL/api/v1/customers" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Customer via API Key",
    "contactEmail": "api-test@example.com",
    "contactPhone": "555-0123"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n\nAPI key authentication tests completed!"