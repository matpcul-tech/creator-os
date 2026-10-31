# Produce Video

Studio can turn scene cards into a finished faceless MP4. Planner and Calendar keep the same content item. The file URL is stored on that item.

## Architecture

The render runs in the Produce API route on Fluid Compute (`maxDuration` 800 seconds) with the `ffmpeg-static` binary.

1. ElevenLabs `POST /v1/text-to-speech/{voiceId}/with-timestamps` returns audio and character timings for each scene. The key is `ELEVENLABS_API_KEY`. A 401 stops the job and is reported as a blocker. There is no fallback voice provider.
2. Each scene card (`title`, `narration`, `visual`, `duration`) becomes a PNG in one channel palette: branded background, big type, a diagram, or a bar or line chart. Rendering is SVG through `@resvg/resvg-js`. A `stock:` visual can use Pixabay when `PIXABAY_API_KEY` is set. Stock is optional. A miss still draws the branded card.
3. FFmpeg builds one clip per scene: the still (a slight slow zoom), the speech, and ASS captions burned in from the character timings. Headings and captions use Inter. Chart labels use IBM Plex Sans. Both families are bundled under `assets/fonts`. A short film joins with a crossfade. A long film, with many clips, joins by stream copy after a short fade at each clip edge so the render stays inside the function limit. The source line sits under the channel name, clear of the caption band. Source pictures and audio are deleted as each clip finishes.
4. The MP4 is uploaded to Vercel Blob (`BLOB_READ_WRITE_TOKEN`) and the public URL is written to the planner item (`videoUrl`). If that item has no date, it is placed on today so the calendar shows it.

`duration` on a card is the planned length. The clip uses the longer of that plan and the voice recording, so speech is never cut and captions stay on the words that were spoken.

### Why a function, not a Sandbox microVM

Scene art is a still image, so encoding is much faster than realtime. An 8 to 12 minute film is a series of short clips plus a copy concat, which fits the function time limit. Still image clips stay small enough for the function temporary disk.

ElevenLabs and Blob credentials stay in the function. A sandbox would copy those secrets into another machine and would install ffmpeg on every job. Sandbox is the right tool for untrusted code. This pipeline only runs the app's own renderer.

On Hobby, function time tops out at 300 seconds. A normal film still fits because the clips are stills. If a run would exceed the limit, the job fails with a clear message instead of returning a partial file.

## API

`POST /api/produce`

`GET /api/produce/{jobId}`

Auth header: `Authorization`

Send a bearer token when the caller is a bot. Studio sends the signed in session cookie instead.

```json
{
  "title": "Morning rule",
  "aspect": "9:16",
  "contentId": 12,
  "voice": {
    "voiceId": "YOUR_VOICE_ID",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0,
    "use_speaker_boost": true,
    "speed": 1
  },
  "scenes": [
    {
      "title": "Open",
      "narration": "Start before you feel ready.",
      "visual": "big-text: Start before you feel ready",
      "duration": 4
    }
  ]
}
```

`aspect` is `9:16` (Shorts, 1080x1920) or `16:9` (long form, 1920x1080). You can send `format` as `short` or `long` instead. `contentId` is optional. When it is omitted, a draft planner item is created. `script` can replace `scenes`. The response includes `jobId` and `poll`.

Poll until `status` is `completed` or `failed`. `videoUrl` is the MP4. `blocker` is `elevenlabs_auth` when the voice key is rejected.

Visual prefixes: `big-text:`, `background:`, `diagram: Hook > Proof > Close`, `bar: Sleep 8 | Focus 6`, `line: 2, 5, 9`, `stock: search words`.

## Environment

| Name | Role |
|---|---|
| `ELEVENLABS_API_KEY` | Voice with timings. Server only. |
| `CREATOR_OS_API_TOKEN` | Bearer token for `/api/produce`. |
| `BLOB_READ_WRITE_TOKEN` | Uploads the MP4. Set when a Blob store is connected. |
| `PIXABAY_API_KEY` | Optional stock stills. |
