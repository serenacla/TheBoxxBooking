import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const randomToken = () => randomBytes(32).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function key() {
  const v = process.env.ENCRYPTION_KEY;
  if (!v || !/^[0-9a-f]{64}$/i.test(v))
    throw new Error("ENCRYPTION_KEY_NOT_CONFIGURED");
  return Buffer.from(v, "hex");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${result.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [alg, salt, digest] = encoded.split(":");
  if (alg !== "scrypt" || !salt || !digest) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function secureEqual(a: string, b: string) {
  const x = hash(a),
    y = hash(b);
  return timingSafeEqual(Buffer.from(x), Buffer.from(y));
}
export function encrypt(s: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(s, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decrypt(s: string) {
  const [iv, tag, data] = s.split(".").map((x) => Buffer.from(x, "base64url"));
  const c = createDecipheriv("aes-256-gcm", key(), iv);
  c.setAuthTag(tag);
  return Buffer.concat([c.update(data), c.final()]).toString("utf8");
}
export function signToken(subject: string, seconds: number) {
  const data = Buffer.from(
    JSON.stringify({ subject, exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", key()).update(data).digest("base64url")}`;
}
export function checkToken(token: string, subject: string) {
  try {
    const [data, sig] = token.split(".");
    const expect = createHmac("sha256", key()).update(data).digest("base64url");
    if (!secureEqual(sig, expect)) return false;
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    return p.subject === subject && p.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
