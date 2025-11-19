#!/bin/bash

# Create test database if it doesn't exist
if [ -n "${MYSQL_PASSWORD}" ]; then
  mysql -h"${MYSQL_HOST:-127.0.0.1}" -P"${MYSQL_PORT:-3306}" -u"${MYSQL_USER:-root}" -p"${MYSQL_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE:-test};"
else
  mysql -h"${MYSQL_HOST:-127.0.0.1}" -P"${MYSQL_PORT:-3306}" -u"${MYSQL_USER:-root}" -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE:-test};"
fi

echo "Generating test file list..."
ALL_TESTS=$(find . -type f \( -name "*.test.cjs" -o -name "*.test.mjs" \) | sort)

# Read tests to skip (if file exists)
SKIP_FILE="test-to-skip.txt"
declare -A SKIP_TESTS

if [ -f "$SKIP_FILE" ]; then
  while IFS= read -r line; do
    line=$(echo "$line" | xargs)
    [ -z "$line" ] && continue
    [[ "$line" == \#* ]] && continue
    SKIP_TESTS["$line"]=1
  done < "$SKIP_FILE"
fi

# Initialize counters and arrays
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
declare -a FAILED_TEST_LIST

# Run tests that are not in skip list
while IFS= read -r file; do
  file=$(echo "$file" | xargs)
  [ -z "$file" ] && continue
  
  # Check if test should be skipped
  if [ -n "${SKIP_TESTS[$file]}" ]; then
    echo "Skipping: $file"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    continue
  fi
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo "Running: $file"
  node "$file"
  
  # Capture exit code
  if [ $? -ne 0 ]; then
    echo "FAILED: $file"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_TEST_LIST+=("$file")
  else
    echo "PASSED: $file"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  fi
done <<< "$ALL_TESTS"

# Print summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo "=========================================="
echo "Total tests run: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Skipped: $SKIPPED_TESTS"

# Print failed tests list
if [ ${#FAILED_TEST_LIST[@]} -gt 0 ]; then
  echo ""
  echo "Failed Tests:"
  echo "=========================================="
  for failed_test in "${FAILED_TEST_LIST[@]}"; do
    echo "$failed_test"
  done
  echo "=========================================="
fi

echo "=========================================="

# Exit with error if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
  exit 1
fi
