// Bearer check for /api/produce. The session cookie is already checked by middleware
// when this header is absent. The token value is never logged.

import { createHash, timingSafeEqual } from "crypto";

export type AuthDecision =
  | { ok: true; via: "session" | "token" }
  | { ok: false; status: number; error: string };

export function authorizeProduce(authorization: string | null): AuthDecision {
  if (!authorization) return { ok: true, via: "session" };
  const match = authorization.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return { ok: false, status: 401, error: "Unauthorized" };
  const expected = process.env.CREATOR_OS_API_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, error: "CREATOR_OS_API_TOKEN is not set on this deployment." };
  }
  const got = createHash("sha256").update(match[1]).digest();
  const exp = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(got, exp)) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, via: "token" };
}
