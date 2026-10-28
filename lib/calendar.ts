import type { Booking } from "./model";
import { dateLabel, daysInRange, money, nextDate, statusLabels } from "./model";
export function berlinInstant(date: string, time = "00:00") {
  const guess = new Date(`${date}T${time}:00Z`);
  // Derive the Berlin offset for the date, including summer/winter time.
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset",
  }).formatToParts(guess);
  const offset =
    parts.find((p) => p.type === "timeZoneName")!.value.replace("GMT", "") ||
    "+00:00";
  return new Date(`${date}T${time}:00${offset}`).toISOString();
}
export function busyDays(start: string, end: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start))
    return daysInRange(
      start,
      new Date(Date.parse(end + "T00:00:00Z") - 86400000)
        .toISOString()
        .slice(0, 10),
      800,
    );
  const local = (d: Date) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
  return daysInRange(
    local(new Date(start)),
    local(new Date(Date.parse(end) - 1)),
    800,
  );
}
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r/g, "");
const stamp = (s: string) => s.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function bookingText(b: Booking) {
  return [
    `Buchungsnummer: ${b.reference}`,
    `Status: ${statusLabels[b.status]}`,
    `Zeitraum: ${dateLabel(b.start_date)} ${b.data.startTime} – ${dateLabel(b.end_date)} ${b.data.endTime} (Europe/Berlin)`,
    `Ort: ${b.data.location}`,
    `Anlass: ${b.data.eventType} · ${b.data.guestCount} Gäste`,
    "",
    ...b.quote.lines.map((l) => `${l.name}: ${money(l.cents)}`),
    `Gesamt: ${money(b.quote.totalCents)}`,
    "",
    `Kontakt: ${b.data.name} · ${b.data.email} · ${b.data.phone}`,
    b.data.message ? `Hinweise: ${b.data.message}` : "",
    "Keine Online-Zahlung. Weitere Details werden persönlich abgestimmt.",
  ]
    .filter(Boolean)
    .join("\n");
}
// RFC 5545 folding is based on UTF-8 bytes, not JS string length.
export function foldLine(line: string) {
  const rows: string[] = [];
  let row = "";
  for (const c of line) {
    if (Buffer.byteLength(row + c) > 73) {
      rows.push(row);
      row = " " + c;
    } else row += c;
  }
  rows.push(row);
  return rows.join("\r\n");
}
export function calendarFile(b: Booking) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//THE BOXX//Booking//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@theboxx-booking`,
    `SEQUENCE:${b.version}`,
    `DTSTAMP:${stamp(new Date(b.updated_at).toISOString())}`,
    `DTSTART:${stamp(berlinInstant(b.start_date, b.data.startTime))}`,
    `DTEND:${stamp(berlinInstant(b.end_date, b.data.endTime))}`,
    `SUMMARY:${esc(`THE BOXX · ${b.data.eventType} · ${b.reference}`)}`,
    `LOCATION:${esc(b.data.location)}`,
    `DESCRIPTION:${esc(bookingText(b))}`,
    `STATUS:${b.status === "cancelled" ? "CANCELLED" : b.status === "requested" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
export function googleCalendarLink(b: Booking) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `THE BOXX · ${b.data.eventType}`,
    dates: `${stamp(berlinInstant(b.start_date, b.data.startTime))}/${stamp(berlinInstant(b.end_date, b.data.endTime))}`,
    ctz: "Europe/Berlin",
    location: b.data.location,
    details: `${b.reference}\n${b.quote.lines.map((l) => l.name).join(", ")}\n${money(b.quote.totalCents)}\nAnfrage: Details folgen von THE BOXX.`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
export const resourceEvent = (b: Booking) => ({
  summary: `THE BOXX · ${b.reference} · ${b.data.eventType}`,
  description: bookingText(b),
  location: b.data.location,
  start: { date: b.start_date },
  end: { date: nextDate(b.end_date) },
  transparency: "opaque",
  visibility: "private",
  extendedProperties: {
    private: { boxxBooking: b.id, boxxVersion: String(b.version) },
  },
});
