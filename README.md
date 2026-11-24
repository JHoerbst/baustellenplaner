# Baustellenplaner

Termine, Angebote und Aufgaben für Umbau, Zubau oder Hausbau an einem Ort,
gemeinsam mit allen, die mitplanen. Läuft als Web-App am Handy (installierbar)
und am Rechner.

## Was die App kann

- **Übersicht**: die nächsten 14 Tage auf einen Blick, wer morgen auf der
  Baustelle ist und für wie viele gekocht wird, die kommenden sieben Tage Tag
  für Tag, dazu alles, was gerade Aufmerksamkeit braucht: ablaufende
  Angebote, fällige Bestellungen und Entscheidungen, offene Rechnungen,
  Mängel und Aufgaben
- **Budget**: ein Gesamtbudget mit Puffer; die App rechnet aus Rechnungen,
  Aufträgen, Bestellungen und den günstigsten offenen Angeboten hoch und
  warnt, bevor es eng wird
- **Angebote**: pro Gewerk nebeneinander, günstigstes zuerst, mit Abstand zum
  günstigsten, Stand (angefragt bis beauftragt), Gültigkeit, PDF und Fotos als
  Anhang; bei beauftragten Angeboten Nachträge und was schon verrechnet und
  bezahlt ist
- **Zeitplan**: vier Wochen im Blick, Gewerke als Balken, Helfer pro Tag
  antippen, darunter für jeden Tag, für wie viele gekocht wird
- **Rechnungen**: Einkäufe (Baustoffe, Werkzeug) und Handwerker-Rechnungen
  mit Beleg-Foto, Art, Gewerk und bezahlt/offen; Summen nach Art und Gewerk,
  Suche zum Wiederfinden für die Garantie
- **Bestellungen**: was Lieferzeit hat, mit spätestem Bestelltermin,
  zugesagter Lieferung und dem Tag, ab dem es gebraucht wird; im Zeitplan
  sichtbar, mit Warnung, wenn es zu spät käme
- **Kalender-Abo**: Termine, Fristen und Einsätze als Abo in Google oder
  Apple Kalender, über einen geheimen Link je Projekt
- **Termine**: nach Tagen gruppiert, mit Firma und Ort; von jeder Seite aus
  mit einem Tipp neu anlegen
- **Aufgaben**: mit Zuständigkeit, Frist und Raum, Filter „Meine"
- **Notizen**: von überall ein Tipp zum leeren Textfeld, etwa während eines
  Anrufs; Firma und Gewerk lassen sich später zuordnen
- **Entscheidungen**: offene Fragen wie Fliesen oder Steckdosen mit
  Möglichkeiten, Preis und dem Datum, bis wann es feststehen muss
- **Mängel**: mit Foto, Raum, zuständiger Firma und Frist bis zur Behebung,
  gruppiert nach Firma
- **Pläne**: Grundrisse und Schnitte als PDF oder Bild, in der App zum
  Hineinzoomen und Verschieben (Finger, Mausrad, Doppeltipp)
- **Fotos**: nach Raum und Datum abgelegt, zum Hineinzoomen; die App erinnert
  vor Putz, Estrich und Trockenbau ans Fotografieren der Leitungen
- **Firmen**: mehrere Ansprechpersonen je Firma mit Funktion (z.B. Polier),
  Anrufen und E-Mail per Tipp
- **Räume**: einmal anlegen, mit Geschoss und Fläche, auch mehrere auf
  einmal aus einer Liste; dann Fotos, Mängel, Aufgaben, Entscheidungen und
  Bestellungen zuordnen
- **Projekt**: Gewerke einzeln zuschalten oder eigene anlegen, auch als
  Eigenleistung, Mitglieder per E-Mail einladen und ihnen Namen geben,
  mehrere Projekte

Was noch offen ist, steht in [docs/FEATURES.md](docs/FEATURES.md).

## Ausprobieren ohne Cloud

```bash
npm install
npm run dev
```

Ohne Backend läuft die App im Probiermodus: Alle Daten liegen im Browser
(localStorage und IndexedDB). Gut zum Ansehen und Entwickeln, aber nichts
wird geteilt.

## Eigene Instanz auf AWS

Die App nutzt AWS Amplify Gen 2: Cognito (Anmeldung), AppSync mit DynamoDB
(Daten, live synchronisiert), S3 (Dateien) und Lambda. Du brauchst ein
AWS-Konto und Node.js. Die Kosten hängen von der Nutzung ab; für einen
Haushalt sind sie nach unserer Einschätzung gering, gemessen haben wir es
nicht.

1. **Zum Entwickeln**: `npx ampx sandbox` legt ein persönliches Backend an und
   schreibt `amplify_outputs.json`. Danach `npm run dev`.
2. **Dauerhaft**: Repository in der Amplify Console als App verbinden.
   `amplify.yml` baut Backend und Frontend.
3. **Erstes Konto anlegen**. Selbst registrieren kann sich niemand, damit keine
   Fremden Konten in eurem Pool anlegen:

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <Pool-ID> \
     --username du@beispiel.at \
     --user-attributes Name=email,Value=du@beispiel.at Name=email_verified,Value=true
   ```

   Die Pool-ID beginnt mit der Region (z.B. `eu-central-1_`). Du findest sie
   in der Amplify Console bei den Backend-Ressourcen der App oder, mit der
   Sandbox, in `amplify_outputs.json`. Das vorläufige Passwort kommt per
   E-Mail. Alle weiteren Personen lädst du in der App unter Projekt ein.
4. **Bei einem öffentlichen Repository**: Lass in Amplify die Vorschauen für
   Pull Requests ausgeschaltet, sonst kann ein fremder Pull Request einen
   Build in deinem Konto auslösen.

### Eigene Domain

Die Domain verbindest du in der Amplify Console. Damit auch die Einladungsmail
auf sie zeigt, setz dort die Umgebungsvariable `APP_URL`, zum Beispiel
`https://baustelle.example.com`.

### Wenn du den Code veränderst

Die App zeigt unter „Projekt" und auf der Startseite einen Link zum
Quellcode, weil die AGPL das für einen Betrieb im Netz verlangt. Betreibst du eine veränderte Version, trag in
`src/ui/SourceLink.tsx` die Adresse deines eigenen Repositories ein.

## Aufbau

- `src/` Vite + React. `src/lib/store.ts` ist die einzige Schnittstelle zu den
  Daten, mit zwei Umsetzungen: lokal (im selben File) und `src/lib/cloud.tsx`.
- `amplify/` Backend. Jedes Projekt bekommt eine eigene Cognito-Gruppe; jeder
  Datensatz trägt sie im Feld `group`, und nur Mitglieder dürfen ihn lesen
  und schreiben. Dateien liegen in S3 unter `projects/<group>/` und sind nur
  über signierte URLs erreichbar, die eine Lambda nach Prüfung der
  Mitgliedschaft ausstellt.
- Das Kalender-Abo ist der einzige Zugang ohne Anmeldung: eine Lambda mit
  öffentlicher Adresse, die nur mit dem geheimen Schlüssel des Projekts
  antwortet. Wer den Link kennt, kann die Kalendereinträge lesen; unter
  „Projekt" lässt sich ein neuer Link erzeugen, der den alten ungültig macht.

Der Code ist englisch, die Oberfläche deutsch; ein Glossar der Fachbegriffe
steht in `CLAUDE.md`. `npm run typecheck` prüft Frontend und Backend. Tests
gibt es noch keine.

## Lizenz

Copyright (C) 2026 JHoerbst

GNU Affero General Public License, Version 3 (AGPL-3.0), siehe
[LICENSE](LICENSE). Kurz gesagt: Du darfst die App frei nutzen, selbst
betreiben und verändern. Wer eine veränderte Version weitergibt oder als
Dienst im Netz betreibt, muss deren Quellcode unter derselben Lizenz
offenlegen. Die Software kommt ohne jede Gewährleistung.
