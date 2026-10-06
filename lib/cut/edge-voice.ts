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

function speakOne(text: string, voice: string): Promise<Buffer> {
  const id = randomUUID().replace(/-/g, "");
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=1-${CHROMIUM}&ConnectionId=${id}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
    });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("voice timed out"));
    }, 20000);
    ws.on("open", () => {
      const stamp = new Date().toString();
      ws.send(
        `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
      );
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'><prosody rate='-6%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${randomUUID()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp}\r\nPath:ssml\r\n\r\n${ssml}`,
      );
    });
    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        if (data.toString().includes("Path:turn.end")) {
          clearTimeout(timer);
          ws.close();
          const audio = Buffer.concat(chunks);
          if (audio.length < 400) reject(new Error("voice came back empty"));
          else resolve(audio);
        }
        return;
      }
      const buf = Buffer.from(data as Buffer);
      const marker = buf.indexOf("Path:audio\r\n");
      chunks.push(marker >= 0 ? buf.subarray(marker + "Path:audio\r\n".length) : buf);
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function edgeNarration(voiceId: string, pieces: string[]): Promise<string[] | null> {
  const voice = NEURAL[voiceId] ?? NEURAL.orion;
  try {
    const parts: string[] = [];
    for (const piece of pieces) {
      const audio = await speakOne(piece, voice);
      parts.push(audio.toString("base64"));
    }
    return parts.length ? parts : null;
  } catch {
    return null;
  }
}
