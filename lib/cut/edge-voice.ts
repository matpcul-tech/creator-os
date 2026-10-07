import { createHash, randomUUID } from "crypto";
import WebSocket from "ws";

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM = "143.0.3650.75";

const NEURAL: Record<string, string> = {
  orion: "en-US-AndrewNeural",
  ara: "en-US-JennyNeural",
  eve: "en-US-AriaNeural",
  leo: "en-US-GuyNeural",
  sal: "en-GB-RyanNeural",
  altair: "en-GB-SoniaNeural",
  lumen: "en-US-EmmaNeural",
  lux: "en-US-AvaNeural",
  perseus: "en-US-BrianNeural",
  rex: "en-US-ChristopherNeural",
};

function gec(): string {
  const step = BigInt("3000000000");
  const ticks = BigInt(Math.floor(Date.now() / 1000) + 11644473600) * BigInt("10000000");
  const rounded = ticks - (ticks % step);
  return createHash("sha256").update(String(rounded) + TOKEN).digest("hex").toUpperCase();
}

function escapeXml(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return value.split("&").join(amp).split("<").join(lt).split(">").join(gt).split('"').join(quot);
}

function speakOne(text: string, voice: string, timeoutMs = 12000): Promise<Buffer> {
  const id = randomUUID().replace(/-/g, "");
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=1-${CHROMIUM}&ConnectionId=${id}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];
    const finish = (error: Error | null, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
      if (error) reject(error);
      else resolve(audio as Buffer);
    };
    const ws = new WebSocket(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
    });
    const timer = setTimeout(() => finish(new Error("voice timed out")), timeoutMs);
    ws.on("open", () => {
      try {
        const stamp = new Date().toString();
        ws.send(
          `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
        );
        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody rate='-6%'>${escapeXml(text)}</prosody></voice></speak>`;
        ws.send(
          `X-RequestId:${randomUUID().replace(/-/g, "")}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp}\r\nPath:ssml\r\n\r\n${ssml}`,
        );
      } catch (error) {
        finish(error instanceof Error ? error : new Error("voice send failed"));
      }
    });
    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        if (data.toString().includes("Path:turn.end")) {
          const audio = Buffer.concat(chunks);
          if (audio.length < 400) finish(new Error("voice came back empty"));
          else finish(null, audio);
        }
        return;
      }
      const buf = Buffer.from(data as Buffer);
      const marker = buf.indexOf("Path:audio\r\n");
      chunks.push(marker >= 0 ? buf.subarray(marker + "Path:audio\r\n".length) : buf);
    });
    ws.on("unexpected-response", (_req, res) => finish(new Error(`voice refused (${res.statusCode})`)));
    // The service sometimes drops the socket (1006) before turn.end. Fail fast instead of hanging.
    ws.on("close", (code) => finish(new Error(`voice closed early (${code})`)));
    ws.on("error", (error) => finish(error));
  });
}

async function speakWithRetry(text: string, voice: string): Promise<Buffer> {
  try {
    return await speakOne(text, voice);
  } catch {
    return speakOne(text, voice);
  }
}

export async function edgeNarration(voiceId: string, pieces: string[]): Promise<string[] | null> {
  const voice = NEURAL[voiceId] ?? NEURAL.orion;
  if (!pieces.length) return null;
  const parts: string[] = new Array(pieces.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < pieces.length) {
      const index = next++;
      try {
        const audio = await speakWithRetry(pieces[index], voice);
        parts[index] = audio.toString("base64");
      } catch (error) {
        failed = true;
        console.warn("edge voice failed:", error instanceof Error ? error.message : error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, pieces.length) }, worker));
  return failed ? null : parts;
}
