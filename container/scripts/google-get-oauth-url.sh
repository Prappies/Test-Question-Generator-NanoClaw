#!/bin/bash
# Get Google OAuth URL for user authentication

uvx workspace-mcp --tools slides drive << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_oauth_url", "arguments": {}}}
EOF
