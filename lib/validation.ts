// Input hygiene for profile fields. Used by the setup form and the API.

export const VOICE_MIN_CHARS = 15;

// Trims, drops a leading @, and checks the result. Empty is allowed (optional).
export function cleanHandle(raw: string): { value: string; error?: string } {
  const value = raw.trim().replace(/^@+/, "");
  if (!value) return { value };
  if (/\s/.test(value)) {
    return { value, error: "Handles can't contain spaces. Try something like kingrando or king_rando." };
  }
  if (!/^[A-Za-z0-9._]{2,30}$/.test(value)) {
    return { value, error: "Use 2 to 30 letters, numbers, dots, or underscores." };
  }
  return { value };
}

// Voice is optional, but a one letter voice gives the AI nothing to work with.
export function cleanVoice(raw: string): { value: string; error?: string } {
  const value = raw.trim();
  if (!value) return { value };
  if (value.length < VOICE_MIN_CHARS) {
    return {
      value,
      error: `Describe your voice in at least ${VOICE_MIN_CHARS} characters, for example "Friendly, direct, a little nerdy."`,
    };
  }
  return { value };
}
