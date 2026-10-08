import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Public endpoint (see middleware PUBLIC_API_PREFIXES). Guarded by a per-IP
// rate limit, a honeypot field, strict validation, and a unique email index.
const schema = z.object({
  email: z.string().trim().toLowerCase().min(5).max(254).email(),
  source: z.string().trim().max(40).optional(),
  // Honeypot: real people never see or fill this field.
  company: z.string().optional(),
});

const OK_MESSAGE = "You're on the list. We'll email you when it's ready.";

export async function POST(req: Request) {
  const limit = rateLimit(`waitlist:${clientIp(req)}`, 5, 60 * 10);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const { email, source, company } = parsed.data;

  // Bots fill the hidden field. Pretend it worked and store nothing.
  if (company && company.trim() !== "") {
    return NextResponse.json({ ok: true, message: OK_MESSAGE });
  }

  const cleanSource = (source || "landing").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "landing";

  try {
    await prisma.waitlistEntry.create({ data: { email, source: cleanSource } });
    return NextResponse.json({ ok: true, message: OK_MESSAGE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Already signed up. Same friendly answer, no duplicate row.
      return NextResponse.json({
        ok: true,
        already: true,
        message: "You're already on the list. We'll be in touch.",
      });
    }
    console.error("[waitlist] save failed", e);
    return NextResponse.json(
      { error: "Something went wrong saving your email. Please try again." },
      { status: 500 },
    );
  }
}
