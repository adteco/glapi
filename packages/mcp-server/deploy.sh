#!/bin/bash

# Deploy script for GLAPI MCP Server
# This script helps set up secrets and deploy to Cloudflare

echo "🚀 Deploying GLAPI MCP Server to Cloudflare Workers..."

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: wrangler.toml not found. Please run this script from the mcp-server directory."
    exit 1
fi

# Function to check if a secret exists
check_secret() {
    wrangler secret list 2>/dev/null | grep -q "$1"
}

echo "📝 Setting up required secrets..."

# Set required secrets if they don't exist
if ! check_secret "CLERK_SECRET_KEY"; then
    echo "Setting CLERK_SECRET_KEY..."
    echo "Please enter your Clerk Secret Key (from .env.local):"
    read -s CLERK_SECRET_KEY
    echo "$CLERK_SECRET_KEY" | wrangler secret put CLERK_SECRET_KEY
fi

if ! check_secret "DATABASE_URL"; then
    echo "Setting DATABASE_URL..."
    echo "Please enter your Database URL:"
    read -s DATABASE_URL
    echo "$DATABASE_URL" | wrangler secret put DATABASE_URL
fi

if ! check_secret "GLAPI_API_URL"; then
    echo "Setting GLAPI_API_URL..."
    echo "Please enter your GLAPI API URL (e.g., http://localhost:3001 or production URL):"
    read GLAPI_API_URL
    echo "$GLAPI_API_URL" | wrangler secret put GLAPI_API_URL
fi

# Optional: Set OpenAI API key if available
echo "Do you want to set OPENAI_API_KEY? (y/n)"
read -n 1 SET_OPENAI
echo
if [ "$SET_OPENAI" = "y" ]; then
    echo "Please enter your OpenAI API Key:"
    read -s OPENAI_API_KEY
    echo "$OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY
fi

echo "✅ Secrets configured!"

# Deploy to development environment first
echo "🔧 Deploying to development environment..."
wrangler deploy --env development

echo "✅ Development deployment complete!"

# Ask if user wants to deploy to production
echo "Do you want to deploy to production? (y/n)"
read -n 1 DEPLOY_PROD
echo
if [ "$DEPLOY_PROD" = "y" ]; then
    echo "🚀 Deploying to production..."
    wrangler deploy --env production
    echo "✅ Production deployment complete!"
fi

echo "🎉 Deployment finished!"
echo ""
echo "Your MCP server is now available at:"
echo "Development: https://glapi-mcp-server-dev.{your-subdomain}.workers.dev"
echo "Production: https://glapi-mcp-server-prod.{your-subdomain}.workers.dev"
echo ""
echo "Next steps:"
echo "1. Update your chat frontend to use the MCP server URL"
echo "2. Configure your AI provider to use the MCP protocol"
echo "3. Test the integration with a simple tool call"