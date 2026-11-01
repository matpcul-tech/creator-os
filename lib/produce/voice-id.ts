// The locked ElevenLabs voice for Produce Video. An env override wins.
// Otherwise the same premade voice the older produce route already used.

export const FALLBACK_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;

export function lockedVoiceId(envValue?: string): string {
  const value = (envValue ?? "").trim();
  if (VOICE_ID.test(value)) return value;
  return FALLBACK_VOICE_ID;
}
