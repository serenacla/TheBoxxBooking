import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { smtpOptions } from "./mail-config";
import type { MailPayload } from "./mail";
export function smtpMessage(payload: MailPayload, key: string) {
  return {
    // Old queued payloads may still carry a previous provider's sender.
    from: process.env.MAIL_FROM!, to: payload.to, replyTo: payload.reply_to,
    subject: payload.subject, text: payload.text,
    messageId: `<${createHash("sha256").update(key).digest("hex")}@the-boxx.de>`,
    attachments: payload.attachments?.map(a => ({
      filename: a.filename, content: Buffer.from(a.content, "base64"), contentType: a.content_type,
    })),
  };
}
export async function sendSmtp(payload: MailPayload, key: string) {
  const transport = nodemailer.createTransport(smtpOptions());
  try {
    const result = await transport.sendMail(smtpMessage(payload, key));
    if (!result.accepted.length || result.rejected.length)
      throw new Error("SMTP-Empfänger wurde nicht angenommen.");
    return result.messageId;
  } catch (error) {
    // Never persist raw SMTP responses: they can contain addresses or credentials.
    const code = (error as {code?: string})?.code;
    if (code === "EAUTH") throw new Error("SMTP-Anmeldung fehlgeschlagen. Benutzername und Postfachpasswort prüfen.");
    if (code === "ETLS" || code?.startsWith("CERT_") || code === "ESOCKET")
      throw new Error("SMTP-Verbindung/TLS fehlgeschlagen. Hostname, Port und Zertifikat prüfen.");
    throw new Error("SMTP-Versand nicht bestätigt. Vor erneutem Senden Eingang beim Empfänger prüfen; möglicherweise wurde die Mail bereits angenommen.");
  } finally { transport.close(); }
}
