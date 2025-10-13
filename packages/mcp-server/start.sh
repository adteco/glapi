#!/bin/bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Switch to Node v20
nvm use 20

# Start the MCP server
echo "Starting MCP server with Node $(node --version)..."
npx wrangler dev --local --port 8787