#!/bin/bash

# BaseQL MCP Server Installation Script

echo "BaseQL MCP Server Installation"
echo "=============================="
echo

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building the project..."
npm run build

# Create executable
echo "Setting up executable..."
chmod +x dist/index.js

# Get the absolute path
INSTALL_PATH=$(pwd)

echo
echo "✅ Installation complete!"
echo
echo "To use the BaseQL MCP server:"
echo
echo "1. Set up your environment variables:"
echo "   export BASEQL_API_ENDPOINT='your-baseql-endpoint'"
echo "   export BASEQL_API_KEY='your-baseql-api-key'"
echo
echo "   Or create a .env file with:"
echo "   BASEQL_API_ENDPOINT=https://api.baseql.com/airtable/graphql/YOUR_APP_ID"
echo "   BASEQL_API_KEY=Bearer YOUR_API_KEY"
echo
echo "2. Add to your MCP client configuration:"
echo
cat << EOF
{
  "mcpServers": {
    "baseql": {
      "command": "node",
      "args": ["$INSTALL_PATH/dist/index.js"],
      "env": {
        "BASEQL_API_ENDPOINT": "your-endpoint",
        "BASEQL_API_KEY": "your-api-key"
      }
    }
  }
}
EOF
echo
echo "Installation path: $INSTALL_PATH"