# Temporary script to run all tests listed in all-test-files.txt
#!/bin/bash

START_LINE=101


tail -n +$START_LINE all-test-files.txt | while read -r file; do
  file=$(echo "$file" | xargs)
  [ -z "$file" ] && continue
  [[ "$file" == \#* ]] && continue
  echo "Running: $file"
  npx poku "$file"
done