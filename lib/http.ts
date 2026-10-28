import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { deployment } from "./deployment";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function publicMode() {
  if (deployment.mode !== "booking")
    throw new AppError(404, "Nicht verfügbar.");
}
export function adminMode() {
  if (deployment.mode !== "admin") throw new AppError(404, "Nicht verfügbar.");
}
export function baseUrl(which: "booking" | "admin") {
  const s = process.env[which === "booking" ? "BOOKING_URL" : "ADMIN_URL"];
  if (!s)
    throw new AppError(503, "Die Website-Adresse ist noch nicht eingerichtet.");
  return new URL(s).origin;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const urls = [
    deployment.mode === "admin"
      ? process.env.ADMIN_URL
      : process.env.BOOKING_URL,
  ];
  const allowed = urls.filter(Boolean).map((s) => new URL(s!).origin);
  if (!origin || !allowed.includes(origin))
    throw new AppError(403, "Ungültiger Anfrageursprung.");
}
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "JSON erforderlich.");
  if (Number(req.headers.get("content-length") ?? 0) > 90000)
    throw new AppError(413, "Anfrage zu groß.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Anfrage fehlt.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 90000) {
      await reader.cancel();
      throw new AppError(413, "Anfrage zu groß.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "Ungültige Anfrage.");
  }
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function handle(fn: () => Promise<Response>) {
  return fn().catch((e: unknown) => {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json({ error: e.issues.map((i) => i.message).join(" · ") }, 400);
    const code = (e as { code?: string })?.code;
    if (code === "23P01")
      return json(
        {
          error:
            "Der Zeitraum ist inzwischen belegt. Bitte wähle einen anderen Termin.",
        },
        409,
      );
    // Never return SQL, tokens, credentials or third-party response bodies to visitors.
    console.error(
      "THE BOXX request failed",
      e instanceof Error ? e.name : "unknown",
      code ?? "",
    );
    return json(
      {
        error:
          "Der Dienst ist gerade nicht bereit. Bitte später erneut versuchen oder THE BOXX kontaktieren.",
      },
      503,
    );
  });
}
