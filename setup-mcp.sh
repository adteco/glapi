#!/bin/bash

# MCP Server Setup Script for GLAPI

echo "🚀 Setting up MCP servers for GLAPI..."

# Create MCP config directory if it doesn't exist
CONFIG_DIR="$HOME/Library/Application Support/Claude"
mkdir -p "$CONFIG_DIR"

# Check if claude_desktop_config.json exists
if [ -f "$CONFIG_DIR/claude_desktop_config.json" ]; then
    echo "⚠️  Found existing Claude config. Creating backup..."
    cp "$CONFIG_DIR/claude_desktop_config.json" "$CONFIG_DIR/claude_desktop_config.backup.json"
fi

# Function to prompt for input with a default value
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    read -p "$prompt [$default]: " value
    value=${value:-$default}
    eval "$var_name='$value'"
}

echo ""
echo "📊 PostgreSQL Configuration"
echo "Please provide your PostgreSQL connection details:"
prompt_with_default "Database host" "localhost" DB_HOST
prompt_with_default "Database port" "5432" DB_PORT
prompt_with_default "Database name" "glapi" DB_NAME
prompt_with_default "Database user" "postgres" DB_USER
read -s -p "Database password: " DB_PASSWORD
echo ""

echo ""
echo "🐙 GitHub Configuration"
echo "Create a token at: https://github.com/settings/tokens"
read -p "GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN

echo ""
echo "💬 Slack Configuration (Optional - press Enter to skip)"
echo "Create a bot at: https://api.slack.com/apps"
read -p "Slack Bot Token (xoxb-...): " SLACK_TOKEN
read -p "Slack Team ID: " SLACK_TEAM_ID

# Create the configuration
cat > "$CONFIG_DIR/claude_desktop_config.json" << EOF
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
      ]
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
EOF

# Add Slack config only if token provided
if [ ! -z "$SLACK_TOKEN" ]; then
    cat >> "$CONFIG_DIR/claude_desktop_config.json" << EOF
    ,
    "slack": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-slack"
      ],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
      }
    }
EOF
fi

# Close the JSON
cat >> "$CONFIG_DIR/claude_desktop_config.json" << EOF
  }
}
EOF

echo ""
echo "✅ Configuration created successfully!"
echo "📍 Config location: $CONFIG_DIR/claude_desktop_config.json"
echo ""
echo "⚠️  Important next steps:"
echo "1. Restart Claude Desktop for changes to take effect"
echo "2. Look for new MCP tools in Claude (they start with 'mcp__')"
echo "3. Your credentials are stored locally - keep them secure!"
echo ""
echo "🔒 Security tip: Never commit your MCP config to git"
echo "   Add this to your .gitignore: claude_desktop_config.json"

# Make the script executable
chmod +x "$0"