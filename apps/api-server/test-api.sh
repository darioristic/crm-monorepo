#!/bin/bash

# CRM API Test Script
# Run this after starting Docker and the API server

BASE_URL="http://localhost:3001"
COMPANY_ID=""
USER_ID=""

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           CRM API Endpoint Tests                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Health Check
echo "🏥 Health Check..."
curl -s "$BASE_URL/health" | jq .
echo ""

# ============================================
# COMPANIES TESTS
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 COMPANIES ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# List Companies
echo ""
echo "📋 GET /api/v1/companies"
curl -s "$BASE_URL/api/v1/companies" | jq .
echo ""

# Get Industries
echo "🏭 GET /api/v1/companies/industries"
curl -s "$BASE_URL/api/v1/companies/industries" | jq .
echo ""

# Create Company
echo "➕ POST /api/v1/companies (Create)"
COMPANY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/companies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "industry": "Technology",
    "address": "123 Test Street, Test City"
  }')
echo "$COMPANY_RESPONSE" | jq .
COMPANY_ID=$(echo "$COMPANY_RESPONSE" | jq -r '.data.id // empty')
echo ""

if [ -n "$COMPANY_ID" ]; then
  # Get Company by ID
  echo "🔍 GET /api/v1/companies/$COMPANY_ID"
  curl -s "$BASE_URL/api/v1/companies/$COMPANY_ID" | jq .
  echo ""

  # Update Company
  echo "✏️  PUT /api/v1/companies/$COMPANY_ID (Update)"
  curl -s -X PUT "$BASE_URL/api/v1/companies/$COMPANY_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Updated Test Company",
      "industry": "Software"
    }' | jq .
  echo ""

  # Delete Company (commented to preserve for user tests)
  # echo "🗑️  DELETE /api/v1/companies/$COMPANY_ID"
  # curl -s -X DELETE "$BASE_URL/api/v1/companies/$COMPANY_ID" | jq .
fi

# Validation Test
echo "⚠️  POST /api/v1/companies (Validation - Missing Fields)"
curl -s -X POST "$BASE_URL/api/v1/companies" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}' | jq .
echo ""

# ============================================
# USERS TESTS
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👥 USERS ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# List Users
echo ""
echo "📋 GET /api/v1/users"
curl -s "$BASE_URL/api/v1/users" | jq .
echo ""

# Create User
echo "➕ POST /api/v1/users (Create)"
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"email\": \"test.user.$(date +%s)@example.com\",
    \"role\": \"user\"$([ -n "$COMPANY_ID" ] && echo ",\"companyId\": \"$COMPANY_ID\"")
  }")
echo "$USER_RESPONSE" | jq .
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.data.id // empty')
echo ""

if [ -n "$USER_ID" ]; then
  # Get User by ID
  echo "🔍 GET /api/v1/users/$USER_ID"
  curl -s "$BASE_URL/api/v1/users/$USER_ID" | jq .
  echo ""

  # Update User
  echo "✏️  PUT /api/v1/users/$USER_ID (Update)"
  curl -s -X PUT "$BASE_URL/api/v1/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Updated",
      "lastName": "TestUser",
      "role": "admin"
    }' | jq .
  echo ""

  # Delete User (commented to preserve for user tests)
  # echo "🗑️  DELETE /api/v1/users/$USER_ID"
  # curl -s -X DELETE "$BASE_URL/api/v1/users/$USER_ID" | jq .
fi

# Validation Test - Missing Fields
echo "⚠️  POST /api/v1/users (Validation - Missing Fields)"
curl -s -X POST "$BASE_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo ""

# Validation Test - Invalid Email
echo "⚠️  POST /api/v1/users (Validation - Invalid Email)"
curl -s -X POST "$BASE_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "invalid-email",
    "role": "user"
  }' | jq .
echo ""

# Validation Test - Duplicate Email
echo "⚠️  POST /api/v1/users (Validation - Duplicate Email)"
curl -s -X POST "$BASE_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Another",
    "lastName": "User",
    "email": "admin@crm.local",
    "role": "user"
  }' | jq .
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

