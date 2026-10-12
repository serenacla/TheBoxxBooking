import { OAuth2Client } from "google-auth-library";
import { query, getSettings } from "./db";
import { encrypt, decrypt } from "./crypto";
import { AppError } from "./http";
import { berlinInstant, busyDays, resourceEvent } from "./calendar";
import { nextDate, type Booking, type Settings } from "./model";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export function oauth() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  )
    throw new AppError(503, "Google OAuth ist noch nicht eingerichtet.");
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    transporterOptions: { timeout: 6000, retry: false },
  });
}
export async function googleConnected() {
  const r = await query("SELECT id FROM integrations WHERE id='google'");
  return r.length > 0;
}
export async function storeGoogleToken(token: string) {
  await query(
    "INSERT INTO integrations(id,encrypted_value) VALUES('google',$1) ON CONFLICT(id) DO UPDATE SET encrypted_value=$1,updated_at=now()",
    [encrypt(token)],
  );
}
export async function gfetch(path: string, init: RequestInit = {}) {
  const [row] = await query(
    "SELECT encrypted_value FROM integrations WHERE id='google'",
  );
  if (!row)
    throw new AppError(503, "Google Kalender ist noch nicht verbunden.");
  const client = oauth();
  client.setCredentials({ refresh_token: decrypt(row.encrypted_value) });
  let token: string | null | undefined;
  try {
    token = (await client.getAccessToken()).token;
  } catch {
    throw new AppError(503, "Google-Verbindung erneuern.");
  }
  if (!token) throw new AppError(503, "Google-Verbindung erneuern.");
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(6000),
  });
  return r;
}
export async function listCalendars() {
  const result: { id: string; name: string; role: string }[] = [];
  let page = "";
  do {
    const r = await gfetch(
      "/users/me/calendarList?maxResults=250" +
        (page ? "&pageToken=" + encodeURIComponent(page) : ""),
    );
    if (!r.ok)
      throw new AppError(503, "Kalenderliste konnte nicht geladen werden.");
    const data = await r.json();
    result.push(
      ...(data.items ?? []).map(
        (c: { id: string; summary: string; accessRole: string }) => ({
          id: c.id,
          name: c.summary,
          role: c.accessRole,
        }),
      ),
    );
    page = data.nextPageToken ?? "";
  } while (page);
  return result;
}
export async function externalBusy(
  settings: Settings,
  start: string,
  end: string,
  excludeBooking?: string,
) {
  if (!settings.calendarId)
    throw new AppError(503, "Noch kein Buchungskalender ausgewählt.");
  const ids = [
    ...new Set([settings.calendarId, ...settings.blockedCalendarIds]),
  ];
  const dates = new Set<string>();
  for (const id of ids) {
    let page = "";
    let pageCount = 0;
    do {
      const p = new URLSearchParams({
        timeMin: berlinInstant(start),
        timeMax: berlinInstant(nextDate(end)),
        singleEvents: "true",
        maxResults: "2500",
      });
      if (page) p.set("pageToken", page);
      const r = await gfetch(
        `/calendars/${encodeURIComponent(id)}/events?${p}`,
      );
      if (!r.ok)
        throw new AppError(
          503,
          "Google-Verfügbarkeit konnte nicht sicher geprüft werden. Bitte später erneut versuchen.",
        );
      const data = await r.json();
      for (const ev of data.items ?? []) {
        if (
          ev.status === "cancelled" ||
          ev.transparency === "transparent" ||
          (excludeBooking &&
            ev.extendedProperties?.private?.boxxBooking === excludeBooking)
        )
          continue;
        const a = ev.start?.date ?? ev.start?.dateTime;
        const b = ev.end?.date ?? ev.end?.dateTime;
        if (!a || !b)
          throw new AppError(
            503,
            "Ein Google-Termin konnte nicht geprüft werden.",
          );
        for (const d of busyDays(a, b))
          if (d >= start && d <= end) dates.add(d);
      }
      page = data.nextPageToken ?? "";
      if (++pageCount > 20)
        throw new AppError(
          503,
          "Zu viele Kalenderdaten. Bitte einen kürzeren Zeitraum prüfen.",
        );
    } while (page);
  }
  return [...dates];
}
export async function syncGoogle(b: Booking) {
  const settings = (await getSettings()).data;
  const calendarId = b.google_calendar_id || settings.calendarId;
  if (!calendarId) throw new Error("Kalender noch nicht eingerichtet.");
  // Google custom IDs accept base32hex (0-9, a-v), NOT arbitrary brand text.
  const eventId = b.google_event_id || "b0" + b.id.replaceAll("-", "");
  const path = `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  if (b.status === "cancelled") {
    const r = await gfetch(path, { method: "DELETE" });
    if (!r.ok && r.status !== 404 && r.status !== 410)
      throw new Error("Kalenderstornierung fehlgeschlagen.");
    return { eventId, calendarId, cancelled: true };
  }
  // Never overwrite someone else's event when encountering an existing ID.
  const existing = await gfetch(path);
  if (existing.ok) {
    const ev = await existing.json();
    if (ev.extendedProperties?.private?.boxxBooking !== b.id)
      throw new Error("Kalender-ID-Konflikt.");
    const r = await gfetch(path, {
      method: "PATCH",
      body: JSON.stringify(resourceEvent(b)),
    });
    if (!r.ok) throw new Error("Kalenderaktualisierung fehlgeschlagen.");
  } else if (existing.status === 404) {
    const r = await gfetch(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        body: JSON.stringify({ id: eventId, ...resourceEvent(b) }),
      },
    );
    if (!r.ok && r.status !== 409)
      throw new Error("Kalendereintrag fehlgeschlagen.");
    if (r.status === 409) throw new Error("Kalender wird erneut abgeglichen.");
  } else throw new Error("Kalendereintrag nicht lesbar.");
  return { eventId, calendarId, cancelled: false };
}
