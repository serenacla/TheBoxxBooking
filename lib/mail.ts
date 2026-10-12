import { baseUrl } from "./http";
import { calendarFile, bookingText, googleCalendarLink } from "./calendar";
import { signToken } from "./crypto";
import { type Booking, type Settings, statusLabels } from "./model";
export type MailPayload = {
  to: string;
  from: string;
  reply_to?: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string; content_type: string }[];
};
export function receiptToken(id: string) {
  return signToken("receipt:" + id, 3 * 365 * 86400);
}
export function receiptUrl(b: Booking) {
  return `${baseUrl("booking")}/bestaetigung/${b.id}?token=${encodeURIComponent(receiptToken(b.id))}`;
}
export function bookingMail(
  b: Booking,
  s: Settings,
  team = false,
): MailPayload {
  const opening = team
    ? `Buchung ${b.reference}: ${statusLabels[b.status]}`
    : b.status === "cancelled"
      ? `Hallo ${b.data.name},\n\ndeine Anfrage wurde storniert.`
      : b.status === "confirmed"
        ? `Hallo ${b.data.name},\n\ndeine Buchung ist bestätigt!`
        : `Hallo ${b.data.name},\n\nvielen Dank! Deine Buchungsanfrage ist eingegangen. Der Zeitraum ist in unserem Buchungssystem reserviert. Dies ist eine Eingangsbestätigung; alle weiteren Details stimmen wir persönlich mit dir ab.`;
  return {
    from: process.env.MAIL_FROM!,
    to: team ? s.notificationEmail : b.data.email,
    reply_to: team ? b.data.email : s.replyTo || s.notificationEmail,
    subject: `${b.status === "cancelled" ? "Stornierung" : team ? "THE BOXX Anfrage" : "THE BOXX · " + statusLabels[b.status]} · ${b.reference}`,
    text: [
      opening,
      "",
      bookingText(b),
      "",
      s.priceNote,
      "",
      team
        ? `Im Team-Dashboard: ${baseUrl("admin")}/admin?booking=${b.id}`
        : `Bestätigung & Kalenderdatei: ${receiptUrl(b)}\nZu Google Kalender hinzufügen: ${googleCalendarLink(b)}`,
      "",
      "Buchungsbedingungen zum Zeitpunkt der Anfrage:",
      s.terms,
      "",
      s.companyName,
      s.phone,
      s.imprint,
    ].join("\n"),
    attachments: [
      {
        filename: `THE-BOXX-${b.reference}.ics`,
        content: Buffer.from(calendarFile(b)).toString("base64"),
        content_type: "text/calendar; charset=utf-8",
      },
    ],
  };
}
export async function sendMail(payload: MailPayload, key: string) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    throw new Error("E-Mail-Versand noch nicht eingerichtet.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`E-Mail-Anbieter meldet Fehler ${r.status}.`);
  const result = await r.json();
  if (!result.id) throw new Error("Keine Versandbestätigung erhalten.");
  return result.id as string;
}
