// Scene cards and voice settings for a faceless render.
// duration is the planned length in seconds. The clip follows the voice recording
// so burned in captions stay aligned with the words.

export type Aspect = "9:16" | "16:9";

export type SceneCard = {
  title: string;
  narration: string;
  visual: string;
  duration: number;
};

export type VoiceSettings = {
  voiceId: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

export type ChannelPalette = {
  navy: string;
  bone: string;
  amber: string;
  teal: string;
  slate: string;
};

export const SOVEREIGN_PALETTE: ChannelPalette = {
  navy: "#0B1F33",
  bone: "#F4F1EA",
  amber: "#F2A900",
  teal: "#1FA39A",
  slate: "#5B6B7A",
};

export type ProduceInput = {
  title: string;
  aspect: Aspect;
  voice: VoiceSettings;
  scenes: SceneCard[];
  channel?: string;
  palette?: ChannelPalette;
};

export const DEFAULT_VOICE: Omit<VoiceSettings, "voiceId"> = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 1,
};

export function frameSize(aspect: Aspect): { width: number; height: number } {
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  return { width: 1920, height: 1080 };
}

export type JobStatus =
  | "queued"
  | "voicing"
  | "drawing"
  | "encoding"
  | "uploading"
  | "completed"
  | "failed";

export type JobView = {
  jobId: string;
  status: JobStatus;
  progress: number;
  message: string;
  error: string;
  blocker: string;
  videoUrl: string;
  contentId: number | null;
  aspect: Aspect;
  title: string;
};
