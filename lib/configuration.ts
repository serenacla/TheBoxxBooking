import { deployment } from "./deployment";

export function configurationIssues(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const issues: string[] = [];
  const origin = (name: string) => {
    const value = env[name];
    try {
      const url = new URL(value ?? "");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        (!local && url.protocol !== "https:") ||
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        throw new Error();
      return url.origin;
    } catch {
      issues.push(
        `${name}: vollständige Website-Adresse ohne Pfad eintragen; außerhalb von localhost ist HTTPS erforderlich.`,
      );
      return "";
    }
  };
  const booking = origin("BOOKING_URL");
  const admin = origin("ADMIN_URL");
  if (booking && booking === admin)
    issues.push(
      "BOOKING_URL und ADMIN_URL müssen die beiden getrennten Websites bezeichnen. Lokal: Port 3000 und 3001.",
    );
  try {
    const db = new URL(env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.hostname ||
      db.pathname === "/"
    )
      throw new Error();
    if (db.password === "replace-me")
      issues.push(
        "DATABASE_URL: Beispielpasswort durch eure Datenbankverbindung ersetzen.",
      );
  } catch {
    issues.push(
      "DATABASE_URL: gültige gemeinsame PostgreSQL-Verbindung fehlt.",
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY ?? ""))
    issues.push(
      "ENCRYPTION_KEY: 64 zufällige Hex-Zeichen eintragen; auf beiden Websites identisch.",
    );
  if ((env.CRON_SECRET ?? "").length < 32)
    issues.push("CRON_SECRET: mindestens 32 zufällige Zeichen eintragen.");
  for (const name of [
    "RESEND_API_KEY",
    "MAIL_FROM",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ]) {
    if (!env[name]?.trim()) issues.push(`${name}: noch nicht hinterlegt.`);
  }
  if (env.MAIL_FROM?.includes("your-domain.de"))
    issues.push(
      "MAIL_FROM: verifizierte eigene Absenderadresse statt Beispieldomain eintragen.",
    );
  if (!admin || env.GOOGLE_REDIRECT_URI !== `${admin}/api/google/callback`)
    issues.push(
      "GOOGLE_REDIRECT_URI muss exakt ADMIN_URL + /api/google/callback sein.",
    );
  if (
    deployment.mode === "booking" &&
    env.PREVIEW_ACCESS_ENABLED !== "false" &&
    !env.PREVIEW_ACCESS_CODE
  )
    issues.push(
      "PREVIEW_ACCESS_CODE fehlt. Für den öffentlichen Start PREVIEW_ACCESS_ENABLED=false setzen.",
    );
  return issues;
}
