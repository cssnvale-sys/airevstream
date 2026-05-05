import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { getDb } from '@airevstream/db';
import { encrypt } from '@airevstream/crypto';
import { getConfig, createLogger } from '@airevstream/shared';
import { jwtVerify, SignJWT } from 'jose';
import * as https from 'https';
import '../plugins/auth.js';
import { resolveTenantId } from '../lib/tenant.js';

const logger = createLogger('routes:oauth');

// ============================================================================
// Helpers
// ============================================================================

function getRedirectUri(platform: 'google' | 'tiktok', request: FastifyRequest): string {
  // Use the workflow engine's own URL for callbacks so Google/TikTok redirect back here
  const proto = request.headers['x-forwarded-proto'] ?? 'http';
  const host = request.headers['x-forwarded-host'] ?? request.headers.host ?? 'localhost:3011';
  return `${proto}://${host}/api/accounts/oauth/callback/${platform}`;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

async function buildState(params: Record<string, string>, secret: string): Promise<string> {
  return new SignJWT(params)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
}

async function verifyState(state: string, secret: string): Promise<Record<string, string> | null> {
  try {
    const { payload } = await jwtVerify(
      state,
      new TextEncoder().encode(secret),
      { clockTolerance: 60, maxTokenAge: '10m' },
    );
    return payload as unknown as Record<string, string>;
  } catch {
    return null;
  }
}

function postJson(url: string, body: Record<string, string>): Promise<{ data: unknown; statusCode: number; statusMessage: string }> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(body).toString();
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({ data, statusCode: res.statusCode ?? 0, statusMessage: res.statusMessage ?? '' });
          } catch {
            resolve({ data: raw, statusCode: res.statusCode ?? 0, statusMessage: res.statusMessage ?? '' });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(url: string): Promise<{ data: unknown; statusCode: number; statusMessage: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({ data, statusCode: res.statusCode ?? 0, statusMessage: res.statusMessage ?? '' });
          } catch {
            resolve({ data: raw, statusCode: res.statusCode ?? 0, statusMessage: res.statusMessage ?? '' });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function redirect(path: string, message?: string): { redirect: string } {
  const base = getApiBaseUrl();
  return {
    redirect: `${base}${path}${message ? `&message=${encodeURIComponent(message)}` : ''}`,
  };
}

// ============================================================================
// Routes
// ============================================================================

export async function oauthRoutes(app: FastifyInstance) {

  // ---------------------------------------------------------------------------
  // Google OAuth Init
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/:id/google', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id: emailAccountId } = request.params;
    const config = getConfig();
    const db = getDb();

    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;

      const account = await db.emailAccount.findFirst({
        where: { id: emailAccountId, tenantId },
      });
      if (!account) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Email account not found' } });
      }

      if (!config.GOOGLE_CLIENT_ID || !config.JWT_SECRET) {
        return reply.status(500).send({ success: false, error: { code: 'CONFIG_ERROR', message: 'GOOGLE_CLIENT_ID or JWT_SECRET not configured' } });
      }

      const state = await buildState({ emailAccountId, platform: 'youtube' }, config.JWT_SECRET);
      const scopes = [
        'https://www.googleapis.com/auth/youtube.force-ssl',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ];
      const redirectUri = getRedirectUri('google', request);

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.append('client_id', config.GOOGLE_CLIENT_ID);
      url.searchParams.append('redirect_uri', redirectUri);
      url.searchParams.append('response_type', 'code');
      url.searchParams.append('scope', scopes.join(' '));
      url.searchParams.append('access_type', 'offline');
      url.searchParams.append('prompt', 'consent');
      url.searchParams.append('state', state);

      return reply.redirect(url.toString(), 302);
    } catch (err) {
      logger.error({ err, emailAccountId }, 'OAuth init (google) failed');
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'OAuth initiation failed' } });
    }
  });

  // ---------------------------------------------------------------------------
  // TikTok OAuth Init
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/:id/tiktok', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id: emailAccountId } = request.params;
    const config = getConfig();
    const db = getDb();

    try {
      const tenantId = await resolveTenantId(request, reply);
      if (!tenantId) return;

      const account = await db.emailAccount.findFirst({
        where: { id: emailAccountId, tenantId },
      });
      if (!account) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Email account not found' } });
      }

      if (!config.TIKTOK_CLIENT_KEY || !config.JWT_SECRET) {
        return reply.status(500).send({ success: false, error: { code: 'CONFIG_ERROR', message: 'TIKTOK_CLIENT_KEY or JWT_SECRET not configured' } });
      }

      const state = await buildState({ emailAccountId, platform: 'tiktok' }, config.JWT_SECRET);
      const scopes = [
        'user.info.basic',
        'user.info.profile',
        'video.publish',
        'video.upload',
      ];
      const redirectUri = getRedirectUri('tiktok', request);

      const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
      url.searchParams.append('client_key', config.TIKTOK_CLIENT_KEY);
      url.searchParams.append('redirect_uri', redirectUri);
      url.searchParams.append('scope', scopes.join(','));
      url.searchParams.append('response_type', 'code');
      url.searchParams.append('state', state);

      return reply.redirect(url.toString(), 302);
    } catch (err) {
      logger.error({ err, emailAccountId }, 'OAuth init (tiktok) failed');
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'OAuth initiation failed' } });
    }
  });

  // ---------------------------------------------------------------------------
  // Google OAuth Callback (NO auth — external redirect)
  // ---------------------------------------------------------------------------
  app.get('/callback/google', async (request, reply) => {
    const { code, state, error: oauthError } = request.query as Record<string, string>;
    const config = getConfig();

    if (oauthError) {
      logger.error({ error: oauthError }, 'Google OAuth callback returned error');
      return reply.redirect(redirect('/accounts?error=oauth_denied', oauthError).redirect);
    }

    if (!code || !state) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Missing code or state').redirect);
    }

    if (!config.JWT_SECRET) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'JWT_SECRET not configured').redirect);
    }

    const stateData = await verifyState(state, config.JWT_SECRET);
    if (!stateData) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Invalid or expired state').redirect);
    }

    const { emailAccountId, platform } = stateData;
    if (!emailAccountId || platform !== 'youtube') {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Bad state payload').redirect);
    }

    try {
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
        return reply.redirect(redirect('/accounts?error=oauth_failed', 'Google credentials not configured').redirect);
      }

      const redirectUri = getRedirectUri('google', request);

      // 1. Exchange code for tokens
      const tokenRes = await postJson('https://oauth2.googleapis.com/token', {
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      if (tokenRes.statusCode === 429) {
        return reply.redirect(redirect('/accounts?error=rate_limited').redirect);
      }
      if (tokenRes.statusCode !== 200) {
        logger.error({ data: tokenRes.data, statusCode: tokenRes.statusCode }, 'Google token exchange failed');
        return reply.redirect(
          redirect('/accounts?error=oauth_failed', `Google token exchange failed: ${(tokenRes.data as Record<string, string>)?.error ?? tokenRes.statusMessage}`).redirect,
        );
      }

      const tokenData = tokenRes.data as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      };

      // 2. Fetch profile
      const profileRes = await getJson(
        `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}`
      );
      const profile = profileRes.data as { id: string; name: string; email: string; picture: string } | undefined;

      const platformUserId = profile?.id ?? '';
      const username = profile?.name ?? profile?.email ?? '';

      // 3. Store SocialAccount
      const db = getDb();
      const credentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
        scope: tokenData.scope,
        profile,
      };
      const credentialsEnc = config.ENCRYPTION_KEY
        ? encrypt(JSON.stringify(credentials), config.ENCRYPTION_KEY)
        : JSON.stringify(credentials);

      await db.socialAccount.upsert({
        where: {
          emailAccountId_platform: {
            emailAccountId,
            platform: 'youtube',
          },
        },
        create: {
          emailAccountId,
          platform: 'youtube',
          platformUserId,
          username,
          status: 'active',
          credentialsEnc,
          lastLoginAt: new Date(),
          metadata: { scope: tokenData.scope, connectedVia: 'oauth' },
        },
        update: {
          platformUserId,
          username,
          status: 'active',
          credentialsEnc,
          lastLoginAt: new Date(),
          metadata: { scope: tokenData.scope, connectedVia: 'oauth', updatedAt: new Date().toISOString() },
        },
      });

      logger.info({ emailAccountId, platform: 'youtube', platformUserId }, 'OAuth connected');
      return reply.redirect(redirect('/accounts?success=youtube_connected').redirect);
    } catch (err) {
      logger.error({ err, emailAccountId }, 'Google OAuth callback failed');
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Callback processing failed').redirect);
    }
  });

  // ---------------------------------------------------------------------------
  // TikTok OAuth Callback (NO auth — external redirect)
  // ---------------------------------------------------------------------------
  app.get('/callback/tiktok', async (request, reply) => {
    const { code, state, error: oauthError } = request.query as Record<string, string>;
    const config = getConfig();

    if (oauthError) {
      logger.error({ error: oauthError }, 'TikTok OAuth callback returned error');
      return reply.redirect(redirect('/accounts?error=oauth_denied', oauthError).redirect);
    }

    if (!code || !state) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Missing code or state').redirect);
    }

    if (!config.JWT_SECRET) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'JWT_SECRET not configured').redirect);
    }

    const stateData = await verifyState(state, config.JWT_SECRET);
    if (!stateData) {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Invalid or expired state').redirect);
    }

    const { emailAccountId, platform } = stateData;
    if (!emailAccountId || platform !== 'tiktok') {
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Bad state payload').redirect);
    }

    try {
      if (!config.TIKTOK_CLIENT_KEY || !config.TIKTOK_CLIENT_SECRET) {
        return reply.redirect(redirect('/accounts?error=oauth_failed', 'TikTok credentials not configured').redirect);
      }

      const redirectUri = getRedirectUri('tiktok', request);

      // 1. Exchange code for tokens
      const tokenRes = await postJson('https://open.tiktokapis.com/v2/oauth/token/', {
        client_key: config.TIKTOK_CLIENT_KEY,
        client_secret: config.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      if (tokenRes.statusCode === 429) {
        return reply.redirect(redirect('/accounts?error=rate_limited').redirect);
      }
      if (tokenRes.statusCode !== 200) {
        logger.error({ data: tokenRes.data, statusCode: tokenRes.statusCode }, 'TikTok token exchange failed');
        return reply.redirect(
          redirect('/accounts?error=oauth_failed', `TikTok token exchange failed: ${(tokenRes.data as Record<string, string>)?.error ?? tokenRes.statusMessage}`).redirect,
        );
      }

      const tokenData = tokenRes.data as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        open_id: string;
        scope: string;
      };

      // 2. Fetch user info
      const userInfoRes = await getJson(
        `https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,profile_deep_link` +
        `&access_token=${encodeURIComponent(tokenData.access_token)}`
      );
      const userInfo = userInfoRes.data as { data?: { user?: { display_name?: string; open_id?: string; avatar_url?: string } } } | undefined;

      const platformUserId = tokenData.open_id;
      const username = userInfo?.data?.user?.display_name ?? '';

      // 3. Store SocialAccount
      const db = getDb();
      const credentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
        openId: tokenData.open_id,
        scope: tokenData.scope,
        profile: userInfo?.data?.user,
      };
      const credentialsEnc = config.ENCRYPTION_KEY
        ? encrypt(JSON.stringify(credentials), config.ENCRYPTION_KEY)
        : JSON.stringify(credentials);

      await db.socialAccount.upsert({
        where: {
          emailAccountId_platform: {
            emailAccountId,
            platform: 'tiktok',
          },
        },
        create: {
          emailAccountId,
          platform: 'tiktok',
          platformUserId,
          username: username || platformUserId,
          status: 'active',
          credentialsEnc,
          lastLoginAt: new Date(),
          metadata: { scope: tokenData.scope, connectedVia: 'oauth' },
        },
        update: {
          platformUserId,
          username: username || platformUserId,
          status: 'active',
          credentialsEnc,
          lastLoginAt: new Date(),
          metadata: { scope: tokenData.scope, connectedVia: 'oauth', updatedAt: new Date().toISOString() },
        },
      });

      logger.info({ emailAccountId, platform: 'tiktok', platformUserId }, 'OAuth connected');
      return reply.redirect(redirect('/accounts?success=tiktok_connected').redirect);
    } catch (err) {
      logger.error({ err, emailAccountId }, 'TikTok OAuth callback failed');
      return reply.redirect(redirect('/accounts?error=oauth_failed', 'Callback processing failed').redirect);
    }
  });
}
