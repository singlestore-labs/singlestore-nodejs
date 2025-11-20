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
declare -A SKIP_REASONS

if [ -f "$SKIP_FILE" ]; then
  current_reason=""
  while IFS= read -r line; do
    line=$(echo "$line" | xargs)
    [ -z "$line" ] && continue
    
    # Check for comment lines (## or single #)
    if [[ "$line" == \#* ]]; then
      # Extract reason from comment (remove leading # and whitespace)
      current_reason=$(echo "$line" | sed 's/^#\+\s*//')
      continue
    fi
    
    # This is a test file path
    SKIP_TESTS["$line"]=1
    SKIP_REASONS["$line"]="$current_reason"
    current_reason=""  # Reset for next test
  done < "$SKIP_FILE"
fi

# Initialize counters and arrays
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
TIMEOUT_TESTS=0
declare -a FAILED_TEST_LIST
declare -a TIMEOUT_TEST_LIST

# Function to run test with timeout
run_test_with_timeout() {
  local test_file="$1"
  local timeout_duration=15
  
  # Start the test in background
  timeout "${timeout_duration}s" node "$test_file" &
  local test_pid=$!
  
  # Wait for the test to complete
  wait $test_pid
  local exit_code=$?
  
  # Check if test timed out (timeout command returns 124)
  if [ $exit_code -eq 124 ]; then
    echo "TIMEOUT: $test_file (exceeded ${timeout_duration} seconds)"
    TIMEOUT_TESTS=$((TIMEOUT_TESTS + 1))
    TIMEOUT_TEST_LIST+=("$test_file")
    return 124
  fi
  
  return $exit_code
}

# Run tests that are not in skip list
while IFS= read -r file; do
  file=$(echo "$file" | xargs)
  [ -z "$file" ] && continue
  
  # Check if test should be skipped
  if [ -n "${SKIP_TESTS[$file]}" ]; then
    echo "Skipping: $file"
    if [ -n "${SKIP_REASONS[$file]}" ]; then
      echo "  Reason: ${SKIP_REASONS[$file]}"
    fi
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    continue
  fi
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo "Running: $file"
  
  # Run test with timeout
  run_test_with_timeout "$file"
  exit_code=$?
  
  # Check result
  if [ $exit_code -eq 124 ]; then
    # Timeout already handled in function
    continue
  elif [ $exit_code -ne 0 ]; then
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
echo "Timed out: $TIMEOUT_TESTS"
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

# Print timed out tests list
if [ ${#TIMEOUT_TEST_LIST[@]} -gt 0 ]; then
  echo ""
  echo "Timed Out Tests (>15 seconds):"
  echo "=========================================="
  for timeout_test in "${TIMEOUT_TEST_LIST[@]}"; do
    echo "$timeout_test"
  done
  echo "=========================================="
fi

echo "=========================================="

# Exit with error if any tests failed or timed out
if [ $FAILED_TESTS -gt 0 ] || [ $TIMEOUT_TESTS -gt 0 ]; then
  exit 1
fi