import { test } from "node:test";
import assert from "node:assert/strict";
import { mailConfigured, smtpOptions } from "../lib/mail-config";
import { smtpMessage } from "../lib/smtp";
const env = { MAIL_PROVIDER: "smtp", MAIL_FROM: "THE BOXX <booking@the-boxx.de>", SMTP_HOST: "the-boxx.de", SMTP_PORT: "25", SMTP_USER: "booking@the-boxx.de", SMTP_PASSWORD: "test-only" };
test("SMTP works without Resend; incomplete and invalid settings fail closed", () => {
 assert.equal(mailConfigured(env), true);
 assert.equal(mailConfigured({...env, SMTP_PASSWORD: ""}), false);
 assert.equal(mailConfigured({...env, SMTP_PORT: "995"}), false);
 assert.equal(mailConfigured({...env, MAIL_PROVIDER: "unknown"}), false);
});
test("STARTTLS is mandatory on 25/587, implicit TLS on 465; certificates stay verified", () => {
 for (const port of ["25", "587", "465"]) {
  const o = smtpOptions({...env, SMTP_PORT: port});
  assert.equal(o.secure, port === "465"); assert.equal(o.requireTLS, port !== "465");
  assert.equal(o.tls.rejectUnauthorized, true);
  assert.equal(o.disableFileAccess, true); assert.equal(o.disableUrlAccess, true);
 }
});
test("Calendar attachment and Reply-To preserved; queued sender updated; stable message ID", () => {
 process.env.MAIL_FROM = env.MAIL_FROM;
 const p = {from: "old@example.test", to: "customer@example.test", reply_to: "reply@example.test", subject: "Test", text: "Test", attachments: [{filename: "event.ics", content: Buffer.from("BEGIN:VCALENDAR").toString("base64"), content_type: "text/calendar"}]};
 const m = smtpMessage(p, "job-1");
 assert.equal(m.from, env.MAIL_FROM); assert.equal(m.replyTo, p.reply_to);
 assert.equal(m.attachments![0].content.toString(), "BEGIN:VCALENDAR");
 assert.equal(m.messageId, smtpMessage(p, "job-1").messageId);
 assert.notEqual(m.messageId, smtpMessage(p, "job-2").messageId);
});
