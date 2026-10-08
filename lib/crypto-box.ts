import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// AES-256-GCM for secrets stored in the database (OAuth tokens).
// Key: TOKEN_ENCRYPTION_KEY if set, otherwise APP_SESSION_SECRET.
// Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>

function key(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.APP_SESSION_SECRET || "";
  if (secret.length < 16) throw new Error("Encryption key is not configured.");
  return createHash("sha256").update(`creator-os-token-key:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(box: string): string {
  if (!box) return "";
  const [v, iv, tag, data] = box.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
