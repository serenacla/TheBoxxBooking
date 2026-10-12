"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  defaultSettings,
  money,
  quote,
  dateLabel,
  type Settings,
} from "@/lib/model";
import { Logo, Field, api, Alert } from "./ui";
import Availability from "./availability";
import ScrollStory from "./scroll-story";
type Config = Settings & { version: number; setupRequired?: boolean };
export default function BookingSite() {
  const [config, setConfig] = useState<Config>({
      ...defaultSettings,
      version: 0,
    }),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [printer, setPrinter] = useState("none"),
    [extras, setExtras] = useState<string[]>([]),
    [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState("");
  useEffect(() => {
    setRequestKey(crypto.randomUUID());
    api<Config>("public/config")
      .then(setConfig)
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (sending) return;
    const check = () =>
      api<Config>("public/config")
        .then((c) => {
          if (c.version !== config.version) {
            setConfig(c);
            setPrinter("none");
            setExtras([]);
            setNotice(
              "Die Leistungen oder Preise wurden aktualisiert. Bitte prüfe deine Auswahl.",
            );
            setRequestKey(crypto.randomUUID());
          }
        })
        .catch(() => {});
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [config.version, sending]);
  let q: ReturnType<typeof quote> | null = null;
  try {
    q = quote(config, start, end, printer, extras);
  } catch {}
  const active = config.options.filter((o) => o.active),
    selected = active.filter((o) => o.id === printer || extras.includes(o.id));
  const total =
    q?.totalCents ??
    config.basePriceCents + selected.reduce((n, o) => n + o.priceCents, 0);
  const enabled = !loading && !config.setupRequired && config.bookingsEnabled;
  const change = () => {
    setError("");
    setRequestKey(crypto.randomUUID());
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q) return;
    setSending(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{ id: string; reference: string; token: string }>(
        "public/bookings",
        "POST",
        {
          ...fields,
          guestCount: Number(fields.guestCount),
          consent: fields.consent === "on",
          startDate: start,
          endDate: end,
          printerId: printer,
          addOns: extras,
          catalogVersion: config.version,
          requestKey,
        },
      );
      location.assign(
        `/bestaetigung/${r.id}?token=${encodeURIComponent(r.token)}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }
  return (
    <main className="booking-site">
      <header className="public-header">
        <a href="#top" aria-label="THE BOXX Startseite">
          <Logo light />
        </a>
        <nav>
          <a href="#konfigurator">Konfigurator</a>
          <a href="#momente">Momente</a>
          <a href="#faq">Fragen</a>
        </nav>
        <a className="button outline" href="#konfigurator">
          Deine Boxx ↗
        </a>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Fotobox · Chemnitz, Zwickau & Umgebung</p>
          <h1>
            Deine Party.
            <br />
            Eure Menschen.
            <br />
            <em>Für immer.</em>
          </h1>
          <p>
            Wir erinnern uns an deine Party. Stell deine Fotobox so zusammen,
            wie sie zu euch passt.
          </p>
          <a className="button" href="#konfigurator">
            Boxx zusammenstellen ↗
          </a>
          <span className="hero-note">
            Kein Paketzwang. Keine Online-Zahlung.
          </span>
        </div>
        <div className="hero-object" aria-hidden="true">
          <div className="hero-camera">
            <span>
              THE BOXX<span className="red">.</span>
            </span>
            <i />
            <div>
              3 · 2 · 1<br />
              <small>DEIN MOMENT</small>
            </div>
            <b />
          </div>
          <span className="orbit-label">
            GOOD TIMES
            <br />
            GREAT MEMORIES
          </span>
        </div>
        <small className="hero-bottom">
          01 — DEINE ERINNERUNG BEGINNT HIER ↓
        </small>
      </section>
      <section className="section configurator" id="konfigurator">
        <div className="section-title">
          <div>
            <p className="eyebrow">Deine Auswahl. Dein Event.</p>
            <h2>
              Einfach du.
              <br />
              <em>Einfach deine Boxx.</em>
            </h2>
          </div>
          <p>
            Termin wählen. Drucker und Extras hinzufügen. Alle Preise sofort im
            Blick.
          </p>
        </div>
        {(notice || !enabled) && (
          <Alert>
            {notice ||
              "Vorschau: Preise und Einrichtung müssen vor echten Anfragen im Team-Dashboard freigegeben werden."}
          </Alert>
        )}
        <div className="builder-layout">
          <div className="builder-main">
            <section className="card">
              <div className="step">
                <span>01</span>
                <h3>Wann wird gefeiert?</h3>
              </div>
              <Availability
                start={start}
                end={end}
                enabled={enabled && !sending}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                  change();
                }}
              />
              <div className="date-summary">
                {start
                  ? `${dateLabel(start)} – ${dateLabel(end)}`
                  : "Noch kein Zeitraum ausgewählt"}
                {start && (
                  <button
                    type="button"
                    disabled={sending}
                    className="link"
                    onClick={() => {
                      setStart("");
                      setEnd("");
                      change();
                    }}
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
            </section>
            <section className="card">
              <div className="step">
                <span>02</span>
                <h3>Die Basis für gute Zeiten.</h3>
                <b>{money(config.basePriceCents)} / Tag</b>
              </div>
              <div className="included">
                {config.included.map((x) => (
                  <span key={x}>✓ {x}</span>
                ))}
              </div>
              <p className="muted">
                Grundpreis pro Kalendertag. Extras einmalig je Anfrage.
              </p>
            </section>
            <section className="card">
              <div className="step">
                <span>03</span>
                <h3>Digital oder direkt in der Hand?</h3>
              </div>
              <div className="option-list">
                <button
                  type="button"
                  disabled={sending}
                  className={"option " + (printer === "none" ? "active" : "")}
                  aria-pressed={printer === "none"}
                  onClick={() => {
                    setPrinter("none");
                    change();
                  }}
                >
                  <span className="option-check">
                    {printer === "none" ? "✓" : "○"}
                  </span>
                  <span>
                    <b>Ohne Drucker</b>
                    <small>Alle Erinnerungen digital.</small>
                  </span>
                  <strong>Inklusive</strong>
                </button>
                {active
                  .filter((o) => o.category === "printer")
                  .map((o) => (
                    <button
                      type="button"
                      disabled={sending}
                      key={o.id}
                      className={"option " + (printer === o.id ? "active" : "")}
                      aria-pressed={printer === o.id}
                      onClick={() => {
                        setPrinter(o.id);
                        change();
                      }}
                    >
                      <span className="option-check">
                        {printer === o.id ? "✓" : "○"}
                      </span>
                      <span>
                        <b>{o.name}</b>
                        <small>{o.description}</small>
                      </span>
                      <strong>+ {money(o.priceCents)}</strong>
                    </button>
                  ))}
              </div>
            </section>
            <section className="card">
              <div className="step">
                <span>04</span>
                <h3>Mach es zu eurem Moment.</h3>
              </div>
              <div className="option-list">
                {active
                  .filter((o) => o.category === "extra")
                  .map((o) => (
                    <button
                      type="button"
                      disabled={sending}
                      key={o.id}
                      className={
                        "option " + (extras.includes(o.id) ? "active" : "")
                      }
                      aria-pressed={extras.includes(o.id)}
                      onClick={() => {
                        setExtras((xs) =>
                          xs.includes(o.id)
                            ? xs.filter((x) => x !== o.id)
                            : [...xs, o.id],
                        );
                        change();
                      }}
                    >
                      <span className="option-check">
                        {extras.includes(o.id) ? "✓" : "+"}
                      </span>
                      <span>
                        <b>{o.name}</b>
                        <small>{o.description}</small>
                      </span>
                      <strong>+ {money(o.priceCents)}</strong>
                    </button>
                  ))}
              </div>
            </section>
            <section className="card" id="anfrage">
              <div className="step">
                <span>05</span>
                <h3>Fast geschafft.</h3>
              </div>
              <p>
                Deine Anfrage reserviert den Zeitraum. Die weiteren Details und
                Zahlungsinformationen erhältst du persönlich von uns.
              </p>
              <form onSubmit={submit} onChange={change}>
                <fieldset disabled={sending}>
                  <div className="form-grid">
                    <Field label="Beginn am ersten Tag *">
                      <input
                        name="startTime"
                        type="time"
                        defaultValue="18:00"
                        required
                      />
                    </Field>
                    <Field label="Ende am letzten Tag *">
                      <input
                        name="endTime"
                        type="time"
                        defaultValue="23:00"
                        required
                      />
                    </Field>
                    <Field label="Veranstaltungsort & Adresse *" wide>
                      <input
                        name="location"
                        required
                        maxLength={350}
                        placeholder="Straße, Hausnummer, PLZ, Ort"
                      />
                    </Field>
                    <Field label="Anlass *">
                      <select name="eventType" required defaultValue="">
                        <option value="" disabled>
                          Bitte auswählen
                        </option>
                        {[
                          "Hochzeit",
                          "Geburtstag",
                          "Firmenfeier",
                          "Weihnachtsfeier",
                          "Messe / Pop-up",
                          "Vereinsfest",
                          "Sonstiges",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Gästezahl *">
                      <input
                        name="guestCount"
                        type="number"
                        min="1"
                        max="100000"
                        required
                      />
                    </Field>
                    <Field label="Vor- und Nachname *" wide>
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </Field>
                    <Field label="E-Mail *">
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    </Field>
                    <Field label="Telefon *">
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        minLength={5}
                        maxLength={60}
                      />
                    </Field>
                    <Field label="Wünsche & Hinweise" wide>
                      <textarea name="message" rows={3} maxLength={3000} />
                    </Field>
                    <label className="honeypot" aria-hidden="true">
                      Website
                      <input
                        name="companyWebsite"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </label>
                    <label className="checkbox full">
                      <input name="consent" type="checkbox" required />
                      <span>
                        Ich habe{" "}
                        <a
                          href="/rechtliches#datenschutz"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Datenschutz
                        </a>{" "}
                        und{" "}
                        <a
                          href="/rechtliches#bedingungen"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Buchungsbedingungen
                        </a>{" "}
                        gelesen und frage den gewählten Zeitraum verbindlich an.
                        Eine Zahlung erfolgt hier nicht. *
                      </span>
                    </label>
                  </div>
                  <button
                    className="button full-width"
                    disabled={!q || !enabled || sending}
                  >
                    {sending
                      ? "Anfrage wird gespeichert …"
                      : !start
                        ? "Zuerst Zeitraum wählen"
                        : `Für ${money(total)} verbindlich anfragen ↗`}
                  </button>
                  {error && <Alert>{error}</Alert>}
                  <p className="muted">
                    Nach dem Absenden: Eingangsbestätigung per E-Mail und Termin
                    für Google- oder iPhone-Kalender.
                  </p>
                </fieldset>
              </form>
            </section>
          </div>
          <aside className="order-summary">
            <p className="eyebrow">Deine Zusammenstellung</p>
            <h3>
              Gute Wahl<span className="red">.</span>
            </h3>
            <div className="summary-date">
              {start
                ? `${dateLabel(start)} – ${dateLabel(end)}`
                : "Dein Datum fehlt noch"}
            </div>
            <div className="summary-lines">
              {(
                q?.lines ?? [
                  { name: "THE BOXX · 1 Tag", cents: config.basePriceCents },
                  ...selected.map((o) => ({
                    name: o.name,
                    cents: o.priceCents,
                  })),
                ]
              ).map((l) => (
                <p key={l.name}>
                  <span>{l.name}</span>
                  <b>{money(l.cents)}</b>
                </p>
              ))}
            </div>
            <div className="summary-total">
              <span>Gesamt</span>
              <b>{money(total)}</b>
            </div>
            <p>{config.priceNote}</p>
            <a
              className="button full-width"
              href={start ? "#anfrage" : "#konfigurator"}
            >
              {start ? "Daten eintragen" : "Termin auswählen"} ↗
            </a>
            <small>Keine Zahlung auf dieser Website.</small>
          </aside>
        </div>
      </section>
      <ScrollStory />
      <section className="section moments" id="momente">
        <p className="eyebrow">Echte Momente</p>
        <h2>
          Das bleibt.
          <br />
          <em>Nicht nur auf Fotos.</em>
        </h2>
        <p>Platz für eure echten Eventbilder. Noch keine Kundenreferenzen.</p>
        <div className="moment-grid">
          {["Hochzeit", "Geburtstag", "Firmenevent", "Lieblingsmoment"].map(
            (name, i) => (
              <article key={name}>
                <div className="gallery-placeholder">
                  <span>0{i + 1}</span>
                  <b>
                    Hier kommt euer
                    <br />
                    Eventfoto hin.
                  </b>
                </div>
                <h3>{name}</h3>
              </article>
            ),
          )}
        </div>
      </section>
      <section className="section faq" id="faq">
        <h2>
          Gut zu
          <br />
          <em>wissen.</em>
        </h2>
        <div>
          {[
            [
              "Muss ich sofort bezahlen?",
              "Nein. Du sendest eine Buchungsanfrage. Die Zahlung wird anschließend mit THE BOXX abgestimmt.",
            ],
            [
              "Wann ist der Termin reserviert?",
              "Erst nach erfolgreichem Absenden, nicht schon durch das Anklicken eines Datums. Die Reservierung wird zentral gespeichert und mit dem verbundenen Google Kalender abgeglichen.",
            ],
            [
              "Wie übernehme ich den Termin?",
              "In deiner Bestätigung findest du einen Google-Kalender-Link und eine .ics-Datei für Apple Kalender, Outlook und andere Kalender.",
            ],
            [
              "Wie ändere oder storniere ich meine Anfrage?",
              "Antworte auf unsere E-Mail. Das Team verwaltet Änderungen zentral und sendet dir eine Aktualisierung. Bereits importierte Termine im persönlichen Kalender werden nicht automatisch synchronisiert.",
            ],
          ].map(([title, text]) => (
            <details key={title}>
              <summary>
                {title}
                <span>+</span>
              </summary>
              <p>{text}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="public-footer">
        <Logo light />
        <p>Wir erinnern uns an deine Party.</p>
        <div>
          <a href="/rechtliches#impressum">Impressum</a>
          <a href="/rechtliches#datenschutz">Datenschutz</a>
          <a href="/rechtliches#bedingungen">Buchungsbedingungen</a>
          <a
            href="https://www.instagram.com/theboxx_official/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram ↗
          </a>
        </div>
        <small>© {new Date().getFullYear()} THE BOXX</small>
      </footer>
    </main>
  );
}
