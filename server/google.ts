// Google sign-in: OAuth code flow with PKCE, a state cookie and a nonce.
// The ID token comes straight from Google's token endpoint over TLS, so we check
// its claims but not its signature (OpenID Connect Core 3.1.3.7).
import { createHash, randomBytes } from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

export interface GoogleStart {
  url: string;
  state: string;
  verifier: string;
  nonce: string;
}

export function googleAuthUrl(redirectUri: string): GoogleStart {
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const nonce = randomBytes(18).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${AUTH_URL}?${params}`, state, verifier, nonce };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export class GoogleError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

/** Exchanges the code for tokens and returns the verified profile. */
export async function googleProfile(code: string, verifier: string, nonce: string, redirectUri: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  let res: Response;
  try {
    // GOOGLE_TOKEN_URL exists only so the automated tests can stand in for Google
    res = await fetch(process.env.GOOGLE_TOKEN_URL || TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GoogleError('unreachable');
  }
  const data = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !data?.id_token) throw new GoogleError(data?.error ?? 'token_exchange_failed');

  const part = data.id_token.split('.')[1];
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleError('bad_id_token');
  }
  const now = Date.now() / 1000;
  const aud = claims.aud;
  if (!ISSUERS.has(String(claims.iss))) throw new GoogleError('wrong_issuer');
  if (!(aud === clientId || (Array.isArray(aud) && aud.includes(clientId)))) throw new GoogleError('wrong_audience');
  if (typeof claims.exp !== 'number' || claims.exp < now - 60) throw new GoogleError('expired');
  if (claims.nonce !== nonce) throw new GoogleError('wrong_nonce');
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') throw new GoogleError('missing_claims');
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new GoogleError('email_not_verified');
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : claims.email.split('@')[0],
  };
}
