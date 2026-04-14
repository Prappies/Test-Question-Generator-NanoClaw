#!/bin/bash
# Create a new Google Slides presentation
# Usage: google-create-presentation.sh "Presentation Title" user@example.com

TITLE="$1"
USER_EMAIL="$2"

uvx workspace-mcp --tools slides drive << EOF
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "create_presentation", "arguments": {"title": "$TITLE", "user_email": "$USER_EMAIL"}}}
EOF
