#!/bin/bash

# Fix checkPermission calls in all tool files
for file in src/tools/contacts.ts src/tools/employees.ts src/tools/leads.ts src/tools/prospects.ts src/tools/vendors.ts; do
  echo "Fixing $file..."
  
  # Replace permission checks
  sed -i '' 's/if (!checkPermission(context, '\''read'\'', '\''[^'\'']*'\''))/checkPermission(context, '\''entities:read'\'');/' "$file"
  sed -i '' 's/if (!checkPermission(context, '\''create'\'', '\''[^'\'']*'\''))/checkPermission(context, '\''entities:create'\'');/' "$file"
  sed -i '' 's/if (!checkPermission(context, '\''update'\'', '\''[^'\'']*'\''))/checkPermission(context, '\''entities:update'\'');/' "$file"
  sed -i '' 's/if (!checkPermission(context, '\''delete'\'', '\''[^'\'']*'\''))/checkPermission(context, '\''entities:delete'\'');/' "$file"
  
  # Remove the return statement after permission check
  sed -i '' '/return createToolResponse.*Permission denied.*true);/d' "$file"
  
  # Fix createBackendClient calls
  sed -i '' 's/const client = await createBackendClient(context);/const client = createBackendClient(context.env.GLAPI_API_URL, context);/g' "$file"
  
  # Add try-catch wrapper where needed
  sed -i '' '/checkPermission(context/s/^      /      try {\n        /' "$file"
done

echo "Fixed all tool files"