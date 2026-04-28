import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { brandVoicePrompt, brandVoiceSchema } from "@/lib/prompts";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function POST(req: Request) {
  const body = await req.json();
  const samples: string = body.samples ?? "";

  if (!samples || samples.length < 50) {
    return NextResponse.json(
      { error: "Need at least ~50 chars of samples to analyze." },
      { status: 400 },
    );
  }

  try {
    const raw = await complete({
      user: brandVoicePrompt({ samples }),
      jsonSchema: brandVoiceSchema as unknown as Record<string, unknown>,
      effort: "high",
      maxTokens: 4000,
    });

    let parsed: {
      traits: { trait: string; strength: number }[];
      keywords: string[];
      voice_description: string;
      do_not_use: string[];
      example_good: string;
      example_bad: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned non-JSON", raw },
        { status: 500 },
      );
    }

    // Persist into Brand + Profile
    const brand = await prisma.brand.findFirst();
    const brandData = {
      voiceRules: stringifyJSON(parsed.traits.map((t) => `${t.trait} (${t.strength}%)`)),
      doNotUse: stringifyJSON(parsed.do_not_use),
      taglines: stringifyJSON(parsed.keywords),
    };
    if (brand) {
      await prisma.brand.update({ where: { id: brand.id }, data: brandData });
    } else {
      await prisma.brand.create({ data: brandData });
    }

    const profile = await prisma.profile.findFirst();
    if (profile) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { voice: parsed.voice_description },
      });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
