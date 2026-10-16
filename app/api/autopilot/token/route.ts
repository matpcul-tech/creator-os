import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto-box";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Reveals the stored YouTube refresh token to the signed-in owner (session
// gate in middleware) so it can be pasted into GitHub as YT_REFRESH_TOKEN.
export async function POST(req: Request) {
  const limit = rateLimit(`autopilot-token:${clientIp(req)}`, 5, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  const row = await prisma.oAuthToken.findUnique({ where: { provider: "youtube" } }).catch(() => null);
  if (!row?.refreshToken) {
    return NextResponse.json({ error: "Connect YouTube first (step 2 above)." }, { status: 400 });
  }
  return NextResponse.json(
    { refreshToken: decryptSecret(row.refreshToken), clientId: process.env.GOOGLE_CLIENT_ID || "", account: row.accountName },
    { headers: { "Cache-Control": "no-store" } },
  );
}
