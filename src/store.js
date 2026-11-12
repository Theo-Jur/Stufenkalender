// Speichert den Kalender in Supabase und hält eine Kopie im Browser,
// damit die App auch offline startet. Bei mehreren Geräten gewinnt die jüngste Änderung.
//
// Tabelle: calendar_state (user_id, data, updated_at) – siehe supabase/schema.sql

const TABLE = 'calendar_state';
const CACHE_PREFIX = 'stufenkalender-cache:';
const DEBOUNCE_MS = 800;
const RETRY_MS = 15000;

export function createStore({ client, userId, onRemote, onStatus }) {
  const cacheKey = CACHE_PREFIX + userId;
  let lastJson = null;     // zuletzt gespeicherter oder geladener Stand
  let lastStamp = null;    // updated_at dieses Stands
  let pending = null;      // noch nicht hochgeladene Daten
  let pendingJson = null;
  let saving = false;
  let timer = null;
  let retryTimer = null;
  let channel = null;

  const status = (s) => onStatus && onStatus(s);

  function readCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { return null; }
  }
  function writeCache(data, stamp, dirty) {
    try { localStorage.setItem(cacheKey, JSON.stringify({ data, stamp, dirty })); } catch { /* Speicher voll oder gesperrt */ }
  }

  async function fetchRow() {
    // Nach 8 Sekunden aufgeben und mit der lokalen Kopie weitermachen
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const { data, error } = await client.from(TABLE).select('data, updated_at').eq('user_id', userId).abortSignal(ctrl.signal).maybeSingle();
    clearTimeout(t);
    if (error) throw error;
    return data;
  }

  // Beim Start: Server-Stand holen, außer es gibt lokal neuere, noch nicht hochgeladene Änderungen
  async function load() {
    const cache = readCache();
    try {
      const row = await fetchRow();
      if (cache && cache.dirty && (!row || new Date(cache.stamp) > new Date(row.updated_at))) {
        if (row) lastStamp = row.updated_at;
        save(cache.data);
        return cache.data;
      }
      if (row) {
        lastJson = JSON.stringify(row.data);
        lastStamp = row.updated_at;
        writeCache(row.data, row.updated_at, false);
        status('saved');
        return row.data;
      }
      return cache ? cache.data : null;
    } catch (e) {
      // Ohne lokale Kopie lieber nicht starten: sonst würde ein leerer Kalender die Daten auf dem Server überschreiben
      if (!cache) throw new Error('Kalender konnte nicht geladen werden (' + (e && e.message ? e.message : 'keine Verbindung') + ')');
      console.warn('Laden fehlgeschlagen, nutze lokale Kopie', e);
      if (!cache.dirty) { lastJson = JSON.stringify(cache.data); lastStamp = cache.stamp; }
      status('offline');
      return cache.data;
    }
  }

  function save(data) {
    const json = JSON.stringify(data);
    if (json === lastJson && !pending) return;
    if (json === pendingJson) return;
    pending = data;
    pendingJson = json;
    writeCache(data, new Date().toISOString(), true);
    status('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  async function flush() {
    if (!pending || saving) return;
    saving = true;
    const data = pending, json = pendingJson;
    pending = null; pendingJson = null;
    const stamp = new Date().toISOString();
    try {
      const { error } = await client.from(TABLE).upsert({ user_id: userId, data, updated_at: stamp });
      if (error) throw error;
      lastJson = json;
      lastStamp = stamp;
      if (!pending) { writeCache(data, stamp, false); status('saved'); }
    } catch (e) {
      console.warn('Speichern fehlgeschlagen, versuche es später erneut', e);
      if (!pending) { pending = data; pendingJson = json; }
      status(navigator.onLine === false ? 'offline' : 'error');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(flush, RETRY_MS);
    } finally {
      saving = false;
      if (pending) { clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS); }
    }
  }

  // Änderung von einem anderen Gerät übernehmen
  function applyRemote(row) {
    if (!row || !row.updated_at) return;
    if (row.updated_at === lastStamp) return;
    if (lastStamp && new Date(row.updated_at) <= new Date(lastStamp)) return;
    if (pending || saving) return; // eigene Änderung ist unterwegs und gewinnt
    lastJson = JSON.stringify(row.data);
    lastStamp = row.updated_at;
    writeCache(row.data, row.updated_at, false);
    onRemote && onRemote(row.data);
    status('saved');
  }

  async function refresh() {
    try { applyRemote(await fetchRow()); } catch { /* offline, später erneut */ }
  }

  function startLiveUpdates() {
    channel = client
      .channel('calendar-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'user_id=eq.' + userId },
        (payload) => applyRemote(payload.new))
      .subscribe();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refresh(); flush(); } });
    window.addEventListener('online', () => { flush(); refresh(); });
    window.addEventListener('offline', () => status('offline'));
  }

  function clearLocal() {
    try { localStorage.removeItem(cacheKey); } catch { /* egal */ }
    if (channel) client.removeChannel(channel);
  }

  return { load, save, flush, refresh, startLiveUpdates, clearLocal };
}
