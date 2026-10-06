export type Aspect = "16:9" | "9:16" | "1:1";
export type Layout = "hook" | "statement" | "stat" | "list" | "close";
export type StillId = "desk" | "city" | "mic" | "path" | "cafe" | "paper" | "crowd" | "phone";
export type Camera = "push" | "driftL" | "driftR" | "rise" | "hold";

export type Scene = {
  id: string;
  narration: string;
  onscreen: string;
  layout: Layout;
  still: StillId;
  camera: Camera;
  clip?: string;
};

export type Project = {
  script: string;
  brand: string;
  aspect: Aspect;
  voiceId: string;
  music: boolean;
  scenes: Scene[];
};

export type WordMark = {
  word: string;
  start: number;
  end: number;
  scene: number;
};

export const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1"];

export const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "hook", label: "Hook" },
  { id: "statement", label: "Line" },
  { id: "stat", label: "Number" },
  { id: "list", label: "List" },
  { id: "close", label: "Close" },
];

export const STILLS: { id: StillId; label: string; src: string }[] = [
  { id: "desk", label: "Desk", src: "/stills/desk.jpg" },
  { id: "city", label: "City", src: "/stills/city.jpg" },
  { id: "mic", label: "Mic", src: "/stills/mic.jpg" },
  { id: "path", label: "Path", src: "/stills/path.jpg" },
  { id: "cafe", label: "Cafe", src: "/stills/cafe.jpg" },
  { id: "paper", label: "Paper", src: "/stills/paper.jpg" },
  { id: "crowd", label: "Room", src: "/stills/crowd.jpg" },
  { id: "phone", label: "Phone", src: "/stills/phone.jpg" },
];

export const VOICES: { id: string; label: string; note: string }[] = [
  { id: "orion", label: "Orion", note: "Cinematic" },
  { id: "ara", label: "Ara", note: "Warm" },
  { id: "eve", label: "Eve", note: "Bright" },
  { id: "leo", label: "Leo", note: "Strong" },
  { id: "sal", label: "Sal", note: "Smooth" },
  { id: "altair", label: "Altair", note: "Refined" },
  { id: "lumen", label: "Lumen", note: "Articulate" },
  { id: "lux", label: "Lux", note: "Calm" },
  { id: "perseus", label: "Perseus", note: "Confident" },
  { id: "rex", label: "Rex", note: "Clear" },
];

export function frameSize(aspect: Aspect): { width: number; height: number } {
  if (aspect === "9:16") return { width: 720, height: 1280 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

export function aspectRatio(aspect: Aspect): number {
  const { width, height } = frameSize(aspect);
  return width / height;
}
