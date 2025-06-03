# MCP Server Setup Guide for GLAPI

This guide will help you set up PostgreSQL, GitHub, and Slack MCP servers for your GLAPI project.

## Prerequisites

1. Node.js installed (you already have this)
2. PostgreSQL database credentials
3. GitHub personal access token
4. Slack workspace with bot token

## 1. Install MCP Servers

First, install the MCP servers globally:

```bash
# PostgreSQL MCP Server
npm install -g @modelcontextprotocol/server-postgres

# GitHub MCP Server  
npm install -g @modelcontextprotocol/server-github

# Slack MCP Server
npm install -g @modelcontextprotocol/server-slack
```

## 2. Create MCP Configuration

Create a `.mcp/config.json` file in your home directory:

```bash
mkdir -p ~/.mcp
```

## 3. PostgreSQL MCP Configuration

You'll need your database connection string. Based on your project, it should look like:
- Host: localhost (or your database host)
- Port: 5432
- Database: glapi (or your database name)
- User: your_db_user
- Password: your_db_password

## 4. GitHub MCP Configuration

Create a GitHub personal access token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token (classic)
3. Select scopes: repo, read:org, read:user
4. Copy the token

## 5. Slack MCP Configuration

Create a Slack bot:
1. Go to https://api.slack.com/apps
2. Create New App > From scratch
3. Add OAuth scopes: chat:write, channels:read, users:read
4. Install to workspace
5. Copy the Bot User OAuth Token

## Example Configuration Structure

Your `~/.mcp/config.json` should look like:

```json
{
  "servers": {
    "postgres": {
      "command": "mcp-postgres",
      "args": ["--connection-string", "postgresql://user:password@localhost:5432/glapi"]
    },
    "github": {
      "command": "mcp-github",
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    },
    "slack": {
      "command": "mcp-slack",
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

## Testing Your Setup

After configuration, restart Claude and you should see new tools available:
- `mcp__postgres__query` - Run SQL queries
- `mcp__github__create_issue` - Create GitHub issues
- `mcp__slack__send_message` - Send Slack messages
- And many more...

## Security Notes

1. Never commit your MCP config to version control
2. Use environment variables for sensitive data when possible
3. Regularly rotate your tokens
4. Limit token permissions to what's needed