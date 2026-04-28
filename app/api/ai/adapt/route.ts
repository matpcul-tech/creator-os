import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { adaptPrompt, adaptSchema } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";

export async function POST(req: Request) {
  const body = await req.json();
  const master: string = body.master ?? "";
  const targets: PlatformId[] = Array.isArray(body.targets) ? body.targets : [];

  if (!master || targets.length === 0) {
    return NextResponse.json(
      { error: "master and at least one target required" },
      { status: 400 },
    );
  }

  try {
    const raw = await complete({
      user: adaptPrompt({ master, targets }),
      jsonSchema: adaptSchema(targets) as unknown as Record<string, unknown>,
      effort: "high",
      maxTokens: 6000,
    });

    let parsed: { variants: Record<string, string> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned non-JSON", raw },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
