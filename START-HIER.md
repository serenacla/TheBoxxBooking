# Hier starten · THE BOXX Buchung

**Diese Datei gehört zum Buchungsprojekt.** Du hast zwei getrennte ZIPs erhalten. Jedes ZIP ergibt ein eigenes GitHub-Repository und eine eigene Website. Beide werden über dieselbe Datenbank verbunden.

| | Buchung | Verwaltung |
| --- | --- | --- |
| Empfohlener Repository-Name | `the-boxx-buchung` | `the-boxx-verwaltung` |
| Lokal | `http://localhost:3000` | `http://localhost:3001` |
| Einstieg | Konfigurator | Team-Login |
| Hosting-Build | `npm run build` | `npm run build` |
| Publish Directory | `.next` | `.next` |

## In dieser Reihenfolge einrichten

1. Beide ZIPs separat entpacken. Den jeweiligen Inhalt in das passende neue GitHub-Repository laden. `package.json` muss direkt im Hauptordner liegen. Keine alten Dateien darübermischen.
2. Jedes Repository mit einem eigenen Netlify-Projekt verbinden. `netlify.toml` setzt den Build. Ein zusätzlicher `APP_MODE`-Schalter ist nicht mehr nötig.
3. **Eine gemeinsame PostgreSQL-Datenbank** bereitstellen. Beide Websites erhalten dieselbe `DATABASE_URL` und denselben `ENCRYPTION_KEY`. Falls die vorherige 2.0-Plattform schon läuft: genau ihre Datenbank und ihren Schlüssel weiterverwenden.
4. Alle Werte aus `.env.example` in beiden Hosting-Projekten hinterlegen. `BOOKING_URL` zeigt auf die Buchungsseite, `ADMIN_URL` auf die Verwaltung. Details und Geheimnis-Erzeugung stehen in `README.md`.
5. Einmal im lokalen **Verwaltungsordner** `npm ci --include=dev` ausführen, `.env.example` als `.env.local` kopieren und ausfüllen. Danach `npm run setup:check`, `npm run db:migrate` und `npm run admin:create` ausführen. Dieser Account gilt für alle zukünftigen Logins in der Verwaltung.
6. Beide Websites deployen. Jeweils `/api/health` öffnen: Version `2.1.0`, Rolle `booking` bzw. `admin`. Die Datenbank wird nicht während des Builds verändert.
7. Resend-Absenderdomain und Schlüssel verbinden. In der Verwaltung eure Empfängeradresse für neue Anfragen eintragen. Google-OAuth einrichten; Weiterleitung ist immer `https://EURE-VERWALTUNGS-URL/api/google/callback`.
8. In der Verwaltung Google verbinden, Kalender auswählen, Preise und Rechtstexte prüfen und speichern. Dann echte Anfragen freischalten.
9. Nur im Netlify-Buchungsprojekt den geplanten Job `process-jobs` kontrollieren. Er verarbeitet die gemeinsame Mail-/Kalenderwarteschlange beider Websites.
10. Eine eigene Testanfrage durchführen: Team-Mail, Kundenmail, Google-Termin, persönlicher Kalenderdownload, zweiter Team-Account und Stornierung prüfen. Erst danach öffentlich starten.

Der bisherige Vorschau-Code `TheBoxX2026` wird beim Buchungsprojekt als `PREVIEW_ACCESS_CODE` hinterlegt. Zum Launch `PREVIEW_ACCESS_ENABLED=false` setzen. Teammitglieder verwenden eigene Zugangsdaten.

GitHub Pages allein reicht für dieses System nicht; GitHub-Repository + Netlify/Node.js-Hosting ist der vorgesehene Weg. Die externen Konten und die Datenbank müssen mit euren Zugangsdaten eingerichtet werden. Es gibt keinen eingebauten Standard-Admin und keine vorausgefüllten Geheimnisse.

**Weiter:** `README.md` für die vollständige Einrichtung, `PRUEFPROTOKOLL.md` für den geprüften Stand. Alte Sites-Buchungen wurden nicht automatisch übernommen. Weitere Anpassungen bitte immer in beiden passenden Release-Projekten aktuell halten.
