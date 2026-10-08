import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto-box";
import {
  googleCredentials,
  needsRefresh,
  refreshAccessToken,
  type TokenSet,
} from "./youtube-oauth";

export async function saveYouTubeTokens(tokens: TokenSet, accountName = ""): Promise<void> {
  const existing = await prisma.oAuthToken.findUnique({ where: { provider: "youtube" } });
  // Google only sends a refresh token on first consent; keep the old one otherwise.
  const refresh = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : existing?.refreshToken ?? "";
  const data = {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken: refresh,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    accountName: accountName || existing?.accountName || "",
  };
  await prisma.oAuthToken.upsert({
    where: { provider: "youtube" },
    create: { provider: "youtube", ...data },
    update: data,
  });
}

export async function youtubeStatus(): Promise<{ configured: boolean; connected: boolean; accountName: string }> {
  const configured = Boolean(googleCredentials());
  const row = await prisma.oAuthToken.findUnique({ where: { provider: "youtube" } }).catch(() => null);
  return { configured, connected: Boolean(row?.refreshToken), accountName: row?.accountName ?? "" };
}

// Returns a usable access token, refreshing it when it is about to expire.
export async function youtubeAccessToken(): Promise<string> {
  const creds = googleCredentials();
  if (!creds) throw new Error("YouTube isn't set up yet.");
  const row = await prisma.oAuthToken.findUnique({ where: { provider: "youtube" } });
  if (!row?.refreshToken) throw new Error("YouTube isn't connected. Connect it in Integrations.");
  if (!needsRefresh(row.expiresAt)) return decryptSecret(row.accessToken);
  const fresh = await refreshAccessToken({ refreshToken: decryptSecret(row.refreshToken), ...creds });
  await prisma.oAuthToken.update({
    where: { provider: "youtube" },
    data: { accessToken: encryptSecret(fresh.accessToken), expiresAt: fresh.expiresAt },
  });
  return fresh.accessToken;
}
