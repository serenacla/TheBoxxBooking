import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import {
  bookingSchema,
  daysInRange,
  quote,
  settingsSchema,
  type Booking,
  type Settings,
  type Actor,
  type Status,
} from "./model";
import { externalBusy, googleConnected } from "./google";
import { AppError } from "./http";
import { bookingMail } from "./mail";
import { encrypt } from "./crypto";
export async function enqueueBooking(
  c: PoolClient,
  b: Booking,
  s: Settings,
  suffix = "created",
  sendTeam = true,
) {
  await c.query(
    "INSERT INTO jobs(unique_key,kind,booking_id,payload) VALUES($1,'calendar',$2,'{}') ON CONFLICT(unique_key) DO NOTHING",
    [`${b.id}:${b.version}:calendar`, b.id],
  );
  for (const team of sendTeam ? [false, true] : [false]) {
    const payload = bookingMail(b, s, team);
    await c.query(
      "INSERT INTO jobs(unique_key,kind,booking_id,payload) VALUES($1,'email',$2,$3) ON CONFLICT(unique_key) DO NOTHING",
      [
        `${b.id}:${b.version}:${suffix}:${team ? "team" : "customer"}`,
        b.id,
        JSON.stringify({ encrypted: encrypt(JSON.stringify(payload)) }),
      ],
    );
  }
}
export async function assertReady(s: Settings) {
  if (!s.bookingsEnabled || !s.pricesConfirmed || !s.legalConfirmed)
    throw new AppError(503, "Online-Anfragen sind noch nicht freigeschaltet.");
  if (
    !s.notificationEmail ||
    !s.imprint ||
    !s.privacy ||
    !s.terms ||
    !s.calendarId ||
    !process.env.RESEND_API_KEY ||
    !process.env.MAIL_FROM ||
    !(await googleConnected())
  )
    throw new AppError(
      503,
      "Online-Anfragen sind noch nicht vollständig eingerichtet.",
    );
}
export async function createBooking(raw: unknown) {
  const input = bookingSchema.parse(raw);
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return transaction(async (c) => {
    const {
      rows: [setting],
    } = await c.query("SELECT * FROM app_settings WHERE id=1 FOR UPDATE");
    if (!setting) throw new AppError(503, "Einrichtung fehlt.");
    // Serialize retries of the same request, including after a lost HTTP response.
    const {
      rows: [existing],
    } = await c.query("SELECT * FROM bookings WHERE request_key=$1", [
      input.requestKey,
    ]);
    if (existing) {
      if (existing.request_hash !== requestHash)
        throw new AppError(
          409,
          "Diese Anfrage wurde bereits mit anderen Angaben gesendet. Bitte neue Anfrage starten.",
        );
      return existing as Booking;
    }
    const s = settingsSchema.parse(setting.data);
    await assertReady(s);
    if (input.catalogVersion !== setting.version)
      throw new AppError(
        409,
        "Die Preise oder Leistungen wurden aktualisiert. Bitte Seite neu laden und den Gesamtpreis erneut bestätigen.",
      );
    const q = quote(
      s,
      input.startDate,
      input.endDate,
      input.printerId,
      input.addOns,
    );
    const busy = await externalBusy(s, input.startDate, input.endDate);
    if (busy.length)
      throw new AppError(409, "Dieser Zeitraum ist im Google Kalender belegt.");
    const id = randomUUID(),
      ref = "BX-" + id.replaceAll("-", "").slice(0, 10).toUpperCase();
    const {
      rows: [b],
    } = await c.query<Booking>(
      `INSERT INTO bookings(id,reference,request_key,request_hash,start_date,end_date,data,quote,terms_snapshot,google_calendar_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        id,
        ref,
        input.requestKey,
        requestHash,
        input.startDate,
        input.endDate,
        JSON.stringify(input),
        JSON.stringify(q),
        JSON.stringify({
          terms: s.terms,
          privacy: s.privacy,
          priceNote: s.priceNote,
          consentAt: new Date().toISOString(),
          catalogVersion: setting.version,
        }),
        s.calendarId,
      ],
    );
    await enqueueBooking(c, b, s);
    await c.query(
      "INSERT INTO audit_log(action,booking_id) VALUES('booking.created',$1)",
      [id],
    );
    return b;
  });
}
export async function updateBooking(
  id: string,
  a: Actor,
  input: {
    version: number;
    status: Status;
    notes: string;
    paymentStatus: "open" | "paid";
    paymentNote: string;
    location: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    notifyCustomer: boolean;
  },
) {
  return transaction(async (c) => {
    const {
      rows: [setting],
    } = await c.query("SELECT * FROM app_settings WHERE id=1 FOR SHARE");
    const s = settingsSchema.parse(setting.data);
    const {
      rows: [b],
    } = await c.query<Booking>(
      "SELECT * FROM bookings WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!b) throw new AppError(404, "Buchung nicht gefunden.");
    if (input.version !== b.version)
      throw new AppError(
        409,
        "Diese Buchung wurde von einem anderen Account geändert. Bitte neu laden.",
      );
    if (b.status === "cancelled" && input.status !== "cancelled")
      throw new AppError(
        409,
        "Stornierte Buchungen können nicht reaktiviert werden. Bitte neu anfragen.",
      );
    const changedDates =
      input.startDate !== b.start_date || input.endDate !== b.end_date;
    let q = b.quote;
    if (changedDates) {
      if (b.status === "cancelled" || input.status === "cancelled")
        throw new AppError(
          400,
          "Eine Stornierung kann nicht gleichzeitig verschoben werden.",
        );
      daysInRange(input.startDate, input.endDate, 14);
      if ((await externalBusy(s, input.startDate, input.endDate, b.id)).length)
        throw new AppError(409, "Neuer Zeitraum ist im Kalender belegt.");
      q = quote(
        s,
        input.startDate,
        input.endDate,
        b.data.printerId,
        b.data.addOns,
      );
    }
    const data = {
      ...b.data,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
    };
    if (data.startDate === data.endDate && data.endTime <= data.startTime)
      throw new AppError(400, "Ende muss nach Beginn liegen.");
    const externalChange =
      changedDates ||
      b.status !== input.status ||
      data.location !== b.data.location ||
      data.startTime !== b.data.startTime ||
      data.endTime !== b.data.endTime;
    const {
      rows: [updated],
    } = await c.query<Booking>(
      `UPDATE bookings SET start_date=$1,end_date=$2,status=$3,data=$4,quote=$5,notes=$6,payment_status=$7,payment_note=$8,version=version+1,updated_at=now(),calendar_synced_at=CASE WHEN $9 THEN NULL ELSE calendar_synced_at END WHERE id=$10 RETURNING *`,
      [
        input.startDate,
        input.endDate,
        input.status,
        JSON.stringify(data),
        JSON.stringify(q),
        input.notes,
        input.paymentStatus,
        input.paymentNote,
        externalChange,
        id,
      ],
    );
    if (externalChange) {
      // Send customer updates for every material event change, never for private notes alone.
      const oldTerms = (
        await c.query("SELECT terms_snapshot FROM bookings WHERE id=$1", [id])
      ).rows[0].terms_snapshot;
      await enqueueBooking(
        c,
        updated,
        { ...s, terms: oldTerms.terms, priceNote: oldTerms.priceNote },
        "updated",
        false,
      );
    } else if (input.notifyCustomer)
      await enqueueBooking(c, updated, s, "copy", false);
    await c.query(
      "INSERT INTO audit_log(actor_id,action,booking_id,details) VALUES($1,'booking.updated',$2,$3)",
      [
        a.id,
        id,
        JSON.stringify({
          from: b.status,
          to: updated.status,
          datesChanged: changedDates,
        }),
      ],
    );
    return updated;
  });
}
export async function availability(s: Settings, start: string, end: string) {
  const rows = await query(
    "SELECT start_date,end_date FROM bookings WHERE occupied=true AND start_date<=$2 AND end_date>=$1",
    [start, end],
  );
  const dates = new Set<string>(await externalBusy(s, start, end));
  for (const b of rows)
    for (const d of daysInRange(b.start_date, b.end_date, 14))
      if (d >= start && d <= end) dates.add(d);
  return [...dates].sort();
}
