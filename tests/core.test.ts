import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  defaultSettings,
  quote,
  validDate,
  daysInRange,
  bookingSchema,
  settingsSchema,
  type Booking,
} from "../lib/model";
import {
  calendarFile,
  berlinInstant,
  busyDays,
  foldLine,
  googleCalendarLink,
} from "../lib/calendar";
import {
  encrypt,
  decrypt,
  signToken,
  checkToken,
  hashPassword,
  verifyPassword,
} from "../lib/crypto";
import { csvCell } from "../lib/csv";
import { body, sameOrigin, publicMode, adminMode } from "../lib/http";
import { deployment } from "../lib/deployment";

const b: Booking = {
  id: randomUUID(),
  reference: "BX-TEST",
  start_date: "2027-06-01",
  end_date: "2027-06-02",
  status: "requested",
  occupied: true,
  data: {
    name: "Änne Muster",
    email: "customer@example.test",
    phone: "01234567",
    location: "Straße 1; Chemnitz\nSaal A",
    eventType: "Geburtstag",
    guestCount: 80,
    startDate: "2027-06-01",
    endDate: "2027-06-02",
    startTime: "18:00",
    endTime: "01:00",
    message: "Hallo!",
    printerId: "printer-300",
    addOns: ["photo-design"],
    consent: true,
    companyWebsite: "",
    catalogVersion: 1,
    requestKey: randomUUID(),
  },
  quote: quote(defaultSettings, "2027-06-01", "2027-06-02", "printer-300", [
    "photo-design",
  ]),
  version: 1,
  notes: "PRIVATE",
  payment_status: "open",
  payment_note: "PRIVATE",
  google_event_id: null,
  google_calendar_id: null,
  calendar_synced_at: null,
  created_at: "2026-10-05T12:00:00Z",
  updated_at: "2026-10-05T12:00:00Z",
};
test("Live quote: base per day, printer exclusive, extras once", () => {
  assert.equal(b.quote.totalCents, 19900 * 2 + 17000 + 2500);
  assert.equal(b.quote.lines.length, 3);
  assert.throws(() =>
    quote(defaultSettings, "2027-01-01", "2027-01-01", "photo-design", []),
  );
  assert.throws(() =>
    quote(defaultSettings, "2027-01-01", "2027-01-01", "none", ["printer-300"]),
  );
  assert.throws(() =>
    quote(defaultSettings, "2027-01-01", "2027-01-01", "none", ["usb", "usb"]),
  );
});
test("Invalid, backwards and overlong date ranges rejected", () => {
  assert.equal(validDate("2027-02-30"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.throws(() => daysInRange("2027-01-02", "2027-01-01"));
  assert.throws(() => daysInRange("2027-01-01", "2027-01-15", 14));
  assert.equal(daysInRange("2027-01-28", "2027-02-02").length, 6);
});
test("Server schema requires consent and valid dates; prices are not accepted from browser", () => {
  assert.equal(
    bookingSchema.safeParse({ ...b.data, consent: false }).success,
    false,
  );
  assert.equal(
    bookingSchema.safeParse({ ...b.data, startDate: "2027-02-30" }).success,
    false,
  );
  assert.equal(
    bookingSchema.safeParse({ ...b.data, totalCents: 1 }).success,
    true,
  );
  assert.equal(
    "totalCents" in bookingSchema.parse({ ...b.data, totalCents: 1 }),
    false,
  );
  assert.equal(
    bookingSchema.safeParse({ ...b.data, companyWebsite: "spam" }).success,
    false,
  );
  assert.equal(
    bookingSchema.safeParse({
      ...b.data,
      startDate: "2027-06-01",
      endDate: "2027-06-01",
      endTime: "01:00",
    }).success,
    false,
  );
});
test("Settings reject duplicate service IDs and negative prices", () => {
  assert.equal(
    settingsSchema.safeParse({ ...defaultSettings, basePriceCents: -1 })
      .success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      ...defaultSettings,
      options: [defaultSettings.options[0], defaultSettings.options[0]],
    }).success,
    false,
  );
});
test("Berlin calendar conversion handles winter, summer, midnight and exclusive Google end dates", () => {
  assert.equal(
    berlinInstant("2027-01-10", "18:00"),
    "2027-01-10T17:00:00.000Z",
  );
  assert.equal(
    berlinInstant("2027-06-10", "18:00"),
    "2027-06-10T16:00:00.000Z",
  );
  assert.deepEqual(busyDays("2027-06-10", "2027-06-12"), [
    "2027-06-10",
    "2027-06-11",
  ]);
  assert.deepEqual(
    busyDays("2027-06-10T23:00:00+02:00", "2027-06-11T00:00:00+02:00"),
    ["2027-06-10"],
  );
});
test("ICS is CRLF, escapes user values, stable UID, no internal notes", () => {
  const text = calendarFile(b);
  assert.match(text, /DTSTART:20270601T160000Z/);
  assert.match(text, /DTEND:20270601T230000Z/);
  assert.match(text, /Straße 1\\; Chemnitz\\nSaal A/);
  assert.ok(text.includes(`UID:${b.id}@theboxx-booking`));
  assert.equal(text.includes("PRIVATE"), false);
  assert.match(text, /STATUS:TENTATIVE/);
  assert.match(
    calendarFile({ ...b, status: "cancelled", version: 2 }),
    /STATUS:CANCELLED/,
  );
  assert.ok(!text.replaceAll("\r\n", "").includes("\n"));
  assert.ok(
    new URL(googleCalendarLink(b)).searchParams.get("dates")?.includes("/"),
  );
});
test("UTF-8 calendar folding remains within RFC limit", () => {
  for (const line of foldLine("DESCRIPTION:" + "ä😀".repeat(120)).split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
test("Secrets are encrypted, authenticated and purpose-bound", () => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  const enc = encrypt("secret-refresh-token");
  assert.notEqual(enc, "secret-refresh-token");
  assert.equal(decrypt(enc), "secret-refresh-token");
  assert.throws(() => decrypt(enc.slice(0, -3) + "aaa"));
  const t = signToken("receipt:one", 100);
  assert.equal(checkToken(t, "receipt:one"), true);
  assert.equal(checkToken(t, "receipt:two"), false);
  assert.equal(checkToken(t + "X", "receipt:one"), false);
  assert.equal(checkToken(signToken("one", -1), "one"), false);
});
test("Passwords use salted scrypt, never plaintext", async () => {
  const a = await hashPassword("Long-unique-password!");
  const c = await hashPassword("Long-unique-password!");
  assert.notEqual(a, c);
  assert.ok(await verifyPassword("Long-unique-password!", a));
  assert.equal(await verifyPassword("wrong", a), false);
});
test("CSV neutralizes formula injection and escapes quotes", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell(" +cmd"), '"\' +cmd"');
  assert.equal(csvCell("Normal"), '"Normal"');
});
test("Request origin and size guards reject cross-origin and oversized input", async () => {
  process.env.BOOKING_URL = "https://booking.example.test";
  process.env.ADMIN_URL = "https://admin.example.test";
  const ownOrigin =
    deployment.mode === "admin"
      ? process.env.ADMIN_URL
      : process.env.BOOKING_URL;
  const otherOrigin =
    deployment.mode === "admin"
      ? process.env.BOOKING_URL
      : process.env.ADMIN_URL;
  process.env.APP_MODE = deployment.mode === "admin" ? "booking" : "admin";
  assert.throws(() =>
    sameOrigin(
      new Request("https://admin.example.test/api/auth/login", {
        headers: { origin: "https://evil.test" },
      }),
    ),
  );
  assert.throws(() =>
    sameOrigin(
      new Request("https://admin.example.test/api/auth/login", {
        headers: { origin: otherOrigin },
      }),
    ),
  );
  sameOrigin(
    new Request("https://admin.example.test/api/auth/login", {
      headers: { origin: ownOrigin },
    }),
  );
  await assert.rejects(
    body(
      new Request("https://admin.example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(91000),
      }),
    ),
  );
  if (deployment.mode === "booking") {
    assert.throws(adminMode);
    publicMode();
  } else {
    assert.throws(publicMode);
    adminMode();
  }
});
