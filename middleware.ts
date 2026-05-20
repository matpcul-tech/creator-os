import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = new Set<string>(["/", "/login", "/signup"]);
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/waitlist"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token).catch(() => false);
  if (ok) return NextResponse.next();

  // API requests get a 401 JSON; page requests get redirected to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/login") {
    url.searchParams.set("next", pathname + (search || ""));
  }
  return NextResponse.redirect(url);
}

// Match everything except Next.js internals, static files, and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
