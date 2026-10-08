// YouTube OAuth helpers (server side). Pure functions take a fetch
// implementation so they can be unit tested without network calls.

export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function googleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function redirectUriFor(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/youtube/callback`;
}

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline", // get a refresh token
    prompt: "consent", // always return a refresh token, even on reconnect
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
};

async function tokenRequest(body: URLSearchParams, fetchImpl: FetchLike): Promise<Record<string, unknown>> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Google token request failed: ${String(json.error || res.status)}`);
  }
  return json;
}

export async function exchangeCode(
  opts: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
  now = Date.now(),
): Promise<TokenSet> {
  const json = await tokenRequest(
    new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
    fetchImpl,
  );
  return {
    accessToken: String(json.access_token || ""),
    refreshToken: String(json.refresh_token || ""),
    expiresAt: new Date(now + Number(json.expires_in || 3600) * 1000),
    scope: String(json.scope || ""),
  };
}

export async function refreshAccessToken(
  opts: { refreshToken: string; clientId: string; clientSecret: string },
  fetchImpl: FetchLike = fetch,
  now = Date.now(),
): Promise<{ accessToken: string; expiresAt: Date }> {
  const json = await tokenRequest(
    new URLSearchParams({
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: "refresh_token",
    }),
    fetchImpl,
  );
  return {
    accessToken: String(json.access_token || ""),
    expiresAt: new Date(now + Number(json.expires_in || 3600) * 1000),
  };
}

// True when the token expires within the next 2 minutes.
export function needsRefresh(expiresAt: Date | null | undefined, now = Date.now()): boolean {
  return !expiresAt || expiresAt.getTime() - now < 120_000;
}
