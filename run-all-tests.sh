#!/bin/bash

# Create test database if it doesn't exist
if [ -n "${MYSQL_PASSWORD}" ]; then
  mysql -h"${MYSQL_HOST:-127.0.0.1}" -P"${MYSQL_PORT:-3306}" -u"${MYSQL_USER:-root}" -p"${MYSQL_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE:-test};"
else
  mysql -h"${MYSQL_HOST:-127.0.0.1}" -P"${MYSQL_PORT:-3306}" -u"${MYSQL_USER:-root}" -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE:-test};"
fi

START_LINE=1

tail -n +$START_LINE all-test-files.txt | while read -r file; do
  file=$(echo "$file" | xargs)
  [ -z "$file" ] && continue
  [[ "$file" == \#* ]] && continue
  echo "Running: $file"
  npx poku "$file"
done