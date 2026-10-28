import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { defaultSettings } from "../lib/model";
test("PostgreSQL schema: shared data, exclusion, idempotency, rollback and version conflicts", async () => {
  const db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../database/001_init.sql", import.meta.url),
      "utf8",
    ),
  );
  const insert = async (start: string, end: string, key = randomUUID()) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO bookings(id,reference,request_key,request_hash,start_date,end_date,data,quote,terms_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id, "BX-" + id, key, "hash", start, end, "{}", "{}", "{}"],
    );
    return id;
  };
  try {
    const requestKey = randomUUID(),
      id = await insert("2027-06-01", "2027-06-02", requestKey);
    await assert.rejects(
      insert("2027-06-02", "2027-06-03"),
      (e: unknown) => (e as { code: string }).code === "23P01",
    );
    await assert.rejects(
      insert("2027-07-01", "2027-07-01", requestKey),
      (e: unknown) => (e as { code: string }).code === "23505",
    );
    await insert("2027-06-03", "2027-06-03");
    // Cancellation alone cannot reopen a date until Google deletion has succeeded.
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [id]);
    await assert.rejects(insert("2027-06-01", "2027-06-01"));
    await db.query("UPDATE bookings SET occupied=false WHERE id=$1", [id]);
    await insert("2027-06-01", "2027-06-01");
    await db.query("INSERT INTO app_settings(id,data) VALUES(1,$1)", [
      JSON.stringify(defaultSettings),
    ]);
    const first = await db.query<{ version: number }>(
      "SELECT version FROM app_settings WHERE id=1",
    );
    const version = first.rows[0].version;
    const a = await db.query(
      "UPDATE app_settings SET version=version+1,data=jsonb_set(data,'{basePriceCents}','25000') WHERE id=1 AND version=$1 RETURNING version",
      [version],
    );
    assert.equal(a.rows.length, 1);
    const stale = await db.query(
      "UPDATE app_settings SET version=version+1 WHERE id=1 AND version=$1 RETURNING version",
      [version],
    );
    assert.equal(stale.rows.length, 0);
    const otherAccount = await db.query<{ price: number }>(
      "SELECT (data->>'basePriceCents')::int AS price FROM app_settings WHERE id=1",
    );
    assert.equal(otherAccount.rows[0].price, 25000);
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO jobs(unique_key,kind,payload) VALUES('rollback','email','{}')",
        );
        throw new Error("failed");
      }),
    );
    assert.equal(
      (await db.query("SELECT id FROM jobs WHERE unique_key='rollback'")).rows
        .length,
      0,
    );
    await db.query(
      "INSERT INTO jobs(unique_key,kind,payload) VALUES('once','email','{}')",
    );
    await db.query(
      "INSERT INTO jobs(unique_key,kind,payload) VALUES('once','email','{}') ON CONFLICT(unique_key) DO NOTHING",
    );
    assert.equal(
      (await db.query("SELECT id FROM jobs WHERE unique_key='once'")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
