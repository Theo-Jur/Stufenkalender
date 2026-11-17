# Projektnotiz für Claude

## Wer und wofür
- Persönlicher Kalender von Theo (GitHub: Theo-Jur), erstmal nur für ihn selbst. Live unter https://stufenkalender.vercel.app
- Theo ist kein Programmierer: Antworten auf Deutsch, einfach erklären, Klickwege genau beschreiben, nach jeder Änderung sagen, was er tun muss (meist nur neu laden).
- Ablauf einer Änderung: Code ändern → testen → auf `main` pushen → Vercel veröffentlicht automatisch (1–2 min) → Theo lädt mit Strg+F5 neu bzw. startet die installierte App neu.

## Grundidee (nicht ohne Rückfrage ändern)
- Termine gehören zu **Kategorien**, jede Kategorie hat eine **Stufe**: 1 Fix (rot), 2 Wichtig (gelb), 3 Flexibel (grün). Farbe = nur Stufe, satt/deckend gefüllt (auch die drei Stufen-Kästen). Unterschiedliche Randlinien je Stufe hat Theo bewusst entfernt (17.11.2026).
- Der Planer verschiebt **nie selbst**. Verdrängte Termine landen in der Ablage „Neu einplanen“; Theo zieht sie per Drag & Drop in den Kalender (grüne Bereiche passen) oder übernimmt den Vorschlag.
- Festschreiben (ab Vorabend 20 Uhr, einstellbar oder pro Termin), nichts in die Vergangenheit, Schlafzeiten sind tabu für Stufe 2/3, Wegzeiten zwischen Orten (vom Ort des vorherigen Termins, sonst Zuhause).
- Zwei Modi: **Planen** (alles bearbeitbar) und **Alltag** (nur ansehen, kleine Stufen-Filter, „Jetzt/Als Nächstes“, Termin antippen zeigt Details).
- Weitere Funktionen: wiederkehrende Termine (täglich/wöchentlich/2-wöchentlich, Wochentage, Enddatum), Bemerkungen, beliebige Dauer, Wochen blättern, .ics-Import, Orte & Wege, Kategorien verwalten.

## Technik
- Vite + reines JavaScript (kein Framework), PWA über `vite-plugin-pwa`, Supabase für Login (E-Mail + Passwort) und Speicherung. Hosting: Vercel, verbunden mit GitHub.
- Supabase-Projekt: Adresse und **publishable** Schlüssel stehen in `src/config.js` (öffentlich gewollt). Niemals einen secret/service_role-Schlüssel ins Repo.
- Sign-ups sollen in Supabase abgeschaltet sein, sobald Theos Konto läuft (nur er nutzt die App).

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst: Lade-, Anmelde-, Konfig-Bildschirm, Kalender, alle Dialoge |
| `src/main.js` | Start, Anmeldung, Fehler-/Zeitlimit-Anzeige, verbindet App und Store |
| `src/urlcheck.js` | Wird vor Supabase geladen; fängt Fehler aus E-Mail-Links ab (verhindert Neu-Lade-Schleife) |
| `src/app.js` | Die ganze Kalenderlogik und Darstellung (`startApp({initial,onChange})`, gibt `replaceState` zurück) |
| `src/store.js` | Speichern in Tabelle `calendar_state`, lokaler Cache, Abgleich, Offline-Puffer |
| `src/style.css` | Gestaltung mit Farb-Tokens, helles und dunkles Design |
| `supabase/schema.sql` | Tabelle + Row Level Security + Realtime |

## Datenmodell (`state`, als ein JSON pro Konto gespeichert)
- `cats`: `{id,name,tier}` · `places`: `{id,name}` · `home`: Orts-id · `travel`: `{"a|b": Minuten}` (Schlüssel sortiert, siehe `pkey`)
- `events`: `{id,title,cat,day,start,dur,loc,note,locked,rec,ex,uid}`
  - `day` = Tagesnummer ab Montag 9.11.2026 (`BASE`), kann negativ sein; `start`/`dur` in Minuten.
  - `rec` = `{freq:'daily'|'weekly'|'biweekly', days:[0-6]|null, until:Tagesnummer|null}`
  - `ex` = Ausnahmen einer Serie: `{[Tagesnummer]: 'skip' | {day,start}}`
  - `uid` nur bei importierten Terminen (erneuter Import aktualisiert statt zu verdoppeln).
- Angezeigt und geplant wird mit Einzelterminen der sichtbaren Woche (`buildEV`), ids `"<id>@<tag>"`; Änderungen an Einzelterminen über `setInst`.
- Weitere Felder: `hidden` (Filter), `buffer`, `lockMode`, `sleep`, `nextId`.
- **Wenn sich das Datenformat ändert:** alte gespeicherte Daten müssen weiter laden (`normalize` in `app.js` ergänzt fehlende Felder). Vorher Theo Bescheid sagen.

## Testen
Ohne echtes Supabase, mit nachgebautem Server und Playwright:

```bash
VITE_SUPABASE_OVERRIDE=true VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=testkey \
  npx vite build --outDir dist-mock --emptyOutDir
mkdir -p tests/out
node tests/e2e-sync.cjs dist-mock tests/out tests/beispiel-stundenplan.ics   # Login, Sync zwischen 2 Geräten, offline, Import, Abmelden
node tests/e2e-email-link.cjs dist-mock                                     # abgelaufener und gültiger E-Mail-Link
node tests/e2e-timeout.cjs dist-mock                                        # Server antwortet nicht → Hinweis statt Endlos-Laden
```
Alle Ausgaben enden mit `ERRORS []`, wenn alles passt. Danach normal `npm run build` prüfen.

## Bekannte Grenzen / mögliche nächste Schritte
- Planer prüft nur die angezeigte Woche.
- .ics-Import ist einmalig (kein laufender Abgleich mit Google/Apple).
- Keine Push-Erinnerungen, keine ganztägigen oder mitternachtsübergreifenden Termine, Wegzeiten von Hand.
- `app.js` ist groß; bei größeren Umbauen in Module aufteilen.
