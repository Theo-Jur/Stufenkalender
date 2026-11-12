# Stufenkalender

Ein Kalender mit Prioritätsstufen. Termine gehören zu Kategorien, und jede Kategorie hat eine Stufe:

- **Stufe 1 · Fix** (rot) wird nie verschoben, z. B. Klausur, Arzt, Kundengespräch.
- **Stufe 2 · Wichtig** (gelb) weicht nur Stufe 1 aus.
- **Stufe 3 · Flexibel** (grün) weicht allem aus, z. B. Training oder Treffen.

Muss ein Termin ausweichen, schlägt der Planer eine neue Zeit vor. Du ziehst den Termin selbst an eine passende Stelle oder übernimmst den Vorschlag. Dazu kommen Schlafzeiten, Orte mit Wegzeiten, wiederkehrende Termine, Bemerkungen, ein Import für .ics-Dateien und zwei Ansichten: **Planen** zum Bearbeiten und **Alltag** zum schnellen Nachschauen.

Die App läuft im Browser und lässt sich auf dem Handy wie eine normale App installieren. Die Daten liegen in deinem Supabase-Projekt und werden zwischen allen Geräten abgeglichen, auf denen du angemeldet bist.

---

## Einrichtung

Du brauchst drei kostenlose Konten: **GitHub** (Code), **Supabase** (Login und Datenbank) und **Vercel** (macht die App im Internet erreichbar).

### 1. Supabase: Datenbank anlegen

1. Öffne dein Projekt auf [supabase.com](https://supabase.com).
2. Klicke links auf **SQL Editor**, füge den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ein und klicke auf **Run**.
   Damit entsteht die Tabelle für deinen Kalender, und jedes Konto darf nur seine eigenen Daten sehen.
3. Öffne **Project Settings → API** (in neueren Versionen „Data API“ und „API Keys“) und notiere:
   - die **Project URL**, z. B. `https://abcdefgh.supabase.co`
   - den **anon public**- bzw. **publishable**-Schlüssel

   Den **service_role**- bzw. **secret**-Schlüssel brauchst du nicht. Gib ihn niemandem und trag ihn nirgends ein.

### 2. Vercel: App online stellen

1. Melde dich auf [vercel.com](https://vercel.com) mit deinem GitHub-Konto an.
2. **Add New → Project**, dann das Repository `stufenkalender` importieren. Vercel erkennt Vite automatisch.
3. Trag unter **Environment Variables** ein:

   | Name | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | deine Project URL |
   | `VITE_SUPABASE_ANON_KEY` | dein anon- bzw. publishable-Schlüssel |

4. Klicke auf **Deploy**. Danach bekommst du eine Adresse wie `https://stufenkalender-xyz.vercel.app`.

Jede Änderung, die auf GitHub landet, stellt Vercel ab dann automatisch online.

### 3. Supabase: Adresse der App eintragen

Damit Bestätigungs- und Passwort-Links in E-Mails zur richtigen Adresse führen:

1. In Supabase **Authentication → URL Configuration** öffnen.
2. **Site URL** auf deine Vercel-Adresse setzen.
3. Unter **Redirect URLs** dieselbe Adresse und zum lokalen Testen `http://localhost:5173` hinzufügen.

### 4. Konto anlegen und abschließen

1. Öffne deine App-Adresse, wähle **Konto anlegen** und bestätige den Link in der E-Mail.
2. Weil die App erstmal nur für dich ist: Schalte in Supabase unter **Authentication → Sign In / Providers** die Option **„Allow new users to sign up“** aus. Dann kann sich niemand sonst ein Konto anlegen. Du selbst kannst dich weiter anmelden.

### 5. Aufs Handy holen

- **iPhone:** Adresse in Safari öffnen → Teilen → **Zum Home-Bildschirm**.
- **Android:** Adresse in Chrome öffnen → Menü → **App installieren**.

---

## Lokal weiterentwickeln (optional)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
cp .env.example .env      # dann URL und anon-Schlüssel eintragen
npm run dev               # startet die App unter http://localhost:5173
npm run build             # baut die fertige Version in den Ordner dist/
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst: Anmeldung, Kalender, alle Dialoge |
| `src/main.js` | Start, Anmeldung, Verbindung von App und Speicher |
| `src/app.js` | Der eigentliche Kalender: Planer, Darstellung, Drag & Drop, Import |
| `src/store.js` | Speichern in Supabase, lokale Kopie für offline, Abgleich zwischen Geräten |
| `src/supabase.js` | Verbindung zu Supabase |
| `src/style.css` | Gestaltung, helles und dunkles Design |
| `supabase/schema.sql` | Tabelle und Zugriffsschutz |
| `vite.config.js` | Build und App-Installation (PWA) |

## So werden die Daten gespeichert

Pro Konto gibt es einen Datensatz mit dem ganzen Kalender. Jede Änderung wird nach einer knappen Sekunde hochgeladen. Ohne Internet bleibt sie im Browser und wird nachgeholt, sobald du wieder online bist. Andere geöffnete Geräte bekommen Änderungen sofort, spätestens aber, wenn du die App wieder öffnest. Ändern zwei Geräte gleichzeitig etwas, gewinnt die jüngere Änderung.

## Bekannte Grenzen

- Der Planer prüft beim Umplanen nur die gerade angezeigte Woche.
- Der .ics-Import liest einmalig ein. Spätere Änderungen in Google oder Apple Kalender kommen erst beim nächsten Import mit.
- Keine Erinnerungen per Push.
- Ganztägige Termine und Termine über Mitternacht werden nicht unterstützt.
- Wegzeiten werden von Hand eingetragen.
