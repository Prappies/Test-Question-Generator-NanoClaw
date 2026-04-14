#!/bin/bash
# Batch update Google Slides presentation
# Usage: google-batch-update-presentation.sh presentation_id user@example.com requests_json

PRESENTATION_ID="$1"
USER_EMAIL="$2"
REQUESTS="$3"

uvx workspace-mcp --tools slides drive << EOF
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "batch_update_presentation", "arguments": {"presentation_id": "$PRESENTATION_ID", "user_email": "$USER_EMAIL", "requests": $REQUESTS}}}
EOF
