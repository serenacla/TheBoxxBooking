import { cookies } from "next/headers";
import { query } from "./db";
import { hash, randomToken, checkToken, signToken } from "./crypto";
import { AppError, adminMode } from "./http";
import type { Actor } from "./model";
export const SESSION = "boxx_session";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export async function actor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION)?.value;
  if (!token) return null;
  const [row] = await query<Actor>(
    "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN staff u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
    [hash(token)],
  );
  return row ?? null;
}
export async function requireActor(
  roles: Actor["role"][] = ["owner", "manager", "viewer"],
) {
  adminMode();
  const a = await actor();
  if (!a) throw new AppError(401, "Bitte anmelden.");
  if (!roles.includes(a.role))
    throw new AppError(403, "Keine Berechtigung für diese Aktion.");
  return a;
}
export async function createSession(userId: string) {
  const t = randomToken();
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [hash(t), userId],
  );
  (await cookies()).set(SESSION, t, { ...options, maxAge: 43200 });
}
export async function logout() {
  const jar = await cookies();
  const t = jar.get(SESSION)?.value;
  if (t) await query("DELETE FROM sessions WHERE token_hash=$1", [hash(t)]);
  jar.delete(SESSION);
}
export async function rateLimit(key: string, limit: number, seconds = 900) {
  const [r] = await query(
    `INSERT INTO rate_limits(key,hits,resets_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.hits+1 END,
    resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+$2*interval '1 second' ELSE rate_limits.resets_at END RETURNING hits`,
    [hash(key), seconds],
  );
  if (r.hits > limit)
    throw new AppError(
      429,
      "Zu viele Versuche. Bitte später erneut versuchen.",
    );
}
export function clientKey(req: Request) {
  // Trust only the proxy header supplied by the configured hosting platform.
  const header = process.env.NETLIFY
    ? "x-nf-client-connection-ip"
    : process.env.VERCEL
      ? "x-vercel-forwarded-for"
      : process.env.TRUST_PROXY_IP_HEADER;
  return header
    ? (req.headers.get(header)?.split(",")[0].trim() ?? "unknown")
    : "shared";
}
export async function previewAllowed() {
  if (process.env.PREVIEW_ACCESS_ENABLED === "false") return true;
  if (!process.env.PREVIEW_ACCESS_CODE) return false;
  const t = (await cookies()).get("boxx_preview")?.value;
  return (
    !!t && checkToken(t, "preview:" + hash(process.env.PREVIEW_ACCESS_CODE))
  );
}
export async function requirePreview() {
  if (!(await previewAllowed()))
    throw new AppError(401, "Bitte zuerst den Vorschau-Code eingeben.");
}
export async function grantPreview() {
  (await cookies()).set(
    "boxx_preview",
    signToken("preview:" + hash(process.env.PREVIEW_ACCESS_CODE!), 43200),
    options,
  );
}
