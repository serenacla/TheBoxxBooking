# THE BOXX – E-Mails über booking@the-boxx.de

Diese Fassung verwendet auf Wunsch euer vorhandenes Postfach statt Resend. Grundlage sind die beiden hochgeladenen ZIP-Dateien. Der SMTP-Server wurde noch nicht mit echten Zugangsdaten getestet. Keine Passwörter in GitHub oder im Chat eintragen.

## 1. Beide Websites aktualisieren

- TheBoxxBooking.zip gehört in das GitHub-Repository der Buchungswebsite.
- TheBoxxPrivat.zip gehört in das Repository der Verwaltung.
- ZIP entpacken. Der Ordner mit package.json ist der Projekt-Hauptordner.
- Die enthaltenen Dateien im richtigen Repository aktualisieren, insbesondere package.json, package-lock.json und die Dateien unter lib sowie app/api/widerruf. In der Verwaltung auch components/settings-editor.tsx.
- Keine zusätzliche Ordnerstufe in GitHub hochladen. package.json muss weiterhin im Repository-Hauptordner liegen.
- Nutzt du lokal Git, kopiere die Dateien in den bestehenden Checkout, prüfe die Änderungen und committe/pushe sie. Deinen .git-Ordner und lokale Zugangsdaten nicht löschen.
- Nicht node_modules oder lokale Buildordner hochladen. Diese sind im Download absichtlich nicht enthalten.
- Enthält GitHub neuere Änderungen als deine hochgeladenen ZIPs, diese vor dem Zusammenführen sichern; der Download kennt nur deine Uploads.
- Keine neue Datenbank erstellen und keine Daten löschen. DATABASE_URL und ENCRYPTION_KEY bleiben wie bisher auf beiden Websites identisch.

## 2. Zugangsdaten in Netlify eintragen – bei BEIDEN Projekten

Öffne das jeweilige Projekt in Netlify und suche in der Projektkonfiguration nach „Environment variables“ / „Umgebungsvariablen“. Vorhandene Einträge bearbeiten, fehlende neu hinzufügen.

| Name / Key | Wert / Value |
|---|---|
| MAIL_PROVIDER | smtp |
| SMTP_HOST | the-boxx.de |
| SMTP_PORT | 25 |
| SMTP_USER | booking@the-boxx.de |
| SMTP_PASSWORD | Das echte Passwort dieses E-Mail-Postfachs, nur bei Netlify eingeben |
| MAIL_FROM | THE BOXX <booking@the-boxx.de> |

Werte ohne zusätzliche Anführungszeichen eingeben. Das Postfachpasswort unverändert übernehmen. Falls Netlify Bereiche/Scopes anbietet, müssen die Werte für Functions verfügbar sein; für den produktiven Deployment-Kontext setzen. SMTP_PASSWORD als geheim behandeln. Kein NEXT_PUBLIC_-Präfix verwenden.

RESEND_API_KEY wird mit MAIL_PROVIDER=smtp nicht mehr verwendet. Die anderen vorhandenen Variablen für Datenbank, Kalender, URLs, Zugangsschutz und Verschlüsselung beibehalten.

Port 25 und Hostname stammen aus deinen Angaben in Apple Mail. TLS wird hier per STARTTLS zwingend aktiviert. Keine unverschlüsselte Verbindung und keine abgeschaltete Zertifikatsprüfung. Wenn der Anbieter einen anderen Versandhostname verlangt oder Port 25 aus Netlify nicht erreichbar ist, beim Anbieter den authentifizierten SMTP-Zugang erfragen. Nur nach Bestätigung auf 587 (STARTTLS) oder 465 (direktes TLS) wechseln. Das Programm wählt anhand des Ports automatisch die passende TLS-Art.

Nach dem Speichern beide Websites neu deployen. Die vorherige Webpack-Build-Einstellung und das Entfernen des Build-Caches bleiben erhalten; Secrets-Scanning nicht abschalten.

## 3. Absender und Antworten

Der Versand erfolgt von booking@the-boxx.de. In der Verwaltung unter Einstellungen weiterhin „Eure E-Mail für neue Anfragen“ und die Antwortadresse für Kunden hinterlegen. Diese Empfänger-/Antwortadressen können von der Versandadresse abweichen.

Buchungsbestätigungen, Team-Benachrichtigungen, Einladungen, Passwort-Zurücksetzen und vorhandene Widerrufsbestätigungen verwenden den ausgewählten Versanddienst. Kalenderdateien (.ics) und vorhandene Google-Kalenderlinks bleiben enthalten. Der Google-Kalender wird weiterhin separat über seine bestehende Verbindung synchronisiert; SMTP richtet Google nicht ein.

## 4. Test ohne echte Buchung

1. Nach dem Deployment in der Verwaltung mit dem Inhaber-Account anmelden.
2. Einstellungen öffnen, unter „Verbindungen“ auf „Testmail an meinen Account senden (Inhaber)“ klicken.
3. Die Nachricht geht ausschließlich an die E-Mail-Adresse des angemeldeten Inhaber-Accounts. Es wird keine Buchung erzeugt.
4. Posteingang und Spamordner prüfen. Unter „Synchronisierung“ den Versandauftrag kontrollieren. „Eingereiht“ bedeutet noch nicht „gesendet“; „done“ bedeutet vom Versandserver angenommen, nicht garantiert im Posteingang zugestellt.
5. Anschließend eine eindeutig als Test markierte Anfrage mit eigener Empfängeradresse durchführen, sofern echte Anfragen bereits freigeschaltet sind. Das blockiert den gewählten Testzeitraum und kann einen Google-Termin erzeugen. Kunden- und Teammail, .ics-Anhang sowie Kalender prüfen; den Test danach in der Verwaltung stornieren und die Kalenderfreigabe kontrollieren.

SMTP kann bei einem Verbindungsabbruch nach der Übertragung keinen eindeutigen Versandstatus garantieren. Solche Aufträge werden nicht blind automatisch wiederholt. Erst den Eingang beim Empfänger prüfen, dann bei Bedarf manuell erneut senden. Dieselbe Message-ID allein verhindert keine Doppelzustellung. Vor dem Wechsel alte ausstehende/fehlgeschlagene Mails prüfen: Ein Neustart kann sie über SMTP versenden. SMTP versendet auch ältere Warteschlangen-Nachrichten mit dem aktuell eingestellten MAIL_FROM.

## 5. Falls keine Mail kommt

- „SMTP-Anmeldung fehlgeschlagen“: Benutzername und Postfachpasswort kontrollieren.
- Verbindungs-/TLS-Fehler: authentifizierten SMTP-Hostname und Port beim Anbieter bestätigen lassen. Nicht die Zertifikatsprüfung abschalten.
- Mailstatus unklar: Eingang/Spam beim Empfänger prüfen, bevor du den Auftrag erneut sendest.
- Auftrag bleibt pending: prüfen, ob die bestehende geplante Funktion process-jobs auf der Buchungswebsite läuft; beide Deployments müssen die gleiche Datenbank verwenden.
- „Ungültiger Anfrageursprung“: ADMIN_URL bzw. BOOKING_URL müssen weiterhin exakt zu den tatsächlich geöffneten Websites passen.

## Prüfung dieser Fassung

Erfolgreich geprüft: Typprüfung, jeweils 19 Tests und Produktions-Builds für beide Websites. Ergänzte Tests prüfen SMTP-Konfiguration, erzwungenes TLS, Kalenderanhänge, Antwortadresse und stabile Message-IDs. Ein echter SMTP-Versand, ein Netlify-Deployment und der Empfang im Kundenpostfach können erst nach Eintragen deiner Zugangsdaten geprüft werden. Kein Browser-Funktionstest durchgeführt.
