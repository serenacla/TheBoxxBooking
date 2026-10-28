"use client";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={"brand " + (light ? "light" : "")}>
      <small>THE</small> BOXX<span>.</span>
    </span>
  );
}
export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api/" + path, {
      method,
      headers: method === "GET" ? {} : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error(
      "Verbindung unterbrochen. Prüfe deinen Internetzugang. Falls du gerade abgesendet hast, sende unverändert erneut – dieselbe Anfrage wird nicht doppelt gespeichert.",
    );
  }
  let b;
  try {
    b = await r.json();
  } catch {
    throw new Error(
      "Der Server konnte nicht antworten. Bitte in einem Moment erneut versuchen.",
    );
  }
  if (!r.ok) throw new Error(b.error ?? "Verbindung fehlgeschlagen.");
  return b;
}
export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field full" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
