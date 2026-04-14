/**
 * Google OAuth Helper for Quiz Generator
 * Handles OAuth flow and token storage per Discord user
 */

import { readEnvFile } from './env.js';
import http from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { logger } from './logger.js';

interface UserTokens {
  email: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

const TOKENS_DIR = path.join(process.cwd(), 'data', 'google-oauth-tokens');

// Ensure tokens directory exists
if (!existsSync(TOKENS_DIR)) {
  mkdirSync(TOKENS_DIR, { recursive: true });
}

/**
 * Get OAuth URL for user to authorize
 */
export function getOAuthUrl(userId: string): string {
  const envVars = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID']);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || envVars.GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
  }

  const redirectUri = getPublicCallbackUrl();
  const scope = [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', userId);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return authUrl.toString();
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{ email: string; tokens: any }> {
  const envVars = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || envVars.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || envVars.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const redirectUri = getPublicCallbackUrl();

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await tokenResponse.json() as any;

  // Get user email
  const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoResponse.ok) {
    throw new Error('Failed to get user info');
  }

  const userinfo = await userinfoResponse.json() as any;

  return {
    email: userinfo.email,
    tokens,
  };
}

/**
 * Store tokens for a user
 */
export function storeUserTokens(userId: string, email: string, tokens: any): void {
  const tokenPath = path.join(TOKENS_DIR, `${userId}.json`);
  const data: UserTokens = {
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
  };
  writeFileSync(tokenPath, JSON.stringify(data, null, 2));
  logger.info({ userId, email }, 'Stored Google OAuth tokens');
}

/**
 * Get user's email if they're authenticated
 */
export function getUserEmail(userId: string): string | null {
  const tokenPath = path.join(TOKENS_DIR, `${userId}.json`);
  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    const data: UserTokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));
    return data.email;
  } catch (err) {
    logger.error({ userId, err }, 'Failed to read user tokens');
    return null;
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(userId: string): Promise<boolean> {
  const tokenPath = path.join(TOKENS_DIR, `${userId}.json`);
  if (!existsSync(tokenPath)) {
    return false;
  }

  try {
    const data: UserTokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));

    if (!data.refresh_token) {
      logger.error({ userId }, 'No refresh token available');
      return false;
    }

    const envVars = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || envVars.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || envVars.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ userId, error }, 'Failed to refresh token');
      return false;
    }

    const tokens = await response.json() as any;

    // Update the access token
    data.access_token = tokens.access_token;
    if (tokens.expires_in) {
      data.expires_at = Date.now() + tokens.expires_in * 1000;
    }

    writeFileSync(tokenPath, JSON.stringify(data, null, 2));
    logger.info({ userId }, 'Refreshed access token');
    return true;
  } catch (err) {
    logger.error({ userId, err }, 'Error refreshing token');
    return false;
  }
}

/**
 * Get user's access token (with automatic refresh if needed)
 */
export async function getAccessToken(userId: string): Promise<string | null> {
  const tokenPath = path.join(TOKENS_DIR, `${userId}.json`);
  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    const data: UserTokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));

    // Check if token is expired (with 5 minute buffer)
    if (data.expires_at && data.expires_at < Date.now() + 5 * 60 * 1000) {
      logger.info({ userId }, 'Access token expired, refreshing...');
      const refreshed = await refreshAccessToken(userId);
      if (!refreshed) {
        return null;
      }
      // Re-read the tokens after refresh
      const newData: UserTokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));
      return newData.access_token;
    }

    return data.access_token;
  } catch (err) {
    logger.error({ userId, err }, 'Failed to get access token');
    return null;
  }
}

/**
 * Start OAuth callback server
 */
let callbackServer: http.Server | null = null;
let publicCallbackUrl: string | null = null;
const pendingAuths = new Map<string, (result: { email: string; error?: string }) => void>();

export function setPublicCallbackUrl(url: string): void {
  publicCallbackUrl = url;
  logger.info({ url }, 'Public OAuth callback URL set');
}

export function getPublicCallbackUrl(): string {
  return publicCallbackUrl || 'http://localhost:3737/oauth/callback';
}

export function startOAuthCallbackServer(): void {
  if (callbackServer) {
    return; // Already running
  }

  callbackServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', 'http://localhost:3737');

    if (url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // This is the userId
      const error = url.searchParams.get('error');

      if (error || !code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication failed</h1><p>You can close this window.</p>');

        if (state && pendingAuths.has(state)) {
          pendingAuths.get(state)!({ email: '', error: error || 'Missing code' });
          pendingAuths.delete(state);
        }
        return;
      }

      try {
        const { email, tokens } = await exchangeCodeForTokens(code);
        storeUserTokens(state, email, tokens);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>✅ Authentication successful!</h1>
          <p>Logged in as <strong>${email}</strong></p>
          <p>You can close this window and return to Discord.</p>
        `);

        if (pendingAuths.has(state)) {
          pendingAuths.get(state)!({ email });
          pendingAuths.delete(state);
        }

        logger.info({ userId: state, email }, 'OAuth authentication completed');
      } catch (err) {
        logger.error({ err }, 'OAuth callback error');
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication failed</h1><p>Please try again.</p>');

        if (state && pendingAuths.has(state)) {
          pendingAuths.get(state)!({ email: '', error: String(err) });
          pendingAuths.delete(state);
        }
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  callbackServer.listen(3737, () => {
    logger.info('Google OAuth callback server listening on http://localhost:3737');
  });
}

/**
 * Wait for OAuth to complete for a user
 */
export function waitForOAuth(userId: string, timeoutMs = 300000): Promise<{ email: string; error?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingAuths.delete(userId);
      resolve({ email: '', error: 'Timeout' });
    }, timeoutMs);

    pendingAuths.set(userId, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
}

/**
 * Stop OAuth callback server
 */
export function stopOAuthCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
    logger.info('Google OAuth callback server stopped');
  }
}
