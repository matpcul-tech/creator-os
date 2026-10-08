import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, googleCredentials, redirectUriFor } from "@/lib/publish/youtube-oauth";

// Starts the Google OAuth flow. A random state is kept in a short-lived
// httpOnly cookie and checked in the callback.
export async function GET(req: Request) {
  const creds = googleCredentials();
  const origin = new URL(req.url).origin;
  if (!creds) return NextResponse.redirect(`${origin}/integrations?youtube=not_configured`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(
    buildAuthUrl({ clientId: creds.clientId, redirectUri: redirectUriFor(origin), state }),
  );
  res.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/youtube",
    maxAge: 600,
  });
  return res;
}
