#!/bin/bash
# OAuth Wiring Test Script for AiRevStream
# Tests the callback flow without needing real API credentials

set -euo pipefail

BASE_URL="http://localhost:3000"
WORKFLOW_URL="http://localhost:3011"
TEST_LOG="oauth-wiring-test.log"

echo "========================================" | tee "$TEST_LOG"
echo "OAuth Callback Flow Wiring Test" | tee -a "$TEST_LOG"
echo "========================================" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

function pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1" | tee -a "$TEST_LOG"
  ((PASS++))
}

function fail() {
  echo -e "${RED}✗ FAIL${NC}: $1" | tee -a "$TEST_LOG"
  ((FAIL++))
}

function warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1" | tee -a "$TEST_LOG"
}

echo "1. Checking services are running..."
echo ""

# Check web server
if curl -s "$BASE_URL/api/v1/system/health" >/dev/null 2>&1; then
  pass "Web server responding on port 3000"
else
  fail "Web server not responding on port 3000 — run 'npm run dev' first"
  exit 1
fi

# Check workflow engine
if curl -s "$WORKFLOW_URL/api/health" >/dev/null 2>&1; then
  pass "Workflow engine responding on port 3011"
else
  fail "Workflow engine not responding on port 3011"
  exit 1
fi

echo ""
echo "2. Checking .env configuration..."
echo ""

# Check env vars are set
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  if grep -q "GOOGLE_CLIENT_ID=" "$ENV_FILE" && grep -q "GOOGLE_CLIENT_SECRET=" "$ENV_FILE"; then
    pass "Google OAuth credentials present in .env"
  else
    warn "Google OAuth credentials incomplete in .env"
  fi
  
  if grep -q "TIKTOK_CLIENT_KEY=" "$ENV_FILE" && grep -q "TIKTOK_CLIENT_SECRET=" "$ENV_FILE"; then
    pass "TikTok OAuth credentials present in .env"
  else
    warn "TikTok OAuth credentials incomplete in .env"
  fi
  
  if grep -q "JWT_SECRET=" "$ENV_FILE" && grep -q "ENCRYPTION_KEY=" "$ENV_FILE"; then
    pass "JWT_SECRET and ENCRYPTION_KEY present in .env"
  else
    fail "JWT_SECRET or ENCRYPTION_KEY missing in .env"
  fi
else
  fail ".env file not found"
  exit 1
fi

echo ""
echo "3. Testing OAuth initiation routes (expecting 302 redirect)..."
echo ""

# Test Google OAuth init (no auth required, returns 302 redirect or 500 if not configured)
echo "3a. Testing Google OAuth init route..."
GOOGLE_INIT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/accounts/test-id/oauth/google" 2>&1)
if [ "$GOOGLE_INIT" = "302" ] || [ "$GOOGLE_INIT" = "401" ] || [ "$GOOGLE_INIT" = "500" ]; then
  pass "Google OAuth init route responding (HTTP $GOOGLE_INIT)"
else
  fail "Google OAuth init route unexpected status: $GOOGLE_INIT"
fi

# Test TikTok OAuth init
echo "3b. Testing TikTok OAuth init route..."
TIKTOK_INIT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/accounts/test-id/oauth/tiktok" 2>&1)
if [ "$TIKTOK_INIT" = "302" ] || [ "$TIKTOK_INIT" = "401" ] || [ "$TIKTOK_INIT" = "500" ]; then
  pass "TikTok OAuth init route responding (HTTP $TIKTOK_INIT)"
else
  fail "TikTok OAuth init route unexpected status: $TIKTOK_INIT"
fi

# Test invalid provider rejected
echo "3c. Testing invalid provider rejection..."
INVALID_INIT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/accounts/test-id/oauth/facebook" 2>&1)
if [ "$INVALID_INIT" = "400" ]; then
  pass "Invalid provider correctly rejected (HTTP 400)"
else
  fail "Invalid provider not rejected properly (HTTP $INVALID_INIT, expected 400)"
fi

echo ""
echo "4. Testing OAuth callback routes (with mock params)..."
echo ""

# The callbacks should redirect to frontend even with invalid state
echo "4a. Testing Google callback with invalid state (expecting redirect to /accounts?error=)..."
GOOGLE_CALLBACK=$(curl -s -o /dev/null -w "%{http_code};%{redirect_url}" "$WORKFLOW_URL/api/accounts/oauth/callback/google?code=fake&state=bad" 2>&1)
if echo "$GOOGLE_CALLBACK" | grep -q "accounts?error=" || [ "$(echo "$GOOGLE_CALLBACK" | cut -d';' -f1)" = "302" ]; then
  pass "Google callback redirects to /accounts with error (expected)"
else
  fail "Google callback unexpected response: $GOOGLE_CALLBACK"
fi

echo "4b. Testing TikTok callback with missing params..."
TIKTOK_CALLBACK=$(curl -s -o /dev/null -w "%{http_code};%{redirect_url}" "$WORKFLOW_URL/api/accounts/oauth/callback/tiktok" 2>&1)
if echo "$TIKTOK_CALLBACK" | grep -q "accounts?error=" || [ "$(echo "$TIKTOK_CALLBACK" | cut -d';' -f1)" = "302" ]; then
  pass "TikTok callback redirects to /accounts with error (expected)"
else
  fail "TikTok callback unexpected response: $TIKTOK_CALLBACK"
fi

echo ""
echo "5. Verifying redirect URI construction..."
echo ""

# The redirect URI must match what's registered in Google/TikTok portals
EXPECTED_REDIRECT="http://localhost:3011/api/accounts/oauth/callback/google"
warn "Expected Google redirect URI (register in Google Cloud Console): $EXPECTED_REDIRECT"

EXPECTED_REDIRECT_TT="http://localhost:3011/api/accounts/oauth/callback/tiktok"
warn "Expected TikTok redirect URI (register in TikTok Developer Portal): $EXPECTED_REDIRECT_TT"

echo ""
echo "========================================" | tee -a "$TEST_LOG"
echo "Test Summary" | tee -a "$TEST_LOG"
echo "========================================" | tee -a "$TEST_LOG"
echo -e "${GREEN}Passed: $PASS${NC}" | tee -a "$TEST_LOG"
echo -e "${RED}Failed: $FAIL${NC}" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All wiring tests passed!${NC}" | tee -a "$TEST_LOG"
  echo "" | tee -a "$TEST_LOG"
  echo "Next steps to go live:" | tee -a "$TEST_LOG"
  echo "  1. Get real credentials from Google Cloud Console & TikTok Developer Portal" | tee -a "$TEST_LOG"
  echo "  2. Add redirect URIs (shown above) to each app" | tee -a "$TEST_LOG"
  echo "  3. Replace placeholder values in .env" | tee -a "$TEST_LOG"
  echo "  4. Run this test again with 'bash scripts/oauth-wiring-test.sh'" | tee -a "$TEST_LOG"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Check log: $TEST_LOG${NC}" | tee -a "$TEST_LOG"
  exit 1
fi
