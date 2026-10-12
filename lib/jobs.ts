import { randomUUID } from "node:crypto";
import { query, transaction } from "./db";
import { sendMail, type MailPayload } from "./mail";
import { decrypt } from "./crypto";
import { syncGoogle } from "./google";
import type { Booking } from "./model";
export async function runJobs(limit = 3) {
  const results: { id: string; ok: boolean }[] = [];
  for (let n = 0; n < limit; n++) {
    const lease = randomUUID();
    const [j] = await query(
      `UPDATE jobs SET status='processing',locked_at=now(),lock_token=$1,attempts=attempts+1 WHERE id=(
      SELECT id FROM jobs WHERE (status='pending' AND available_at<=now()) OR (status='processing' AND locked_at<now()-interval '5 minutes')
      ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [lease],
    );
    if (!j) break;
    try {
      if (j.kind === "calendar")
        await transaction(async (c) => {
          const {
            rows: [b],
          } = await c.query<Booking>(
            "SELECT * FROM bookings WHERE id=$1 FOR UPDATE",
            [j.booking_id],
          );
          if (b) {
            const result = await syncGoogle(b);
            await c.query(
              "UPDATE bookings SET google_event_id=$1,google_calendar_id=$2,calendar_synced_at=now(),occupied=$3 WHERE id=$4",
              [result.eventId, result.calendarId, !result.cancelled, b.id],
            );
          }
        });
      else {
        // Resend deduplicates for 24 hours. Old ambiguous sends need human review.
        if (
          j.attempts > 1 &&
          Date.now() - new Date(j.created_at).getTime() > 23 * 3600000
        )
          throw new Error(
            "Versandstatus unklar: vor erneutem Senden beim Mailanbieter prüfen.",
          );
        const payload = (
          j.payload.encrypted
            ? JSON.parse(decrypt(j.payload.encrypted))
            : j.payload
        ) as MailPayload;
        await sendMail(payload, j.unique_key);
      }
      await query(
        "UPDATE jobs SET status='done',last_error=null,completed_at=now(),locked_at=null WHERE id=$1 AND lock_token=$2",
        [j.id, lease],
      );
      results.push({ id: j.id, ok: true });
    } catch (e) {
      const expired =
        j.kind === "email" &&
        Date.now() - new Date(j.created_at).getTime() > 23 * 3600000;
      await query(
        "UPDATE jobs SET status=$1,last_error=$2,available_at=now()+$3*interval '1 second',locked_at=null WHERE id=$4 AND lock_token=$5",
        [
          j.attempts >= 8 || expired ? "failed" : "pending",
          e instanceof Error
            ? e.message.slice(0, 200)
            : "Übertragung fehlgeschlagen.",
          Math.min(3600, 30 * 2 ** j.attempts),
          j.id,
          lease,
        ],
      );
      results.push({ id: j.id, ok: false });
    }
  }
  await query(
    "DELETE FROM sessions WHERE expires_at<now(); DELETE FROM auth_tokens WHERE expires_at<now(); DELETE FROM oauth_states WHERE expires_at<now(); DELETE FROM rate_limits WHERE resets_at<now()-interval '1 day'",
  );
  return results;
}
