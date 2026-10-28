import { NextResponse, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  handle,
  json,
  body,
  sameOrigin,
  publicMode,
  adminMode,
  AppError,
  baseUrl,
} from "./http";
import {
  clientKey,
  createSession,
  grantPreview,
  logout,
  rateLimit,
  requireActor,
  requirePreview,
} from "./auth";
import { query, transaction, getSettings, audit } from "./db";
import {
  hash,
  hashPassword,
  verifyPassword,
  randomToken,
  secureEqual,
  encrypt,
  checkToken,
} from "./crypto";
import {
  settingsSchema,
  defaultSettings,
  validDate,
  type Booking,
} from "./model";
import {
  createBooking,
  updateBooking,
  availability,
  assertReady,
} from "./bookings";
import { calendarFile, googleCalendarLink } from "./calendar";
import { receiptToken } from "./mail";
import {
  googleConnected,
  oauth,
  GOOGLE_SCOPES,
  listCalendars,
  storeGoogleToken,
} from "./google";
import { runJobs } from "./jobs";
import { csv } from "./csv";
import { deployment } from "./deployment";

const idSchema = z.uuid();
const passwordSchema = z
  .string()
  .min(12, "Mindestens 12 Zeichen verwenden.")
  .max(128);
const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const asyncJobs = () =>
  after(async () => {
    try {
      await runJobs(3);
    } catch {
      console.error("Job runner unavailable");
    }
  });
function publicSettings(data: typeof defaultSettings, version: number) {
  const {
    notificationEmail: _n,
    replyTo: _r,
    calendarId: _c,
    blockedCalendarIds: _b,
    ...safe
  } = data;
  return { ...safe, version };
}
async function enqueueAuth(
  user: { id: string; email: string; name: string },
  kind: "invite" | "reset",
) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    throw new AppError(503, "E-Mail-Versand ist noch nicht eingerichtet.");
  const token = randomToken();
  const url = `${baseUrl("admin")}/passwort?token=${token}`;
  const payload = {
    from: process.env.MAIL_FROM,
    to: user.email,
    subject:
      kind === "invite"
        ? "Dein THE BOXX Team-Zugang"
        : "THE BOXX · Passwort zurücksetzen",
    text: `Hallo ${user.name},\n\n${kind === "invite" ? "du wurdest zum THE BOXX Team eingeladen." : "du kannst ein neues Passwort festlegen."}\n${url}\n\nDer Link ist einmalig und eine Stunde gültig. Falls du dies nicht erwartet hast, ignoriere die E-Mail.`,
  };
  await query("DELETE FROM auth_tokens WHERE user_id=$1", [user.id]);
  await query(
    "INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(token), user.id, kind],
  );
  await query(
    "INSERT INTO jobs(unique_key,kind,payload) VALUES($1,'email',$2)",
    [
      "auth:" + randomUUID(),
      JSON.stringify({ encrypted: encrypt(JSON.stringify(payload)) }),
    ],
  );
}
export const route = (req: Request) =>
  handle(async () => {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, ""),
      method = req.method;
    // Enforce the archive's fixed role before reading a body or accessing data.
    if (
      path.startsWith("admin/") ||
      path.startsWith("auth/") ||
      path.startsWith("google/")
    )
      adminMode();
    if (
      path.startsWith("public/") ||
      path.startsWith("receipt/") ||
      path === "preview"
    )
      publicMode();
    if (path === "health" && method === "GET")
      return json({
        ok: true,
        service: deployment.mode,
        version: deployment.version,
      });
    const mutating = method !== "GET";
    if (path !== "jobs/run" && mutating) sameOrigin(req);

    if (path === "public/config" && method === "GET") {
      publicMode();
      await requirePreview();
      if (!process.env.DATABASE_URL)
        return json({
          ...publicSettings(defaultSettings, 0),
          setupRequired: true,
        });
      const { data, version } = await getSettings();
      return json(publicSettings(data, version));
    }
    if (path === "preview" && method === "POST") {
      publicMode();
      if (process.env.PREVIEW_ACCESS_ENABLED === "false")
        return json({ ok: true });
      if (!process.env.PREVIEW_ACCESS_CODE)
        throw new AppError(
          503,
          "Der Vorschau-Zugang ist noch nicht eingerichtet.",
        );
      await rateLimit("preview:" + clientKey(req), 10);
      const v = z.object({ code: z.string().max(200) }).parse(await body(req));
      if (!secureEqual(v.code, process.env.PREVIEW_ACCESS_CODE))
        throw new AppError(401, "Der Code ist nicht korrekt.");
      await grantPreview();
      return json({ ok: true });
    }
    if (path === "public/availability" && method === "GET") {
      publicMode();
      await requirePreview();
      await rateLimit("availability:" + clientKey(req), 100, 60);
      const month = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .parse(url.searchParams.get("month"));
      const start = month + "-01",
        end = new Date(
          Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10);
      const s = (await getSettings()).data;
      await assertReady(s);
      return json({
        bookedDates: await availability(s, start, end),
        checkedAt: new Date().toISOString(),
      });
    }
    if (path === "public/bookings" && method === "POST") {
      publicMode();
      await requirePreview();
      await rateLimit("booking:" + clientKey(req), 20, 3600);
      const data = await body(req);
      const b = await createBooking(data);
      asyncJobs();
      return json(
        { id: b.id, reference: b.reference, token: receiptToken(b.id) },
        201,
      );
    }
    if (path.startsWith("receipt/") && method === "GET") {
      publicMode();
      const [, id, format] = path.split("/");
      idSchema.parse(id);
      if (!checkToken(url.searchParams.get("token") ?? "", "receipt:" + id))
        throw new AppError(
          403,
          "Bestätigungslink ist ungültig oder abgelaufen.",
        );
      const [b] = await query<Booking>("SELECT * FROM bookings WHERE id=$1", [
        id,
      ]);
      if (!b) throw new AppError(404, "Anfrage nicht gefunden.");
      if (format === "calendar")
        return new Response(calendarFile(b), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="THE-BOXX-${b.reference}.ics"`,
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
          },
        });
      const jobs = await query(
        "SELECT kind,status,unique_key FROM jobs WHERE booking_id=$1 ORDER BY created_at DESC",
        [id],
      );
      const latestCustomerMail = jobs.find(
        (j) => j.kind === "email" && j.unique_key.endsWith(":customer"),
      );
      return json({
        reference: b.reference,
        status: b.status,
        data: {
          name: b.data.name,
          location: b.data.location,
          eventType: b.data.eventType,
          startTime: b.data.startTime,
          endTime: b.data.endTime,
        },
        startDate: b.start_date,
        endDate: b.end_date,
        quote: b.quote,
        googleUrl: googleCalendarLink(b),
        calendarSynced: !!b.calendar_synced_at,
        emailAccepted: latestCustomerMail?.status === "done",
        emailFailed: latestCustomerMail?.status === "failed",
        jobsPending: jobs.some(
          (j) => j.status === "pending" || j.status === "processing",
        ),
      });
    }
    if (path === "auth/login" && method === "POST") {
      adminMode();
      const v = z
        .object({ email: emailSchema, password: z.string().max(128) })
        .parse(await body(req));
      await rateLimit("login-ip:" + clientKey(req), 40);
      await rateLimit("login-email:" + v.email, 10);
      const [u] = await query(
        "SELECT * FROM staff WHERE email=$1 AND active=true",
        [v.email],
      );
      const dummy =
        "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
      const ok = await verifyPassword(v.password, u?.password_hash ?? dummy);
      if (!u || !u.password_hash || !ok)
        throw new AppError(401, "E-Mail oder Passwort ist nicht korrekt.");
      await createSession(u.id);
      await audit(u.id, "auth.login");
      return json({ ok: true });
    }
    if (path === "auth/logout" && method === "POST") {
      adminMode();
      await logout();
      return json({ ok: true });
    }
    if (path === "auth/reset" && method === "POST") {
      adminMode();
      await rateLimit("reset-ip:" + clientKey(req), 8, 3600);
      const v = z.object({ email: emailSchema }).parse(await body(req));
      await rateLimit("reset-email:" + v.email, 3, 3600);
      const [u] = await query(
        "SELECT id,email,name FROM staff WHERE email=$1 AND active=true",
        [v.email],
      );
      if (u)
        await transaction(async () =>
          enqueueAuth(
            u as { id: string; email: string; name: string },
            "reset",
          ),
        );
      asyncJobs();
      return json({
        ok: true,
        message: "Falls ein aktiver Account existiert, erhältst du einen Link.",
      });
    }
    if (path === "auth/password" && method === "POST") {
      adminMode();
      await rateLimit("password:" + clientKey(req), 10);
      const v = z
        .object({
          token: z.string().min(32).max(100),
          password: passwordSchema,
        })
        .parse(await body(req));
      const encoded = await hashPassword(v.password);
      await transaction(async (c) => {
        const {
          rows: [t],
        } = await c.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
          [hash(v.token)],
        );
        if (!t) throw new AppError(400, "Link ungültig oder abgelaufen.");
        const { rowCount } = await c.query(
          "UPDATE staff SET password_hash=$1 WHERE id=$2 AND active=true",
          [encoded, t.user_id],
        );
        if (!rowCount) throw new AppError(400, "Account ist deaktiviert.");
        await c.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
        await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [t.user_id]);
      });
      return json({ ok: true });
    }
    if (path === "admin/state" && method === "GET") {
      const a = await requireActor();
      const settings = await getSettings();
      const [stats] = await query(
        "SELECT count(*) FILTER(WHERE status='requested')::int AS requested,count(*) FILTER(WHERE status='confirmed')::int AS confirmed,count(*) FILTER(WHERE occupied AND end_date>=CURRENT_DATE)::int AS upcoming,coalesce(sum((quote->>'totalCents')::bigint) FILTER(WHERE status<>'cancelled'),0)::text AS volume FROM bookings",
      );
      const jobs = await query(
        "SELECT id,kind,booking_id,status,attempts,last_error,created_at FROM jobs ORDER BY created_at DESC LIMIT 100",
      );
      const activity = await query(
        "SELECT a.id,a.action,a.created_at,b.reference,u.name FROM audit_log a LEFT JOIN bookings b ON b.id=a.booking_id LEFT JOIN staff u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 30",
      );
      const users =
        a.role === "owner"
          ? await query(
              "SELECT id,name,email,role,active,password_hash IS NOT NULL AS activated FROM staff ORDER BY created_at",
            )
          : [];
      return json({
        actor: a,
        recent: await query<Booking>(
          "SELECT * FROM bookings ORDER BY created_at DESC,id DESC LIMIT 5",
        ),
        settings,
        stats,
        jobs,
        activity,
        users,
        connections: {
          google: await googleConnected(),
          mail: !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
          oauth: !!(
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ),
          cron: !!process.env.CRON_SECRET,
        },
      });
    }
    if (path === "admin/bookings" && method === "GET") {
      await requireActor();
      const search = (url.searchParams.get("search") ?? "").slice(0, 100),
        status = url.searchParams.get("status") ?? "";
      const page = Math.max(
        1,
        Math.min(100000, Math.floor(Number(url.searchParams.get("page"))) || 1),
      );
      const where =
        "($1='' OR reference ILIKE '%'||$1||'%' OR data->>'name' ILIKE '%'||$1||'%' OR data->>'email' ILIKE '%'||$1||'%') AND ($2='' OR status=$2)";
      const rows = await query(
        `SELECT * FROM bookings WHERE ${where} ORDER BY start_date DESC,created_at DESC LIMIT 25 OFFSET $3`,
        [search, status, (page - 1) * 25],
      );
      const [count] = await query(
        `SELECT count(*)::int AS total FROM bookings WHERE ${where}`,
        [search, status],
      );
      return json({ rows, total: count.total, page });
    }
    if (path === "admin/booking" && method === "GET") {
      await requireActor();
      const id = idSchema.parse(url.searchParams.get("id"));
      const [booking] = await query<Booking>(
        "SELECT * FROM bookings WHERE id=$1",
        [id],
      );
      if (!booking) throw new AppError(404, "Buchung nicht gefunden.");
      return json({ booking });
    }
    if (path === "admin/export" && method === "GET") {
      const a = await requireActor(["owner", "manager"]);
      const rows = await query<Booking>(
        "SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10000",
      );
      await audit(a.id, "bookings.export");
      const content = csv([
        [
          "Nummer",
          "Name",
          "E-Mail",
          "Telefon",
          "Beginn",
          "Ende",
          "Ort",
          "Anlass",
          "Status",
          "Betrag EUR",
          "Zahlung",
        ],
        ...rows.map((b) => [
          b.reference,
          b.data.name,
          b.data.email,
          b.data.phone,
          b.start_date,
          b.end_date,
          b.data.location,
          b.data.eventType,
          b.status,
          (b.quote.totalCents / 100).toFixed(2),
          b.payment_status,
        ]),
      ]);
      return new Response(content, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="THE-BOXX-Buchungen.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "admin/calendar" && method === "GET") {
      await requireActor();
      const month = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .parse(url.searchParams.get("month"));
      const start = month + "-01",
        end = new Date(
          Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10);
      const bookings = await query(
        "SELECT id,reference,start_date,end_date,status,data->>'name' AS name FROM bookings WHERE start_date<=$2 AND end_date>=$1 ORDER BY start_date",
        [start, end],
      );
      let external: string[] = [];
      let warning = "";
      try {
        const { externalBusy } = await import("./google");
        external = await externalBusy((await getSettings()).data, start, end);
      } catch {
        warning = "Externe Kalenderdaten derzeit nicht verfügbar.";
      }
      return json({ bookings, external, warning });
    }
    if (path.startsWith("admin/bookings/") && method === "PATCH") {
      const a = await requireActor(["owner", "manager"]);
      const id = idSchema.parse(path.split("/")[2]);
      const v = z
        .object({
          version: z.number().int(),
          status: z.enum(["requested", "confirmed", "completed", "cancelled"]),
          notes: z.string().max(8000),
          paymentStatus: z.enum(["open", "paid"]),
          paymentNote: z.string().max(1000),
          location: z.string().trim().min(3).max(350),
          startDate: z.string().refine(validDate),
          endDate: z.string().refine(validDate),
          startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          notifyCustomer: z.boolean(),
        })
        .parse(await body(req));
      const b = await updateBooking(id, a, v);
      asyncJobs();
      return json({ booking: b });
    }
    if (path === "admin/settings" && method === "PATCH") {
      const a = await requireActor(["owner"]);
      const v = z
        .object({ version: z.number().int(), data: settingsSchema })
        .parse(await body(req));
      if (v.data.bookingsEnabled) await assertReady(v.data);
      if (v.data.calendarId) {
        const calendars = await listCalendars();
        if (
          !calendars.some(
            (c) =>
              c.id === v.data.calendarId &&
              ["owner", "writer"].includes(c.role),
          ) ||
          v.data.blockedCalendarIds.some(
            (id) =>
              !calendars.some(
                (c) =>
                  c.id === id && ["owner", "writer", "reader"].includes(c.role),
              ),
          )
        )
          throw new AppError(
            400,
            "Bitte zugängliche Kalender wählen; der Buchungskalender benötigt Schreibrechte.",
          );
      }
      await transaction(async (c) => {
        const {
          rows: [old],
        } = await c.query(
          "SELECT data,version FROM app_settings WHERE id=1 FOR UPDATE",
        );
        if (old.version !== v.version)
          throw new AppError(
            409,
            "Einstellungen wurden zwischenzeitlich geändert. Bitte neu laden.",
          );
        if (old.data.calendarId !== v.data.calendarId) {
          const {
            rows: [count],
          } = await c.query(
            "SELECT count(*)::int AS n FROM bookings WHERE occupied=true AND end_date>=CURRENT_DATE",
          );
          if (count.n > 0)
            throw new AppError(
              409,
              "Buchungskalender kann bei laufenden Reservierungen nicht gewechselt werden.",
            );
        }
        await c.query(
          "UPDATE app_settings SET data=$1,version=version+1,updated_at=now() WHERE id=1",
          [JSON.stringify(v.data)],
        );
        await audit(a.id, "settings.updated");
      });
      return json({ ok: true });
    }
    if (path === "admin/users" && method === "POST") {
      const a = await requireActor(["owner"]);
      const v = z
        .object({
          email: emailSchema,
          name: z.string().trim().min(2).max(120),
          role: z.enum(["manager", "viewer"]),
        })
        .parse(await body(req));
      await transaction(async (c) => {
        const {
          rows: [u],
        } = await c.query(
          "INSERT INTO staff(email,name,role) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id,email,name",
          [v.email, v.name, v.role],
        );
        if (!u)
          throw new AppError(
            409,
            "Dieser Account existiert bereits. Nutze die Passwort-zurücksetzen-Funktion.",
          );
        await enqueueAuth(u, "invite");
        await audit(a.id, "team.invited", null, {
          email: v.email,
          role: v.role,
        });
      });
      asyncJobs();
      return json({ ok: true });
    }
    if (path.startsWith("admin/users/") && method === "PATCH") {
      const a = await requireActor(["owner"]);
      const id = idSchema.parse(path.split("/")[2]);
      const v = z
        .object({ active: z.boolean(), role: z.enum(["manager", "viewer"]) })
        .parse(await body(req));
      await transaction(async (c) => {
        const { rowCount } = await c.query(
          "UPDATE staff SET active=$1,role=$2 WHERE id=$3 AND role<>'owner'",
          [v.active, v.role, id],
        );
        if (!rowCount)
          throw new AppError(
            400,
            "Inhaber-Account kann hier nicht verändert werden.",
          );
        await c.query("DELETE FROM sessions WHERE user_id=$1", [id]);
        await audit(a.id, "team.updated", null, { userId: id });
      });
      return json({ ok: true });
    }
    if (path === "admin/jobs/retry" && method === "POST") {
      const a = await requireActor(["owner", "manager"]);
      const v = z.object({ id: z.uuid() }).parse(await body(req));
      const [j] = await query(
        "SELECT * FROM jobs WHERE id=$1 AND status IN ('failed','pending')",
        [v.id],
      );
      if (!j)
        throw new AppError(
          409,
          "Auftrag ist bereits abgeschlossen oder in Bearbeitung.",
        );
      if (
        j.kind === "email" &&
        Date.now() - new Date(j.created_at).getTime() > 23 * 3600000
      )
        throw new AppError(
          409,
          "Bitte den Versand beim Mailanbieter prüfen. Anschließend über die Buchung eine neue Kopie anfordern.",
        );
      await query(
        "UPDATE jobs SET status='pending',attempts=0,available_at=now() WHERE id=$1 AND status IN ('failed','pending')",
        [v.id],
      );
      await audit(a.id, "job.retry", j.booking_id);
      asyncJobs();
      return json({ ok: true });
    }
    if (path === "google/calendars" && method === "GET") {
      await requireActor(["owner"]);
      return json({ calendars: await listCalendars() });
    }
    if (path === "google/connect" && method === "POST") {
      const a = await requireActor(["owner"]);
      const state = randomToken();
      const client = oauth();
      const pkce = await client.generateCodeVerifierAsync();
      await query(
        "INSERT INTO oauth_states(state_hash,user_id,verifier,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
        [hash(state), a.id, encrypt(pkce.codeVerifier)],
      );
      return json({
        url: client.generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: GOOGLE_SCOPES,
          state,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: "S256" as never,
        }),
      });
    }
    if (path === "google/callback" && method === "GET") {
      const a = await requireActor(["owner"]);
      const state = url.searchParams.get("state") ?? "";
      const [s] = await query(
        "DELETE FROM oauth_states WHERE state_hash=$1 AND user_id=$2 AND expires_at>now() RETURNING verifier",
        [hash(state), a.id],
      );
      if (!s)
        throw new AppError(
          400,
          "Google-Anmeldung abgelaufen. Bitte erneut verbinden.",
        );
      if (url.searchParams.get("error"))
        return NextResponse.redirect(baseUrl("admin") + "/admin?google=denied");
      const code = url.searchParams.get("code");
      if (!code) throw new AppError(400, "Google-Code fehlt.");
      const { decrypt } = await import("./crypto");
      const { tokens } = await oauth().getToken({
        code,
        codeVerifier: decrypt(s.verifier),
      });
      if (!tokens.refresh_token)
        throw new AppError(
          400,
          "Google hat keinen dauerhaften Zugriff erteilt. Bitte erneut verbinden.",
        );
      await storeGoogleToken(tokens.refresh_token);
      await audit(a.id, "google.connected");
      return NextResponse.redirect(
        baseUrl("admin") + "/admin?google=connected",
      );
    }
    if (path === "jobs/run" && (method === "POST" || method === "GET")) {
      if (
        !process.env.CRON_SECRET ||
        !secureEqual(
          req.headers.get("authorization") ?? "",
          `Bearer ${process.env.CRON_SECRET}`,
        )
      )
        throw new AppError(401, "Nicht erlaubt.");
      return json({ results: await runJobs(3) });
    }
    throw new AppError(404, "Nicht gefunden.");
  });
