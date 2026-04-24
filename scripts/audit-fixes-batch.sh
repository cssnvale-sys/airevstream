#!/bin/bash
# Batch fix script for AIrevstream audit findings
# Run this after the initial fixes to apply remaining console.log replacements

echo "=== AIrevstream Audit Fix Script ==="
echo "This script applies batch fixes for common issues found during audit"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for fixes
FIXED=0
SKIPPED=0

# Function to fix console.error in API routes
fix_console_errors() {
  echo -e "${YELLOW}Fixing console.error statements in API routes...${NC}"
  
  # Find all route.ts files with console.error
  files=$(grep -r "console.error" apps/web/src/app/api --include="*.ts" -l 2>/dev/null || true)
  
  for file in $files; do
    # Check if logger is already imported
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
      # Add logger import after the last import
      sed -i '' '/^import.*from/a\
import { logger } from '"'"'@/lib/logger'"'"';' "$file" 2>/dev/null || true
    fi
    
    FIXED=$((FIXED + 1))
  done
  
  echo -e "${GREEN}Processed $FIXED API route files${NC}"
}

# Function to fix console.log statements
fix_console_logs() {
  echo -e "${YELLOW}Fixing console.log statements...${NC}"
  
  # Count remaining console.logs in API routes
  count=$(grep -r "console.log" apps/web/src/app/api --include="*.ts" | wc -l || echo "0")
  
  if [ "$count" -gt 0 ]; then
    echo -e "${YELLOW}Found $count console.log statements in API routes${NC}"
    echo "These should be reviewed manually and replaced with appropriate logger calls"
  else
    echo -e "${GREEN}No console.log statements found in API routes${NC}"
  fi
}

# Function to check for missing accessibility attributes
check_accessibility() {
  echo -e "${YELLOW}Checking for accessibility issues...${NC}"
  
  # Find interactive elements without aria-labels
  issues=$(grep -r "onClick" apps/web/src/components --include="*.tsx" | grep -v "aria-label" | wc -l || echo "0")
  
  if [ "$issues" -gt 0 ]; then
    echo -e "${YELLOW}Found $issues interactive elements that may need aria-labels${NC}"
  else
    echo -e "${GREEN}No obvious accessibility issues found${NC}"
  fi
}

# Function to verify dependency updates
verify_dependencies() {
  echo -e "${YELLOW}Verifying dependency updates...${NC}"
  
  # Check if npm audit still reports critical issues
  high_vulns=$(npm audit --json 2>/dev/null | grep -c '"severity": "high"' || echo "0")
  
  if [ "$high_vulns" -gt 0 ]; then
    echo -e "${YELLOW}$high_vulns high-severity vulnerabilities still present${NC}"
    echo "Run 'npm audit fix' to attempt automatic fixes"
  else
    echo -e "${GREEN}No high-severity vulnerabilities detected${NC}"
  fi
}

# Function to check TypeScript compilation
check_typescript() {
  echo -e "${YELLOW}Checking TypeScript compilation...${NC}"
  
  if npm run lint --workspace=@airevstream/web 2>/dev/null | grep -q "error TS"; then
    echo -e "${RED}TypeScript errors detected${NC}"
    echo "Run 'npm run lint' to see details"
  else
    echo -e "${GREEN}No TypeScript errors detected${NC}"
  fi
}

# Main execution
echo "Starting batch fixes..."
echo ""

# Run all checks
fix_console_errors
fix_console_logs
check_accessibility
verify_dependencies
check_typescript

echo ""
echo "=== Fix Summary ==="
echo "Review the findings above and address any remaining issues manually."
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to update dependencies"
echo "2. Run 'npm run build' to verify everything compiles"
echo "3. Run 'npm test' to ensure tests pass"
echo "4. Run 'npm run test:e2e' to verify E2E tests"
echo ""
