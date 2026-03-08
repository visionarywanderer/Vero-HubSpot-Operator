import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getEnv } from "@/lib/env";

function getKey(): Buffer {
  return createHash("sha256").update(getEnv().ENCRYPTION_KEY).digest();
}

export function encryptText(value: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(ciphertext: string): string {
  const [ivEncoded, tagEncoded, dataEncoded] = ciphertext.split(".");
  if (!ivEncoded || !tagEncoded || !dataEncoded) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const data = Buffer.from(dataEncoded, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
