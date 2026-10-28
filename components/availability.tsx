"use client";
import { useEffect, useState } from "react";
import { daysInRange, todayBerlin } from "@/lib/model";
import { api, Alert } from "./ui";
export default function Availability({
  start,
  end,
  onChange,
  enabled,
}: {
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
  enabled: boolean;
}) {
  const [month, setMonth] = useState(() => todayBerlin().slice(0, 7)),
    [cache, setCache] = useState<Record<string, string[]>>({}),
    [error, setError] = useState(""),
    [hint, setHint] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true);
  const [year, m] = month.split("-").map(Number),
    count = new Date(year, m, 0).getDate(),
    offset = (new Date(year, m - 1, 1).getDay() + 6) % 7;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setHint("");
    if (!enabled) {
      setLoading(false);
      return;
    }
    api<{ bookedDates: string[] }>("public/availability?month=" + month)
      .then((r) => {
        if (active) setCache((c) => ({ ...c, [month]: r.bookedDates }));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, enabled, retry]);
  const step = (by: number) => {
    const d = new Date(year, m - 1 + by, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  function choose(d: string) {
    setHint("");
    if (!start || end !== start || d < start) {
      onChange(d, d);
      return;
    }
    try {
      const range = daysInRange(start, d, 14);
      if (
        range.some(
          (x) => !cache[x.slice(0, 7)] || cache[x.slice(0, 7)].includes(x),
        )
      ) {
        setHint(
          "Dieser Zeitraum enthält belegte oder noch nicht geprüfte Tage.",
        );
        return;
      }
      onChange(start, d);
    } catch (e) {
      setHint((e as Error).message);
    }
  }
  return (
    <div className="date-picker">
      <div className="calendar-head">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Vorheriger Monat"
        >
          ←
        </button>
        <strong>
          {new Date(year, m - 1, 1).toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Nächster Monat"
        >
          →
        </button>
      </div>
      <div className="calendar-grid weekdays">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`,
            busy = (cache[month] ?? []).includes(d),
            selected = start && d >= start && d <= end;
          return (
            <button
              type="button"
              key={d}
              aria-label={d + (busy ? " belegt" : "")}
              aria-pressed={!!selected}
              className={
                (selected ? "selected " : "") + (busy ? "occupied" : "")
              }
              disabled={
                !enabled || loading || !!error || busy || d < todayBerlin()
              }
              onClick={() => choose(d)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>○ Frei</span>
        <span>╱ Belegt</span>
        <span className="red">● Deine Auswahl</span>
      </div>
      {!enabled ? (
        <p className="muted">
          Terminanfragen werden nach abgeschlossener Einrichtung freigeschaltet.
        </p>
      ) : loading ? (
        <p role="status">Verfügbarkeit wird geprüft …</p>
      ) : error ? (
        <Alert>
          {error}{" "}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Aktualisieren
          </button>
        </Alert>
      ) : hint ? (
        <Alert>{hint}</Alert>
      ) : (
        <p className="muted">
          Ersten und letzten Tag anklicken. Reserviert wird erst beim Absenden.
        </p>
      )}
    </div>
  );
}
