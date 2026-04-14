#!/bin/bash
# Start ngrok tunnel for OAuth callback server

echo "Starting ngrok tunnel on port 3737..."
ngrok http 3737 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get the public URL
echo "Waiting for ngrok to initialize..."
sleep 3

# Get the public URL from ngrok API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[a-zA-Z0-9-]*\.ngrok-free\.app' | head -1)

if [ -z "$NGROK_URL" ]; then
  echo "Error: Could not get ngrok URL"
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

CALLBACK_URL="${NGROK_URL}/oauth/callback"

echo ""
echo "✅ ngrok tunnel established!"
echo "Public URL: $NGROK_URL"
echo "OAuth Callback: $CALLBACK_URL"
echo ""
echo "Add this to your .env file:"
echo "OAUTH_CALLBACK_URL=\"$CALLBACK_URL\""
echo ""
echo "Or export it now:"
echo "export OAUTH_CALLBACK_URL=\"$CALLBACK_URL\""
echo ""
echo "Press Ctrl+C to stop ngrok"

# Keep script running
wait $NGROK_PID
