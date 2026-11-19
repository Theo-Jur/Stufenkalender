# Projektnotiz für Claude

Stand: 19.11.2026 (abends). Diese Notiz soll reichen, um in einem neuen Chat ohne Vorwissen weiterzuarbeiten.

## Wer und wofür
- Persönlicher Kalender von Theo (GitHub: Theo-Jur, Repo `Theo-Jur/Stufenkalender`), nur für ihn selbst. Live unter https://stufenkalender.vercel.app (auch als installierte App/PWA am Handy).
- Theo ist kein Programmierer: **Antworten auf Deutsch**, einfach erklären, Klickwege genau beschreiben, nach jeder Änderung sagen, was er tun muss.
- Er schreibt kurz und oft mit Tippfehlern; im Zweifel kurz nachfragen, bei klaren Wünschen direkt umsetzen. Er mag es übersichtlich und simpel, probiert viel aus und ändert Entscheidungen auch wieder (siehe „Entscheidungen“ unten).

## Arbeitsablauf
1. Repo mit Schreibrechten holen: `add_repo` mit `access: "push"`, dann `git clone --depth 1 https://github.com/Theo-Jur/stufenkalender /home/claude/stufenkalender`.
2. `npm ci` (Playwright für die Tests ist nicht in `package.json`; falls es fehlt: `npm i --no-save playwright && npx playwright install chromium`). Ist der Browser-Download gesperrt: vorhandenes Chromium unter `/opt/pw-browsers/chromium-*/chrome-linux64/chrome` per `chromium.launch({executablePath:…})` in einer `zz-`-Kopie der Tests nutzen.
3. Code ändern → Test-Build und Tests (siehe „Testen“) → bei Oberflächen-Änderungen Screenshots am Computer (1280 px) **und** Handy (390 px, auch hell/dunkel) anschauen.
4. Direkt auf `main` committen und pushen (so gewünscht; deutsche Commit-Nachricht). Vercel veröffentlicht automatisch in 1–2 min.
5. Theo sagen: 1–2 min warten, dann am Computer **Strg+F5**, am Handy App ganz schließen und neu öffnen.
- **Datenformat ändern:** Theo vorher kurz Bescheid sagen; alte Daten müssen weiter laden (`normalize` in `app.js` ergänzt/migriert).
- Diese Notiz bei größeren Änderungen mitpflegen.

## Grundidee (nicht ohne Rückfrage ändern)
- Termine gehören zu **Kategorien**, jede Kategorie hat eine **Stufe**: 1 Fix (wird nie verschoben), 2 Wichtig (weicht nur Stufe 1 aus), 3 Flexibel (weicht allem aus).
- **Farbe = Kategorie, Füllung = Stufe** (seit 19.11. abends, vorher „Farbe = nur Stufe“ in Indigo): jede Kategorie hat eine Farbe aus 9 (`COLORS`: blue, orange, violet, green, pink, teal, red = „Himbeere“ (bewusst nicht #ff0000), yellow, slate = Grau), wählbar in „Kategorien verwalten“ (Farbkreise `.cswatches`). Stufe 1 Fix = **voll gefüllt**, Stufe 2 Wichtig = **getönt mit farbigem Rand**, Stufe 3 Flexibel = **nur Umriss** (Fläche in `--surface`). Technik: Helfer `kc(cat)` gibt Klassen `c-<farbe> f<stufe>`; `.c-*` setzt `--cf/--ci/--ct/--cx/--ce` (hell + dunkel, am Dateiende von `style.css`), `.f1/.f2/.f3` setzen daraus die alten Variablen `--tfill/--tink/--tedge/--tc/--tbg`, die alle Bauteile benutzen. Die Stufen-Kästen oben sind neutral (`c-slate f1/f2/f3`), Kategorie-Knöpfe darin mit Farbpunkt. Die alten Indigo-Tokens `--t1/2/3-*` und `TC` gibt es noch, sie werden aber für Termine nicht mehr benutzt.
- Der Planer verschiebt **nie selbst**. Verdrängte Termine landen in der Ablage „Neu einplanen“; Theo zieht sie in den Kalender (grüne Bereiche passen) oder übernimmt den Vorschlag.
- Festschreiben (ab Vorabend 20 Uhr, einstellbar oder pro Termin), nichts in die Vergangenheit, Schlafzeiten sind tabu für Stufe 2/3, Wegzeiten zwischen Orten (vom Ort des vorherigen Termins, sonst Zuhause).
- Zwei Modi: **Planen** (alles bearbeitbar) und **Alltag** (ansehen, abhaken, Workouts eintragen).

## Oberfläche (aktueller Stand)
**Kopf:** links Titel + Speicher-Status („Gespeichert“). Rechts: „+ Termin“ (am Handy stattdessen runder Knopf unten rechts, `.addbig` fixed), „Einstellungen“ (Zahnrad, nur Planen), Diagramm-Symbol (`#progbtn`, Fenster „Fortschritt“, siehe unten), „i“ (Hilfe-Fenster „So funktioniert's“, `#ov-help` – bei neuen Funktionen dort einen Punkt ergänzen), Umschalter Planen/Alltag, Konto-Kreis (Anfangsbuchstabe der E-Mail; Menü mit E-Mail, Schalter „Dunkles Design“ pro Gerät in `localStorage` `stufenkalender-theme`, Abmelden).

**Einstellungen** (`#ov-settings`): Kategorien verwalten (inkl. Häkchen „Als Gewohnheit verfolgen“), Schlafzeiten, Orte & Wege, Kalender importieren, Festschreiben, Puffer zwischen Terminen, Tracker-Schalter Krafttraining / Laufen / Sprint.

**Planen-Modus:**
- Drei Stufen-Kästen (`#filters`): Kasten antippen = nur diese Stufe; zweiter Kasten kommt dazu; dritter = nur dieser; gewählten nochmal = abwählen (`tierSel`, `clickTier`). Kategorie-Knöpfe darin: tippen = ein/aus (eingeblendet in Stufenfarbe, ausgeblendet weiß/gestrichelt), lange drücken oder Rechtsklick = nur diese Kategorie.
- Ablage „Zu erledigen“ (To-dos), Leiste mit KW + Pfeilen ‹ › und „Ansicht: …“, Ablage „Neu einplanen“ (sticky), dann der Kalender.
- Kalender nutzt die volle Breite; rechte Spalte „Hinweise“ erscheint nur bei Problemen (rote Zahl).
- Freie Stelle antippen = neuer Termin mit Tag/Uhrzeit (Viertelstunde). Termin antippen = bearbeiten, ziehen = verschieben.
- Termine ≤ 75 min einzeilig je Titel/Uhrzeit (`.compact`), < 45 min ganz einzeilig; Kategorie-Name steht nicht im Termin (nur Ort).

**Alltag-Modus:** „Jetzt / Als Nächstes“, kleine Stufen-Filter, Kasten „Kurz erledigen“ (To-dos < 30 min), Leiste „Gewohnheiten“, Kalender. Termin antippen = Detail-Fenster mit „Als erledigt markieren“ und ggf. „Workout“ / „Lauf eintragen“.

**Handy (≤ 700 px):**
- Alltag: immer **drei Tage** ab `DAY0` (`threeDay()`, `win3()`), Pfeile/Wischen = ±3 Tage, auch über Wochengrenzen; Plan wird pro beteiligter Woche gerechnet (`planWeek`) und zusammengeführt.
- Planen: **ganze Woche, seitlich scrollbar**; die Tageszeile wird per JS oben gehalten (`stickHead`, CSS-Variable `--dhs`). Wischen blättert erst am Rand die Woche.
- **Kein Fenster-im-Fenster:** `.cal` hat `overflow:clip`, nur die Seite scrollt, Tageszeile `.dh` klebt oben. Einzige Ausnahme: seitliches Scrollen am Handy im Planen-Modus.

**Rückgängig:** Jede echte Datenänderung (Filter zählen nicht) zeigt unten einen Hinweis mit „Rückgängig“ (7 s), am Computer auch Strg+Z. Mechanik: `trackUndo` vergleicht nach jedem `render()` einen Schnappschuss; ein `toast()` im selben Durchlauf bekommt automatisch den Rückgängig-Knopf. Ein Schritt zurück.

## Funktionen im Detail
- **Gewohnheiten** pro **Kategorie** (`cat.habit`): alle Termine der Kategorie zählen zusammen (`habitStats(catId)`). Gezählt werden Tage mit mindestens einem geplanten Termin der Kategorie; geschafft, wenn mindestens einer abgehakt ist; ein offener Tag „heute“ bricht die Serie nicht. Karte zeigt Serie (Flamme), Rekord, letzte 10 Tage als Punkte, „Heute abhaken“.
- **To-dos:** Ablage „Zu erledigen“ (Planen): „+ To-do“ (Titel, Kategorie, ungefähre Dauer 5 min–4 h, optional „bis wann“). Ziehen in den Kalender oder „Vorschlag“ antippen → wird normaler Termin (`scheduleTodo`); ✓ = erledigt (entfernt). Vorschläge (`todoSuggest`): nur in den angezeigten Tagen, ab jetzt, vor der Frist, nur echt freie Lücken (auch für Fix-To-dos, nie Schlafenszeit), dringendste zuerst, ohne sich zu überschneiden. Alltag: Kasten „Kurz erledigen“ (`renderQuick`, `QUICK_MAX = 30`, strikt < 30 min) zum Abhaken + Hinweis auf größere.
- **Tracker** (an/aus unter Einstellungen, `state.trackers`): im Termin-Fenster „Art des Termins“ = Normal / Krafttraining / Laufen / Sprint.
  - Krafttraining: Übungen eine pro Zeile; Workout-Fenster mit **einer Zeile pro Satz: Wdh. / Gewicht** (Nummer vorne, × entfernt den Satz, „+ Satz“ hängt einen an und übernimmt die Werte des letzten Satzes), darüber „Letztes Mal“ (gleiche Sätze zusammengefasst „3 Sätze · 60 kg × 10“, sonst einzeln), Zeilen damit vorausgefüllt (`lastSets`), ohne Vorgeschichte 3 leere Zeilen. Leere Zeilen werden nicht gespeichert. Unten „+ Übung“: Name eingeben → zusätzliche Übung **nur für dieses Workout** (steht nur in `wlog`, nicht in `exercises`; beim erneuten Öffnen werden Übungen aus `wlog` mit angezeigt; Schreibweise vom letzten Mal wird übernommen, sonst erster Buchstabe groß). Gespeichert wird je `.wex[data-name]`. Bewusst sehr simpel halten.
  - Laufen: **Art des Laufs** (freies Feld + Knöpfe mit bisher benutzten Arten, aufgefüllt mit Long Run / Recovery Run / 3 km / 5 km, `runKinds`; vorausgefüllt mit der Art vom letzten Lauf desselben Termins; nochmal tippen = abwählen; Schreibweise vom bisherigen Eintrag wird übernommen), km + Zeit (`mm:ss`, `h:mm:ss` oder nur Minuten, `parseRunTime`), Tempo min/km. „Letzter …“ (`lastRun(day, kind)`) = jüngster Lauf derselben Art (ohne Art: jüngster Lauf überhaupt, egal welche Serie); dazu Tempo-Vergleich „x s/km schneller/langsamer als letztes Mal“ (`syncRun`). Detail-Fenster zeigt „Art: km in Zeit · Tempo“.
  - Sprint: Übungen eine pro Zeile (gleiches Feld `f-ex` wie Krafttraining); Knopf „Sprint abhaken“ öffnet pro Übung eine Karte mit **runden Satz-Knöpfen zum einzeln Abhaken** (`.sex`/`.sset`, `sprintHTML`, `sSet`), rechts − / + für die Satzzahl (1–20), oben „x/y“, ganz geschafft = Name durchgestrichen; unten „x von y Sätzen erledigt“. Satzzahl beim Öffnen: vom letzten Mal (`lastSprint`), sonst Zahl vorne im Namen („4× 30 m“, „3x …“), sonst 1. „+ Übung“ (gemeinsamer Block `#w-adder` für Krafttraining und Sprint) fügt eine Übung nur für dieses Workout hinzu. Detail-Fenster zeigt je Übung „x/y“.
  - **Fortschritt** (`#ov-progress`, `progressData`, `chartSVG`, `renderProgress`): Reiter Krafttraining / Laufen (nur mit Daten; ein Reiter → Leiste ausgeblendet). Pro Übung eine Karte mit Liniendiagramm (eigenes SVG, eine Linie in `--accent`, kein Indigo, da Indigo = Stufen): Krafttraining = schwerstes Gewicht pro Tag (ohne kg: meiste Wdh.), Laufen = Tempo pro Art (y umgedreht, oben = schneller, 15-s-Raster). Rechts aktueller Wert + Veränderung seit dem ersten Eintrag; Punkt antippen/überfahren zeigt Datum + Details in der Zeile über dem Diagramm. Sortiert nach letztem Eintrag. Sprint hat keinen Verlauf.
  - Speichern hakt den Termin ab (bei Sprint, sobald mindestens ein Satz abgehakt ist). Nur Vorkommen bis heute lassen sich eintragen/abhaken.
- Weiter: wiederkehrende Termine (täglich/wöchentlich/2-wöchentlich, Wochentage, Enddatum, Ausnahmen pro Vorkommen), Bemerkungen, beliebige Dauer, .ics-Import, Orte & Wegzeiten, helles/dunkles Design, Offline-Puffer und Abgleich zwischen Geräten.

## Technik
- Vite + reines JavaScript (kein Framework), PWA über `vite-plugin-pwa`, Supabase für Login (E-Mail + Passwort) und Speicherung (eine Zeile JSON pro Konto, Realtime-Abgleich). Hosting: Vercel, verbunden mit GitHub.
- Supabase-Adresse und **publishable** Schlüssel stehen in `src/config.js` (öffentlich gewollt). **Niemals** einen secret/service_role-Schlüssel ins Repo.
- Sign-ups sollen in Supabase abgeschaltet sein (nur Theo nutzt die App).

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst: Lade-, Anmelde-, Konfig-Bildschirm, Kalender, alle Dialoge (Termin, To-do, Workout, Einstellungen, Hilfe, …); setzt im `<head>` das gespeicherte Design |
| `src/main.js` | Start, Anmeldung, Fehler-/Zeitlimit-Anzeige, Konto-Menü, Hell/Dunkel-Schalter, verbindet App und Store |
| `src/urlcheck.js` | Wird vor Supabase geladen; fängt Fehler aus E-Mail-Links ab |
| `src/supabase.js` / `src/config.js` | Supabase-Client und Zugangsdaten |
| `src/app.js` | Die ganze Kalenderlogik und Darstellung (`startApp({initial,onChange})`, gibt `replaceState` zurück). ~1400 Zeilen – bei größeren Umbauten in Module aufteilen |
| `src/store.js` | Speichern in Tabelle `calendar_state`, lokaler Cache, Abgleich, Offline-Puffer |
| `src/style.css` | Gestaltung mit Farb-Tokens, helles und dunkles Design (neuere Regeln stehen gesammelt am Dateiende) |
| `supabase/schema.sql` | Tabelle + Row Level Security + Realtime |

Wichtige Stellen in `app.js`: `normalize` (Migrationen), `buildEV` (Einzeltermine der Woche), `schedule` (Planer), `render` (alles neu zeichnen + speichern + Rückgängig), `renderGrid`, `openForm`/Formular-Submit, `openDetail`, Drag & Drop (`pointerdown`/`endDrag`, auch für To-do-Karten), `openWorkout`, `renderHabits`, `renderTodos`, `renderQuick`.

## Datenmodell (`state`, ein JSON pro Konto)
- `cats`: `{id,name,tier,color,habit?}` · `places`: `{id,name}` · `home`: Orts-id · `travel`: `{"a|b": Minuten}` (Schlüssel sortiert, `pkey`)
- `events`: `{id,title,cat,day,start,dur,loc,note,locked,rec,ex,uid,done?,track?,exercises?,wlog?,rlog?,slog?,fromTodo?,due?}`
  - `day` = Tagesnummer ab Montag 9.11.2026 (`BASE`), kann negativ sein; `start`/`dur` in Minuten.
  - `rec` = `{freq:'daily'|'weekly'|'biweekly', days:[0-6]|null, until:Tagesnummer|null}`; `ex` = Ausnahmen `{[Tagesnummer]: 'skip' | {day,start}}`.
  - `uid` nur bei importierten Terminen (erneuter Import aktualisiert statt zu verdoppeln).
  - `done` = erledigte Vorkommen `{[Vorkommen]: 1}`.
  - `track` = `'gym'` | `'run'` | `'sprint'` | fehlt. `exercises` = Übungsnamen. `wlog` = `{[Vorkommen]: {[Übung]: [{reps, kg}, …]}}` (ein Eintrag pro Satz). `rlog` = `{[Vorkommen]: {km, sec, kind?}}` (`kind` = Art des Laufs, seit 19.11.). `slog` = `{[Vorkommen]: {[Übung]: [true|false je Satz]}}` (Sprint).
  - `fromTodo`, `due` bei Terminen, die aus einem To-do entstanden sind.
- `todos`: `[{id,title,cat,dur,due}]` (`due` = Tagesnummer oder null).
- `trackers`: `{gym, run, sprint}` (Standard alle an; fehlendes `sprint` ergänzt `normalize` mit an).
- Weitere Felder: `hidden` (Filter), `buffer`, `lockMode`, `sleep`, `nextId`.
- Migrationen in `normalize`: Kategorien ohne gültige Farbe bekommen die erste freie aus `COLORS`; früheres `event.habit` → `cat.habit`; Termine mit `exercises` ohne `track` → `'gym'`; `wlog` im Zwischenformat `{sets,reps,kg}` → Liste mit entsprechend vielen gleichen Sätzen (seit 19.11. wieder Satzlisten); `slog` als Namensliste (erstes Sprint-Format) → `{[Name]: [true]}`; fehlende `todos`/`trackers` ergänzen.
- Angezeigt und geplant wird mit Einzelterminen der sichtbaren Woche (`buildEV`), ids `"<id>@<tag>"`; Änderungen an Einzelterminen über `setInst`.

## Entscheidungen von Theo (nicht wieder rückgängig machen ohne Rückfrage)
- **Keine Ampelfarben** (Rot/Gelb/Grün) für Stufen (17.11.). Seit 19.11. abends zeigen Farben die **Kategorie**, die Stufe die **Füllung** (Variante „A“ aus einem Vergleich mit „Zeichen pro Stufe“).
- **Farben überarbeitet (19.11., Vorschlag „A+B“):** (Stufen-Indigo inzwischen durch Kategoriefarben ersetzt, s. Grundidee) Hintergründe leicht indigo-getönt (hell `--bg #e6e8f6`, `--surface #f8f9fe`; dunkel `#0c0e1c / #171a30`). **Akzentfarbe `--accent` = `#ff0000`** (Theos Wunsch, nicht ändern ohne Rückfrage) für „+ Termin“, Speichern, Schalter, Konto-Kreis, „heute“, Jetzt-Linie (`.nowline`, „Jetzt“-Karte) und die Linien im Fortschritt. Rot ist damit **nur Akzent, nie Stufe**. `--danger` (Fehler, Löschen) bleibt das dunklere `#c23a32`. `--today` (Spalte heute) ist ein neutrales Indigo-Tint, kein Rot. Die **heutige Spalte ist komplett in `--accent` umrahmt** (2 px, Kopf `.dh.today::after` ohne Unterkante + Spalte `.col.today::after` ohne Oberkante, `pointer-events:none`, z-index 6) (19.11.). `theme-color` hell/dunkel per `media` im `<head>`, Manifest `#e6e8f6`.
- **Keine unterschiedlichen Randlinien** je Stufe (gestrichelt/gepunktet) (17.11.).
- Ganzer Stufen-Kasten anklickbar statt „nur diese Stufe“-Text; Kategorie-Knöpfe ohne Zahlen und „nur“ (17.11.).
- „+ Termin“ oben neben „Einstellungen“ (Computer), runder Knopf unten rechts (Handy) (17.11.).
- Seltene Einstellungen (inkl. Festschreiben, Puffer) gesammelt hinter „Einstellungen“ (17.11.).
- **Kein inneres Scrollen** des Kalenders; Ausnahme seitliches Scrollen am Handy im Planen-Modus; Alltag am Handy = drei Tage ohne Seitwärts-Scrollen (18.11.).
- Gewohnheiten pro Kategorie, nicht pro Serie (18.11.).
- Workout-Tracker **sehr simpel**: nur Übung, Wdh., Gewicht, Vergleich mit letztem Mal; Laufen nur km + Zeit (18.11.), seit 19.11. plus Art des Laufs zum Vergleichen; dritte Art **Sprint** = Übungen mit Sätzen zum einzeln Abhaken, Übungen auch während des Trainings hinzufügbar (19.11.). Seit 19.11. **eine Zeile pro Satz**, damit Gewicht/Wdh. sich zwischen Sätzen unterscheiden können.
- **Termin-Fenster aufgeräumt** (19.11.): keine Beispiel-Texte in Titel und Bemerkung (leere Felder), keine Dauer-Vorschlagsknöpfe (nur Std./Min.), die drei Häkchen „Wiederkehrender Termin“, „Festschreiben“, „Gewohnheit verfolgen“ zusammen in einem Kasten (`.recbox.checks`) mit kurzen Texten. Bei neuem Termin ist die **Kategorie leer** (verstecktes leeres `<option>`), Speichern ohne Kategorie → „Wähle eine Kategorie.“; leere `.catinfo`-Zeilen sind ausgeblendet. Nicht wieder mit Erklärtexten vollstopfen.
- Chess.com/Strava-Anbindung besprochen, vorerst nicht gewollt (18.11.). Chess.com ginge über die öffentliche API nur mit Benutzernamen; Strava bräuchte OAuth, ein Strava-Abo und eine Vercel-Funktion für das Client-Secret.

## Testen
Ohne echtes Supabase, mit nachgebautem Server und Playwright:

```bash
VITE_SUPABASE_OVERRIDE=true VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=testkey \
  npx vite build --outDir dist-mock --emptyOutDir
mkdir -p tests/out
node tests/e2e-sync.cjs dist-mock tests/out tests/beispiel-stundenplan.ics   # Login, Sync zwischen 2 Geräten, offline, Import, Abmelden → endet mit ERRORS []
node tests/e2e-email-link.cjs dist-mock                                     # abgelaufener und gültiger E-Mail-Link → endet mit ERRORS []
node tests/e2e-timeout.cjs dist-mock                                        # Server antwortet nicht → gibt "help: Fehlermeldung: …" aus (kein ERRORS-Zeile; Exit 0 = ok)
npm run build
```
- **Eigene Prüf-Skripte für neue Funktionen:** die ersten 40 Zeilen von `tests/e2e-sync.cjs` in eine Datei `tests/zz-….cjs` kopieren (enthält statischen Server auf Port 4173, Supabase-Attrappe mit `db`/`USER`, `mk(opts)` für neue Browser-Kontexte, `A` = Computer-Kontext 1280×860, `errors`, `sleep`), eigenen Ablauf anhängen, mit `})();` schließen, ausführen und **danach wieder löschen**. Handy: `mk({viewport:{width:390,height:844},hasTouch:true,isMobile:true})`. Login: `#a-mail` test@example.com, `#a-pw` `richtiges-pw`, `#a-submit`.
- Die App rechnet mit dem echten heutigen Datum; Testtermine relativ dazu wählen. Standard-Kategorien-ids: `uni`, `ges`, `job` (Stufe 1), `lern` (2), `train`, `freunde` (3).

## Bekannte Grenzen / mögliche nächste Schritte
- Planer prüft nur die angezeigte Woche.
- .ics-Import ist einmalig (kein laufender Abgleich mit Google/Apple).
- To-dos (besprochen, noch offen): Hinweis, wenn die Frist näher rückt und kein Zeitblock geplant ist; eingeplante, nicht abgehakte To-dos nach ihrer Zeit zurück in die Ablage.
- Fortschritt (19.11. eingebaut): mögliche Erweiterungen nur auf Wunsch (z. B. Zeitraum wählen, Distanz statt Tempo, Sprint-Verlauf).
- Keine Push-Erinnerungen, keine ganztägigen oder mitternachtsübergreifenden Termine, Wegzeiten von Hand.
