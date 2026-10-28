# Prüfprotokoll · THE BOXX 2.1.0 · 12.10.2026

## Geprüft

Beide Projektordner wurden separat mit `npm ci --include=dev` aus ihrem mitgelieferten Lockfile installiert.

| Prüfung | Buchung | Verwaltung |
| --- | --- | --- |
| Automatisierte Tests | 16 bestanden, 0 Fehler | 16 bestanden, 0 Fehler |
| TypeScript-Prüfung | bestanden | bestanden |
| Next.js-Produktions-Build | bestanden | bestanden |
| Seiten getrennt | keine Admin-/Login-Seiten | keine Kunden-/Bestätigungsseiten |

Lokale Laufzeit: Node.js 24.19.0; Framework Next.js 16.3.8. Die GitHub-Action und Netlify-Konfiguration verwenden Node.js 22. Die Produktionsabhängigkeiten beider Projekte sind identisch; `npm audit --omit=dev` meldete bei der gemeinsamen Abhängigkeitsprüfung 0 bekannte Schwachstellen.

Die Tests prüfen Preisberechnung, Optionsvalidierung, echte Kalenderdaten, Dauergrenzen, Zustimmung, Spamschutz, Berliner Zeitumrechnung, Kalenderdateien, Verschlüsselung, private Links, Passworthashes, CSV-Formelschutz, Anfrageursprung und Größenbegrenzung. Die vier ergänzten Prüfungen betreffen die feste Trennung der APIs, die Release-Kennung, sichere Buchungslinks nach Login und die Einrichtungskonfiguration.

Die SQL-Struktur wurde in PGlite (PostgreSQL in WebAssembly) ausgeführt. Überschneidungssperre, eindeutige Anfrage-IDs, Freigabe nach Stornierung, gemeinsame Einstellungen, Versionskonflikte, Rollbacks und eindeutige Versandaufträge wurden geprüft. Das ersetzt keinen Lasttest mit einer verteilten produktiven PostgreSQL-Installation.

Die Build-Manifeste wurden geprüft: Nur die jeweils vorgesehenen Seiten sind im jeweiligen Projekt enthalten. Der Build benötigt keine Produktiv-Zugangsdaten und führt keine Datenbankmigration aus.

## Beim Einrichten live prüfen

- Verbindung zu eurer gemeinsamen Datenbank und erster Inhaber-Login.
- Google-OAuth-Freigabe, Kalenderrechte sowie Anlegen, Ändern und Löschen eines eigenen Testtermins.
- Mailannahme und tatsächliche Zustellung an eure Teamadresse und eine eigene Kunden-Testadresse.
- Netlify-Scheduler im Buchungsprojekt; Passwort-Link und Einladung; Wiederholung eines fehlgeschlagenen Auftrags.
- Änderungen zwischen zwei angemeldeten Team-Accounts und vollständiger Test vom Konfigurator bis zur Stornierung.
- Darstellung und Bedienung auf Smartphone und Desktop. In dieser Arbeitsumgebung war der vorgesehene Browser-QA-Zugang nicht verfügbar; ein visueller Browsertest wird nicht als bestanden ausgewiesen.

Es wurden keine echten E-Mails verschickt, produktiven Kalender verändert oder Alt-Buchungen importiert. Die gemeinsame Datenbankstruktur ist enthalten; eine externe Datenbankinstanz und eure Dienstzugänge müssen unter euren Accounts verbunden werden.

