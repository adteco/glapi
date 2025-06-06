#!/bin/bash

# Test auth context for updated routes
# This script tests that the getServiceContext function properly handles missing organization context

echo "Testing routes with missing authentication..."

# Test GL Accounts (for comparison - this already returns 401)
echo -e "\n1. Testing GL Accounts without auth:"
curl -X GET http://localhost:3001/api/v1/gl/accounts -w "\nHTTP Status: %{http_code}\n"

# Test Classes
echo -e "\n2. Testing Classes without auth:"
curl -X GET http://localhost:3001/api/v1/classes -w "\nHTTP Status: %{http_code}\n"

# Test Departments
echo -e "\n3. Testing Departments without auth:"
curl -X GET http://localhost:3001/api/v1/departments -w "\nHTTP Status: %{http_code}\n"

# Test Locations
echo -e "\n4. Testing Locations without auth:"
curl -X GET http://localhost:3001/api/v1/locations -w "\nHTTP Status: %{http_code}\n"

# Test Subsidiaries
echo -e "\n5. Testing Subsidiaries without auth:"
curl -X GET http://localhost:3001/api/v1/subsidiaries -w "\nHTTP Status: %{http_code}\n"

echo -e "\n\nAll routes should return HTTP 401 (Unauthorized) when no auth is provided."