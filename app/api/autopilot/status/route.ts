import { NextResponse } from "next/server";
import { AUTOPILOT_REPO, canWrite, readState } from "@/lib/autopilot/github";
import library from "@/autopilot/library.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const { config, log } = await readState().catch(() => ({ config: null, log: [] }));
  return NextResponse.json(
    {
      config,
      log: log.slice(-30).reverse(),
      canWrite: canWrite(),
      repo: AUTOPILOT_REPO,
      items: library.items.map((i) => ({ id: i.id, title: i.title, kind: i.kind, link: i.link })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
