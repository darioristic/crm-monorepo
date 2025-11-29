#!/bin/bash

# CRM Authentication & Security Test Suite
# Full end-to-end testing of auth layer

BASE_URL="http://localhost:3001"
REDIS_CLI="docker exec crm-redis redis-cli"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Test credentials
ADMIN_EMAIL="admin@crm.local"
ADMIN_PASSWORD="changeme123"
USER_EMAIL="sarah.johnson@techcorp.com"
USER_PASSWORD="changeme123"

# Tokens (will be populated during tests)
ADMIN_ACCESS_TOKEN=""
USER_ACCESS_TOKEN=""
ADMIN_USER_ID=""
USER_USER_ID=""

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "${YELLOW}▶ TEST: $1${NC}"
    ((TOTAL++))
}

pass() {
    echo -e "${GREEN}  ✓ PASS: $1${NC}"
    ((PASSED++))
}

fail() {
    echo -e "${RED}  ✗ FAIL: $1${NC}"
    ((FAILED++))
}

# Extract JSON value using jq
get_json_value() {
    echo "$1" | jq -r "$2" 2>/dev/null
}

# Clear rate limits before testing
echo -e "${YELLOW}Clearing rate limits...${NC}"
$REDIS_CLI KEYS "ratelimit:*" 2>/dev/null | while read key; do
    $REDIS_CLI DEL "$key" 2>/dev/null
done
echo -e "${GREEN}Rate limits cleared${NC}"

# ============================================
# SECTION 1: LOGIN TESTS
# ============================================

print_header "1. LOGIN ENDPOINT TESTS"

# Test 1.1: Successful admin login
print_test "Successful admin login with valid credentials"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    -c /tmp/admin_cookies.txt \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$(get_json_value "$BODY" ".success")
    if [ "$SUCCESS" == "true" ]; then
        pass "Admin login returned 200 with success=true"
        ADMIN_USER_ID=$(get_json_value "$BODY" ".data.user.id")
        ADMIN_ROLE=$(get_json_value "$BODY" ".data.user.role")
        echo "  → Admin ID: $ADMIN_USER_ID, Role: $ADMIN_ROLE"
    else
        fail "Admin login returned 200 but success=false"
    fi
else
    fail "Admin login returned HTTP $HTTP_CODE instead of 200"
    echo "  → Response: $BODY"
fi

# Test 1.2: Successful user login
print_test "Successful user login with valid credentials"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$USER_EMAIL\", \"password\": \"$USER_PASSWORD\"}" \
    -c /tmp/user_cookies.txt \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$(get_json_value "$BODY" ".success")
    if [ "$SUCCESS" == "true" ]; then
        pass "User login returned 200 with success=true"
        USER_USER_ID=$(get_json_value "$BODY" ".data.user.id")
        USER_ROLE=$(get_json_value "$BODY" ".data.user.role")
        echo "  → User ID: $USER_USER_ID, Role: $USER_ROLE"
    else
        fail "User login returned 200 but success=false"
    fi
else
    fail "User login returned HTTP $HTTP_CODE instead of 200"
fi

# Test 1.3: Failed login with wrong password
print_test "Failed login with wrong password"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"wrongpassword\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Wrong password returned 401 Unauthorized"
else
    fail "Wrong password returned HTTP $HTTP_CODE instead of 401"
fi

# Test 1.4: Failed login with non-existent email
print_test "Failed login with non-existent email"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "nonexistent@test.com", "password": "anypassword"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Non-existent email returned 401 Unauthorized"
else
    fail "Non-existent email returned HTTP $HTTP_CODE instead of 401"
fi

# Test 1.5: Login with missing fields
print_test "Login with missing email field"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"password": "somepassword"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "400" ]; then
    pass "Missing email returned 400 Bad Request"
else
    fail "Missing email returned HTTP $HTTP_CODE instead of 400"
fi

# Test 1.6: Check Redis session after login
print_test "Verify Redis session exists after login"
SESSION_COUNT=$($REDIS_CLI KEYS "session:*" 2>/dev/null | wc -l)
if [ "$SESSION_COUNT" -gt 0 ]; then
    pass "Redis has $SESSION_COUNT active session(s)"
else
    fail "No Redis sessions found"
fi

# ============================================
# SECTION 2: PROTECTED ROUTES TESTS
# ============================================

print_header "2. PROTECTED ROUTES TESTS"

# Test 2.1: Access protected route with valid JWT (using cookies)
print_test "Access /api/v1/users with valid JWT cookie"
RESPONSE=$(curl -s -b /tmp/admin_cookies.txt "$BASE_URL/api/v1/users" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$(get_json_value "$BODY" ".success")
    if [ "$SUCCESS" == "true" ]; then
        pass "Protected route returned 200 with valid JWT"
    else
        fail "Protected route returned 200 but success=false"
    fi
else
    fail "Protected route returned HTTP $HTTP_CODE instead of 200"
fi

# Test 2.2: Access protected route without JWT
print_test "Access /api/v1/auth/me without JWT"
RESPONSE=$(curl -s "$BASE_URL/api/v1/auth/me" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Protected route returned 401 without JWT"
else
    fail "Protected route returned HTTP $HTTP_CODE instead of 401 (no JWT)"
fi

# Test 2.3: Access protected route with invalid JWT
print_test "Access /api/v1/auth/me with invalid JWT"
RESPONSE=$(curl -s -H "Authorization: Bearer invalid.jwt.token" "$BASE_URL/api/v1/auth/me" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Protected route returned 401 with invalid JWT"
else
    fail "Protected route returned HTTP $HTTP_CODE instead of 401 (invalid JWT)"
fi

# Test 2.4: Access /api/v1/auth/me with valid JWT
print_test "Access /api/v1/auth/me with valid JWT"
RESPONSE=$(curl -s -b /tmp/admin_cookies.txt "$BASE_URL/api/v1/auth/me" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    EMAIL=$(get_json_value "$BODY" ".data.email")
    if [ "$EMAIL" == "$ADMIN_EMAIL" ]; then
        pass "/api/v1/auth/me returned correct user data"
    else
        fail "/api/v1/auth/me returned wrong email: $EMAIL"
    fi
else
    fail "/api/v1/auth/me returned HTTP $HTTP_CODE instead of 200"
fi

# ============================================
# SECTION 3: REFRESH TOKEN TESTS
# ============================================

print_header "3. REFRESH TOKEN FLOW TESTS"

# Test 3.1: Refresh token with valid token
print_test "Refresh token with valid refresh token"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/refresh" \
    -b /tmp/admin_cookies.txt \
    -c /tmp/admin_cookies_refreshed.txt \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$(get_json_value "$BODY" ".success")
    if [ "$SUCCESS" == "true" ]; then
        pass "Token refresh returned 200 with success=true"
        EXPIRES_IN=$(get_json_value "$BODY" ".data.expiresIn")
        echo "  → New token expires in: $EXPIRES_IN seconds"
    else
        fail "Token refresh returned 200 but success=false"
    fi
else
    fail "Token refresh returned HTTP $HTTP_CODE instead of 200"
    echo "  → Response: $BODY"
fi

# Test 3.2: Refresh without token
print_test "Refresh token without providing token"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/refresh" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Refresh without token returned 401"
else
    fail "Refresh without token returned HTTP $HTTP_CODE instead of 401"
fi

# Test 3.3: Refresh with invalid token
print_test "Refresh with invalid refresh token"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/refresh" \
    -H "Content-Type: application/json" \
    -d '{"refreshToken": "invalid-token-12345"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Refresh with invalid token returned 401"
else
    fail "Refresh with invalid token returned HTTP $HTTP_CODE instead of 401"
fi

# ============================================
# SECTION 4: LOGOUT TESTS
# ============================================

print_header "4. LOGOUT TESTS"

# Fresh login for logout test
curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    -c /tmp/logout_test_cookies.txt > /dev/null

# Test 4.1: Logout returns success
print_test "Logout returns success"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
    -b /tmp/logout_test_cookies.txt \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$(get_json_value "$BODY" ".success")
    if [ "$SUCCESS" == "true" ]; then
        pass "Logout returned 200 with success=true"
    else
        fail "Logout returned 200 but success=false"
    fi
else
    fail "Logout returned HTTP $HTTP_CODE instead of 200"
fi

# Test 4.2: Protected route fails after logout
print_test "Protected route fails after logout"
RESPONSE=$(curl -s -b /tmp/logout_test_cookies.txt "$BASE_URL/api/v1/auth/me" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "401" ]; then
    pass "Protected route returned 401 after logout"
else
    fail "Protected route returned HTTP $HTTP_CODE instead of 401 after logout"
fi

# ============================================
# SECTION 5: RBAC TESTS
# ============================================

print_header "5. RBAC (Role-Based Access Control) TESTS"

# Refresh sessions for RBAC tests
curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    -c /tmp/admin_cookies.txt > /dev/null

curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$USER_EMAIL\", \"password\": \"$USER_PASSWORD\"}" \
    -c /tmp/user_cookies.txt > /dev/null

# Get a company ID for testing
COMPANY_RESPONSE=$(curl -s -b /tmp/admin_cookies.txt "$BASE_URL/api/v1/companies")
FIRST_COMPANY_ID=$(get_json_value "$COMPANY_RESPONSE" ".data[0].id")
echo "  → Using Company ID for tests: $FIRST_COMPANY_ID"

# Test 5.1: Admin can create company
print_test "Admin can CREATE company"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/companies" \
    -b /tmp/admin_cookies.txt \
    -H "Content-Type: application/json" \
    -d '{"name": "RBAC Test Company", "industry": "Technology", "address": "Test Address"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
    pass "Admin CREATE company returned 201"
    TEST_COMPANY_ID=$(get_json_value "$BODY" ".data.id")
    echo "  → Created company ID: $TEST_COMPANY_ID"
else
    fail "Admin CREATE company returned HTTP $HTTP_CODE instead of 201"
    TEST_COMPANY_ID=""
fi

# Test 5.2: Admin can delete company
print_test "Admin can DELETE company"
if [ -n "$TEST_COMPANY_ID" ] && [ "$TEST_COMPANY_ID" != "null" ]; then
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/companies/$TEST_COMPANY_ID" \
        -b /tmp/admin_cookies.txt \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        pass "Admin DELETE company returned 200"
    else
        fail "Admin DELETE company returned HTTP $HTTP_CODE instead of 200"
    fi
else
    fail "Could not test - no company ID available"
fi

# Create another company for user delete test
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/companies" \
    -b /tmp/admin_cookies.txt \
    -H "Content-Type: application/json" \
    -d '{"name": "RBAC User Test Company", "industry": "Finance", "address": "User Test Address"}')
TEST_COMPANY_ID2=$(get_json_value "$CREATE_RESPONSE" ".data.id")

# Test 5.3: User CANNOT delete company (403)
print_test "User CANNOT DELETE company (should return 403)"
if [ -n "$TEST_COMPANY_ID2" ] && [ "$TEST_COMPANY_ID2" != "null" ]; then
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/companies/$TEST_COMPANY_ID2" \
        -b /tmp/user_cookies.txt \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "403" ]; then
        pass "User DELETE company returned 403 Forbidden"
    else
        fail "User DELETE company returned HTTP $HTTP_CODE instead of 403"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/v1/companies/$TEST_COMPANY_ID2" -b /tmp/admin_cookies.txt > /dev/null
else
    fail "Could not create test company for user delete test"
fi

# Create test user for delete tests
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/users" \
    -b /tmp/admin_cookies.txt \
    -H "Content-Type: application/json" \
    -d '{"firstName": "Test", "lastName": "RBACUser", "email": "test.rbac.user@test.com", "role": "user"}')
TEST_USER_ID=$(get_json_value "$CREATE_USER_RESPONSE" ".data.id")

# Test 5.4: User CANNOT delete users (403)
print_test "User CANNOT DELETE users (should return 403)"
if [ -n "$TEST_USER_ID" ] && [ "$TEST_USER_ID" != "null" ]; then
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/users/$TEST_USER_ID" \
        -b /tmp/user_cookies.txt \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "403" ]; then
        pass "User DELETE users returned 403 Forbidden"
    else
        fail "User DELETE users returned HTTP $HTTP_CODE instead of 403"
    fi
else
    fail "Could not create test user"
fi

# Test 5.5: Admin can delete users
print_test "Admin can DELETE users"
if [ -n "$TEST_USER_ID" ] && [ "$TEST_USER_ID" != "null" ]; then
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/users/$TEST_USER_ID" \
        -b /tmp/admin_cookies.txt \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        pass "Admin DELETE users returned 200"
    else
        fail "Admin DELETE users returned HTTP $HTTP_CODE instead of 200"
    fi
else
    fail "Could not test - no user ID available"
fi

# Test 5.6: User can access their own data
print_test "User can GET their own user data"
# Get user's own ID from /auth/me
ME_RESPONSE=$(curl -s -b /tmp/user_cookies.txt "$BASE_URL/api/v1/auth/me")
CURRENT_USER_ID=$(get_json_value "$ME_RESPONSE" ".data.id")

if [ -n "$CURRENT_USER_ID" ] && [ "$CURRENT_USER_ID" != "null" ]; then
    RESPONSE=$(curl -s -b /tmp/user_cookies.txt "$BASE_URL/api/v1/users/$CURRENT_USER_ID" \
        -w "\n%{http_code}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        pass "User can access their own user data"
    else
        fail "User cannot access their own user data (HTTP $HTTP_CODE)"
    fi
else
    fail "Could not get current user ID"
fi

# Test 5.7: User can list projects
print_test "User can list projects"
RESPONSE=$(curl -s -b /tmp/user_cookies.txt "$BASE_URL/api/v1/projects" \
    -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    pass "User can list projects"
else
    fail "User cannot list projects (HTTP $HTTP_CODE)"
fi

# ============================================
# SECTION 6: RATE LIMITING TESTS
# ============================================

print_header "6. RATE LIMITING TESTS"

# Clear rate limits first
$REDIS_CLI KEYS "ratelimit:*" 2>/dev/null | while read key; do
    $REDIS_CLI DEL "$key" 2>/dev/null
done

sleep 1

# Test 6.1: Login rate limiting (5 requests per minute)
print_test "Login rate limit: 6th request should be blocked"

RATE_LIMITED=false
for i in {1..6}; do
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email": "ratelimit.unique.test@test.com", "password": "wrongpassword"}' \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "429" ]; then
        if [ $i -le 5 ]; then
            echo "  → Attempt $i: Rate limited (HTTP 429) - earlier than expected"
        else
            RATE_LIMITED=true
            pass "Request #$i returned 429 (rate limited)"
        fi
        break
    else
        echo "  → Attempt $i: HTTP $HTTP_CODE"
    fi
done

if [ "$RATE_LIMITED" != "true" ]; then
    fail "Rate limiting did not trigger after 6 attempts"
fi

# ============================================
# SUMMARY
# ============================================

print_header "TEST SUMMARY"

echo ""
echo -e "Total Tests: ${YELLOW}$TOTAL${NC}"
echo -e "Passed:      ${GREEN}$PASSED${NC}"
echo -e "Failed:      ${RED}$FAILED${NC}"
echo ""

PASS_RATE=$((PASSED * 100 / TOTAL))
echo -e "Pass Rate:   ${YELLOW}${PASS_RATE}%${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ALL TESTS PASSED! ✓${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  $PASSED/$TOTAL TESTS PASSED${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    exit 1
fi
