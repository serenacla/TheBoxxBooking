"use client";
import { useEffect, useState } from "react";
import { Logo, api, Alert } from "./ui";
import { money, dateLabel, statusLabels, type Booking } from "@/lib/model";
type ReceiptData = {
  reference: string;
  status: Booking["status"];
  data: {
    name: string;
    location: string;
    eventType: string;
    startTime: string;
    endTime: string;
  };
  startDate: string;
  endDate: string;
  quote: Booking["quote"];
  googleUrl: string;
  calendarSynced: boolean;
  emailAccepted: boolean;
  emailFailed: boolean;
  jobsPending: boolean;
};
export default function Receipt({ id, token }: { id: string; token: string }) {
  const [data, setData] = useState<ReceiptData | null>(null),
    [error, setError] = useState("");
  const path = `receipt/${id}?token=${encodeURIComponent(token)}`;
  useEffect(() => {
    let active = true;
    const load = () =>
      api<ReceiptData>(path)
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path]);
  return (
    <main className="receipt-shell">
      <a href="/">
        <Logo />
      </a>
      <section className="receipt-card">
        {error ? (
          <Alert>{error}</Alert>
        ) : !data ? (
          <p>Bestätigung wird geladen …</p>
        ) : (
          <>
            <div className="success-mark">✓</div>
            <p className="eyebrow">
              {data.reference} · {statusLabels[data.status]}
            </p>
            <h1>
              {data.status === "cancelled"
                ? "Anfrage storniert."
                : data.status === "confirmed"
                  ? "Alles bereit für eure Feier."
                  : "Euer Moment ist vorgemerkt."}
            </h1>
            <p>
              Hallo {data.data.name},{" "}
              {data.status === "requested"
                ? "deine Anfrage ist gespeichert und der Zeitraum in unserem Buchungssystem reserviert. Wir melden uns mit allen weiteren Details."
                : "hier findest du den aktuellen Stand deiner Buchung."}
            </p>
            <div className="receipt-details">
              <span>
                Zeitraum
                <b>
                  {dateLabel(data.startDate)} {data.data.startTime}
                  <br />
                  bis {dateLabel(data.endDate)} {data.data.endTime}
                </b>
              </span>
              <span>
                Ort<b>{data.data.location}</b>
              </span>
              <span>
                Event<b>{data.data.eventType}</b>
              </span>
            </div>
            <div className="detail-quote">
              {data.quote.lines.map((l) => (
                <p key={l.name}>
                  <span>{l.name}</span>
                  <b>{money(l.cents)}</b>
                </p>
              ))}
              <p className="total">
                <span>Gesamt</span>
                <b>{money(data.quote.totalCents)}</b>
              </p>
            </div>
            <p className="muted">
              {data.emailFailed
                ? "Deine Anfrage ist gespeichert, der E-Mail-Versand konnte aber noch nicht abgeschlossen werden. Bewahre diesen Link auf und kontaktiere THE BOXX, falls keine Nachricht eintrifft."
                : data.emailAccepted
                  ? "Eine E-Mail wurde vom Versanddienst angenommen. Bitte auch im Spam-Ordner nachsehen."
                  : "Die Bestätigung ist für den E-Mail-Versand vorgemerkt."}{" "}
              {data.calendarSynced
                ? "Der Betriebskalender ist abgeglichen."
                : "Der Betriebskalender wird im Hintergrund abgeglichen."}
            </p>
            {data.status !== "cancelled" && (
              <div className="receipt-actions">
                <a
                  className="button"
                  href={data.googleUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Kalender ↗
                </a>
                <a
                  className="button secondary"
                  href={`/api/receipt/${id}/calendar?token=${encodeURIComponent(token)}`}
                >
                  iPhone / Kalenderdatei ↓
                </a>
              </div>
            )}
            <p className="muted">
              Kalenderdateien lassen sich auch in Apple Kalender und Outlook
              öffnen. Spätere Änderungen an importierten Terminen bitte selbst
              übernehmen. Bewahre diesen privaten Bestätigungslink auf.
            </p>
            <a className="link" href="/">
              Zurück zur Website
            </a>
          </>
        )}
      </section>
    </main>
  );
}
