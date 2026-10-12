import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deployment } from "../lib/deployment";
import { route } from "../lib/router";
import { adminDestination } from "../lib/links";
import { configurationIssues } from "../lib/configuration";

test("Fixed deployment rejects the other surface before database access or body parsing", async () => {
  delete process.env.DATABASE_URL;
  process.env.APP_MODE = deployment.mode === "booking" ? "admin" : "booking";
  const paths =
    deployment.mode === "booking"
      ? ["admin/state", "auth/login", "google/callback", "admin/bookings"]
      : [
          "public/config",
          "public/availability",
          "public/bookings",
          "preview",
          "receipt/" + randomUUID(),
        ];
  for (const path of paths) {
    for (const method of ["GET", "POST"]) {
      const response = await route(
        new Request("https://boxx.example.test/api/" + path, { method }),
      );
      assert.equal(response.status, 404, path + " " + method);
    }
  }
});

test("Health reports the deployed archive identity without secrets", async () => {
  const response = await route(
    new Request("https://boxx.example.test/api/health"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: deployment.mode,
    version: "2.1.0",
  });
});

test("Booking links survive sign-in without allowing an external redirect", () => {
  const id = randomUUID();
  assert.equal(adminDestination(id), "/admin?booking=" + id);
  for (const value of [
    undefined,
    ["x"],
    "//evil.example",
    "https://evil.example",
    id + "&next=bad",
  ]) {
    assert.equal(adminDestination(value), "/admin");
  }
});

test("Setup check catches mixed URLs, missing secrets and incorrect Google callback", () => {
  const good: Record<string, string | undefined> = {
    BOOKING_URL: "https://booking.example.test",
    ADMIN_URL: "https://admin.example.test",
    DATABASE_URL: "postgresql://user:password@db.example.test/boxx",
    ENCRYPTION_KEY: "a".repeat(64),
    CRON_SECRET: "b".repeat(64),
    RESEND_API_KEY: "test-key",
    MAIL_FROM: "THE BOXX <boxx@example.test>",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_REDIRECT_URI: "https://admin.example.test/api/google/callback",
    PREVIEW_ACCESS_ENABLED: "false",
  };
  assert.deepEqual(configurationIssues(good), []);
  assert.ok(
    configurationIssues({ ...good, ADMIN_URL: good.BOOKING_URL }).length,
  );
  assert.ok(
    configurationIssues({
      ...good,
      BOOKING_URL: "https://booking.example.test/path",
    }).length,
  );
  assert.ok(configurationIssues({ ...good, ENCRYPTION_KEY: "" }).length);
  assert.ok(
    configurationIssues({
      ...good,
      GOOGLE_REDIRECT_URI: "https://booking.example.test/api/google/callback",
    }).length,
  );
  assert.equal(
    configurationIssues({}).some((s) => s.includes("DATABASE_URL")),
    true,
  );
});
