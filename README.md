# THE BOXX · Buchung · 2.1.0

Dieses Repository enthält die **Buchung**. Das zweite ZIP enthält die **Verwaltung**. Jede ZIP-Datei wird in ein eigenes GitHub-Repository hochgeladen und als eigenes Netlify-Projekt veröffentlicht. Die Rolle ist im Code festgelegt; `APP_MODE` ist nicht mehr erforderlich und wird ignoriert.

Beide Projekte gehören zur selben Version und verwenden **eine gemeinsame PostgreSQL-Datenbank**. Gleiche Preise, Leistungen, Anfragen und Einstellungen gelten für alle Team-Accounts. Es gibt keine Basic-/Premium-/Business-Pakete und keine Online-Zahlung. Der sichtbare Konfigurator arbeitet mit Grundpreis, einem optionalen Drucker und einzeln wählbaren Extras.

## 1. Schnellstart und Projektaufteilung

Beginne mit `START-HIER.md`. Die ZIPs enthalten Projektdateien direkt im Hauptverzeichnis. `package.json` muss nach dem Hochladen direkt im Repository liegen, nicht noch in einem Unterordner.

| ZIP / Repository | Lokale Adresse | Zweck |
| --- | --- | --- |
| THE-BOXX-Buchung-GitHub.zip / the-boxx-buchung | http://localhost:3000 | Konfigurator, Termine, Kontaktdaten, Anfrage, Bestätigung, Kalenderdatei |
| THE-BOXX-Verwaltung-GitHub.zip / the-boxx-verwaltung | http://localhost:3001 | Login, Übersicht, Buchungen, Kalender, Einstellungen, Team, CSV-Export |

Jede Website hat eigene Seiten und eigene geschützte API-Routen. Die gemeinsame serverseitige Logik und dieselbe SQL-Struktur sind in beiden Repositories enthalten. Zugangsdaten stehen nicht im Browser. Die Gegenseite wird durch feste serverseitige Rollenprüfung mit HTTP 404 abgewiesen. Die Kunden-Website enthält keine Verwaltungsseiten.

**GitHub ist die Quellcodeablage.** GitHub Pages allein kann dieses System nicht ausführen, weil Login, Datenbank und Mail-/Kalenderzugriff einen Server benötigen. Verbinde jedes Repository mit einem Next.js-fähigen Hosting, zum Beispiel Netlify. Die passende `netlify.toml` liegt bei. Keine Sites-/Cloudflare- oder Tailwind-/PostCSS-Abhängigkeit.

## 2. Gemeinsame Einrichtung

Voraussetzungen: Node.js 22.13+ innerhalb der Versionen 22–24, npm, PostgreSQL, zwei HTTPS-Websites, ein Resend-Zugang mit verifizierter Absenderdomain und ein Google-Cloud-OAuth-Web-Client mit Calendar API.

In **beiden Projektordnern**:

```bash
npm ci --include=dev
cp .env.example .env.local
```

Unter Windows kannst du `.env.example` im Explorer oder Editor als `.env.local` kopieren. Trage eure tatsächlichen Werte in diese Datei ein. Sie wird durch `.gitignore` und `.dockerignore` ausgeschlossen. Beim Hosting werden dieselben Variablen separat hinterlegt.

Zwei verschiedene Geheimnisse erzeugen; diesen Befehl zweimal ausführen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Einen Wert als `ENCRYPTION_KEY`, den anderen als `CRON_SECRET` verwenden. Beide Websites erhalten dieselben Werte. Den Verschlüsselungsschlüssel zusammen mit den Datenbankbackups sicher aufbewahren; nicht bei jedem Deployment neu erzeugen. Ein Wechsel macht verschlüsselte Integrationen und private Bestätigungslinks unbrauchbar, solange keine Migration erfolgt.

| Variable | Wert auf beiden Websites |
| --- | --- |
| `DATABASE_URL` | Verbindung zur **gleichen** PostgreSQL-Datenbank |
| `ENCRYPTION_KEY` | identischer geheimer Wert, 64 Hex-Zeichen |
| `CRON_SECRET` | identischer zufälliger Scheduler-Schlüssel |
| `BOOKING_URL` | vollständige Adresse der Kunden-Website ohne Unterpfad |
| `ADMIN_URL` | vollständige Adresse der Team-Website ohne Unterpfad |
| `RESEND_API_KEY` | serverseitiger Resend-API-Schlüssel |
| `MAIL_FROM` | verifizierter Absender, z. B. `THE BOXX <buchung@eure-domain.de>` |
| `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` | derselbe OAuth-Web-Client |
| `GOOGLE_REDIRECT_URI` | exakt `ADMIN_URL` + `/api/google/callback` |
| `PREVIEW_ACCESS_ENABLED` | Buchungswebsite: `true` bis zum Launch, danach `false` |
| `PREVIEW_ACCESS_CODE` | Buchungswebsite: bisheriger Code `TheBoxX2026` als Hosting-Secret |

Verwende die TLS-Konfiguration deines Datenbankanbieters. Keine pauschale Abschaltung der Zertifikatsprüfung. Geheimnisse niemals `NEXT_PUBLIC_...` nennen oder in Git committen. Beide URLs müssen unterschiedlich sein. Lokal sind dafür die Ports 3000 und 3001 voreingestellt.

**Einmal im Verwaltungsprojekt**, mit Verbindung zur gemeinsamen Datenbank:

```bash
npm run setup:check
npm run db:migrate
npm run admin:create
```

`setup:check` prüft die Variablen formal, ohne Geheimwerte auszugeben. Es prüft noch keine externen Zugriffsrechte. Eine unvollständige Einrichtung ergibt Exit-Code 1; vervollständige die gemeldeten Angaben. `db:migrate` richtet die Tabellen idempotent ein; bestehende Daten und Einstellungen werden beibehalten. `admin:create` fragt Name, E-Mail und Passwort im Terminal ab; es gibt kein Standardpasswort. Weitere Manager und Leser werden im Dashboard eingeladen.

Migrationen laufen absichtlich nicht im Build. `npm run build` funktioniert ohne produktive Datenbank oder externe Zugangsdaten. Wenn du ausschließlich das Design lokal ansehen möchtest, setze beim Buchungsprojekt `PREVIEW_ACCESS_ENABLED=false` und lasse `DATABASE_URL` leer; der Konfigurator zeigt Startwerte, echte Anfragen sind gesperrt. Die Verwaltungsseite zeigt ohne Datenbank den Login; echte Accounts benötigen die Einrichtung.

## 3. GitHub → Netlify

1. Für jedes ZIP ein **eigenes** frisches Repository anlegen und den entpackten Inhalt hochladen. Nicht über ein altes Next.js-/Sites-Projekt mischen.
2. Jedes Repository in einem eigenen Netlify-Projekt importieren. Basisverzeichnis leer / Repository-Hauptordner; Build `npm run build`; Publish `.next`; Node 22.
3. Die Konfiguration liegt in `netlify.toml`. Der aktuelle Next.js-Adapter wird von Netlify verwaltet; alte manuell hinzugefügte Plugin-Einträge entfernen. Für einen Umstieg vorhandenen Build-Cache einmal verwerfen.
4. In beiden Netlify-Projekten die Variablen hinterlegen. Sie müssen für die serverseitigen Functions verfügbar sein, beim Buchungsprojekt auch für die Scheduled Function. Bei eingeschränkter Scope-Auswahl Build und Functions aktivieren. Danach neu deployen.
5. Migration und erster Inhaber müssen bereits gegen diese gemeinsame Datenbank eingerichtet sein. Lege keine zweite Datenbank für die zweite Website an.
6. Auf beiden URLs `/api/health` öffnen: Erwartet werden Version `2.1.0` und `service: booking` bzw. `service: admin`. Dieser öffentliche Endpunkt meldet nur den gestarteten Code, keine Geheimnisse oder Kundendaten und keinen vollständigen Integrationsstatus.
7. In der Verwaltung anmelden, Einrichtung abschließen und einen eigenen Testdurchlauf machen. Echte Kunden erst nach diesem Test freischalten.

Branch-/Pull-Request-Previews dürfen keine produktive Datenbank erhalten, wenn dort Tests Buchungen schreiben könnten. Verwende dafür getrennte Testzugänge. Der reguläre Minutentakt der Scheduled Function läuft nur in der produktiven Veröffentlichung.

## 4. Google Kalender und E-Mails

**Google:** Calendar API im Google-Cloud-Projekt aktivieren, OAuth-Webanwendung einrichten und `https://EURE-VERWALTUNGS-URL/api/google/callback` exakt als erlaubte Weiterleitung hinterlegen. Für lokale Tests lautet sie `http://localhost:3001/api/google/callback`. Client-ID/Secret und diese Weiterleitung auf beiden Websites hinterlegen. In der Verwaltung **Einstellungen → Google verbinden** wählen. Nach der Freigabe öffnet sich wieder der Einstellungsbereich. Kalenderliste laden, einen schreibbaren Buchungskalender wählen, zusätzliche blockierende Kalender auswählen und speichern. Im externen OAuth-Testmodus können Tokens nach sieben Tagen ablaufen; für dauerhaften Betrieb den passenden Google-Veröffentlichungs-/Verifizierungsstatus einrichten.

**E-Mail:** In Resend eure Absenderdomain verifizieren und DNS-Einträge setzen. API-Schlüssel und `MAIL_FROM` auf beiden Websites hinterlegen. Unter **Einstellungen → Kontakt & Benachrichtigungen** eure Empfängeradresse und gegebenenfalls eine abweichende Antwortadresse eintragen.

Eine neue Anfrage wird zuerst zentral gespeichert und der Zeitraum reserviert. Danach werden eine Team-Mail, eine Kundenbestätigung und ein Google-Kalendereintrag verarbeitet. Die Team-Mail öffnet direkt die Buchung, auch wenn vorher ein Login erforderlich ist. Die Kundenmail enthält Angaben, Leistungen, Preis, Buchungsbedingungen, privaten Bestätigungslink, Google-Link und eine `.ics`-Datei für Apple/iPhone/Outlook. „Erledigt“ beim Mailversand bedeutet vom Anbieter angenommen; die tatsächliche Zustellung/Bounces prüft ihr beim Mailanbieter.

Kalenderzugänge und ausstehende Mailinhalte werden verschlüsselt gespeichert. Die öffentliche Verfügbarkeit zeigt nur belegte Tage. Vor jeder Anfrage werden Google-Termine erneut geprüft. Ein anderer Website-Kunde kann denselben Zeitraum wegen der PostgreSQL-Sperre nicht gleichzeitig buchen.

## 5. Hintergrundverarbeitung

Nur das **Buchungsprojekt** enthält `netlify/functions/process-jobs.ts` und den Minutentakt in `netlify.toml`. Es verarbeitet die gemeinsame Warteschlange beider Websites, also auch Teameinladungen. Die Verwaltung startet zusätzlich nach Änderungen direkte Versuche. Das Buchungsdeployment muss deshalb für automatische Wiederholungen ebenfalls aktiv sein.

Im Netlify-Buchungsprojekt unter Functions prüfen, dass `process-jobs` als geplant erscheint. Direkte Verarbeitung versucht bis zu drei Aufgaben; der geplante Aufruf bearbeitet eine Aufgabe innerhalb der Laufzeitgrenze. Fehlgeschlagene Aufgaben bleiben in **Synchronisierung** sichtbar und werden mit Wartezeit erneut versucht. Für die einzelne Fotobox ist das vorgesehen; bei größerem Volumen einen dauerhaften Worker verwenden.

Bei anderem Node.js-Hosting einmal pro Minute `npm run jobs:run` im Buchungsprojekt ausführen oder `/api/jobs/run` mit `Authorization: Bearer <CRON_SECRET>` aufrufen. Lokale Skripte lesen `.env.local`, wenn vorhanden, andernfalls bereits gesetzte Umgebungsvariablen. Nicht zwei zusätzliche unabhängige Scheduler einrichten.

Aufgaben werden atomar beansprucht; stabile Google-IDs und Mail-Idempotenzschlüssel vermeiden Wiederholungen. Bei älteren unklaren Mailversuchen wird nach 23 Stunden eine manuelle Prüfung verlangt, weil die Anbieter-Deduplizierung zeitlich begrenzt ist. Erst den Anbieterstatus prüfen, danach gegebenenfalls in der Buchung eine neue Bestätigungskopie anfordern.

## 6. Verwaltung, gemeinsamer Stand und Buchungsverhalten

- Inhaber verwalten Einstellungen, Google und Team; Manager bearbeiten Buchungen; Leser haben nur Lesezugriff und keinen CSV-Export.
- Teamansichten aktualisieren sich alle 15 Sekunden, der Planungskalender und der öffentliche Katalog alle 30 Sekunden. Der Verfügbarkeitsmonat wird beim Öffnen geladen und beim Absenden erneut serverseitig geprüft.
- Versionsprüfungen verhindern das stille Überschreiben zwischen zwei Accounts. Neuere Serverantworten haben Vorrang vor verspäteten Suchantworten.
- Die Übersicht „Letzte Anfragen“ ist nach Eingang sortiert und unabhängig von den Filtern in der Buchungsliste.
- Status, Termine, Uhrzeiten, Ort, interne Notizen und manuelle Zahlungsmarkierung sind bearbeitbar. Wesentliche Änderungen senden eine Kundenaktualisierung; interne Notizen bleiben intern.
- Bei geändertem Mietzeitraum wird der Preis aus dem aktuellen Katalog neu berechnet. Vorher mit dem Kunden abstimmen. Kundenkontaktdaten und gewählte Extras bleiben als ursprünglicher Anfrage-Snapshot erhalten.
- Stornierungen geben die Datenbanksperre erst nach erfolgreicher Google-Löschung frei. Stornierte Anfragen können nicht einfach reaktiviert werden.
- Persönlich importierte Kalenderdateien sind keine Live-Abonnements; spätere Änderungen müssen Kunden übernehmen. Der Firmenkalender wird automatisch abgeglichen.

Diese Version verwaltet **eine Fotobox** und Mietzeiträume von 1–14 Kalendertagen in Europe/Berlin, höchstens zwei Jahre im Voraus. Grundpreis pro Miettag; Extras einmalig. Neue Anfragen reservieren erst nach erfolgreichem Absenden, nicht bereits durch das Anklicken eines Tages.

Die gemeinsame Datenbank verhindert Website-Doppelbuchungen. Google ist ein externer Dienst: Ein manuell neu eingetragener Termin genau zwischen Prüfung und Übertragung lässt sich nicht atomar mit PostgreSQL sperren. Verbindliche neue Reservierungen zentral im System verwalten und manuelle Sperren vorher anlegen.

## 7. Launch, vorhandene Daten und eigene Inhalte

Preise sind aus dem vorherigen Entwurf übernommene Startwerte. Im Dashboard Preise/Leistungen, Preis-/Anfahrtshinweis und eure Betreiber-/Datenschutz-/Buchungsbedingungen hinterlegen und bestätigen. Erst danach und mit eingerichteten Integrationen lassen sich echte Anfragen freischalten. Zum öffentlichen Launch Vorschau-Schutz beim Buchungsprojekt deaktivieren. Team-Login bleibt geschützt.

**Vorhandene 2.0-Datenbank:** Beide neuen Projekte können dieselbe bestehende `DATABASE_URL` und denselben bisherigen `ENCRYPTION_KEY` weiterverwenden; diese Überarbeitung ändert die SQL-Struktur nicht und überschreibt keine Einstellungen. Alte Sites-/Netlify-v3-Daten stammen aus einer anderen Struktur und werden nicht automatisch importiert. Alt-Buchungen müssen vor dem Umstieg übertragen oder mindestens ihre Termine im verbundenen Google Kalender gesperrt werden. Zwei unabhängige Buchungssysteme nicht parallel ohne gemeinsame Verfügbarkeit betreiben.

Eigene Eventbilder gehören beim Buchungsprojekt nach `public/events/`; Galerie in `components/booking-site.tsx` anpassen. Momentan sind vier Bildplätze ausdrücklich als Platzhalter gekennzeichnet. Kein Uploadmodul, keine Rechnungs- oder Zahlungsabwicklung. Das Premium-Design und die Scroll-Inszenierung bleiben erhalten; reduzierte Bewegung wird berücksichtigt.

Regelmäßige Datenbankbackups samt sicher aufbewahrtem Verschlüsselungsschlüssel einrichten. Aufbewahrungsfristen betriebsintern festlegen. Der Runner entfernt abgelaufene Login-/OAuth-Tokens; Kundendaten werden nicht automatisch gelöscht.

## 8. Entwicklung und Prüfung

```bash
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

Dieses Projekt verwendet lokal Port **3000**. `npm run format` formatiert Quelltexte. Die enthaltene GitHub Action führt Tests, Typprüfung und Build ohne produktive Secrets aus. `PRUEFPROTOKOLL.md` dokumentiert den tatsächlich getesteten Stand und die noch nötigen Live-Prüfungen.

Bei Problemen: zuerst `npm run setup:check` im betroffenen Projekt und `/api/health` prüfen. Bei Buildfehlern die erste konkrete Fehlermeldung oberhalb von `build.command failed` verwenden. Beide Repositories aus demselben Release aktualisieren, insbesondere bei späteren Änderungen an gemeinsamem Backend oder Datenbankmodell.

## Offizielle Dokumentation

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Next.js auf Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Google OAuth für Webserver](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Resend E-Mail API](https://resend.com/docs/api-reference/emails/send-email)

Release: 12.10.2026. Externe Konten müssen von euch verbunden werden; es wurden keine echten Mails versandt oder produktiven Kalender verändert.
