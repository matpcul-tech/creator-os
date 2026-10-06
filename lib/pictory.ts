const BASE = "https://api.pictory.ai/pictoryapis";

function key() {
  const value = process.env.PICTORY_API_KEY;
  if (!value) throw new Error("PICTORY_API_KEY is not set");
  return value;
}

export async function createStoryboard(title: string, script: string) {
  const res = await fetch(`${BASE}/v2/video/storyboard`, {
    method: "POST",
    headers: {
      Authorization: key(),
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      videoName: title.slice(0, 80) || "Creator OS cut",
      videoWidth: 1080,
      videoHeight: 1920,
      language: "en",
      scenes: [{ story: script.slice(0, 12000), createSceneOnEndOfSentence: true }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `Pictory ${res.status}`);
  return json as { jobId?: string; data?: { jobId?: string } };
}

export async function storyboardStatus(jobId: string) {
  const res = await fetch(`${BASE}/v1/jobs/${jobId}`, {
    headers: { Authorization: key(), accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `Pictory ${res.status}`);
  return json as { status?: string; data?: { status?: string; previewUrl?: string; videoUrl?: string } };
}
