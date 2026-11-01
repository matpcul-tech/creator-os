import { lockedVoiceId } from "@/lib/produce/voice-id";

export const dynamic = "force-dynamic";

// Studio reads this so Produce Video can start without a pasted id.
export async function GET() {
  return Response.json({ voiceId: lockedVoiceId(process.env.ELEVENLABS_VOICE_ID) });
}
