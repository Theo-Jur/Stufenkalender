import './style.css';
import { linkError } from './urlcheck.js';
import { supabase, configured } from './supabase.js';
import { createStore } from './store.js';
import { startApp } from './app.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['screen-loading', 'screen-config', 'screen-login', 'app'];
function show(id) { SCREENS.forEach((s) => { $(s).hidden = s !== id; }); }

const STATUS_TEXT = {
  saving: 'Wird gespeichert …',
  saved: 'Gespeichert',
  offline: 'Offline, wird später synchronisiert',
  error: 'Speichern fehlgeschlagen, neuer Versuch läuft'
};

let booted = false;
// Kommt man über den "Passwort vergessen"-Link, steht type=recovery in der Adresse
let authMode = /type=recovery/.test(location.hash) ? 'recover' : 'login'; // login | signup | forgot | recover

/* ---------- Hängt der Start? Dann Hilfe und Fehlermeldung zeigen ---------- */
const startErrors = [];
function noteError(msg) {
  if (!msg) return;
  startErrors.push(String(msg));
  if (!$('screen-loading').hidden) showLoadHelp();
}
window.addEventListener('error', (e) => noteError(e.message));
window.addEventListener('unhandledrejection', (e) => noteError(e.reason && (e.reason.message || e.reason)));
function showLoadHelp() {
  $('loadhelp').hidden = false;
  $('loaderr').hidden = !startErrors.length;
  $('loaderr').textContent = startErrors.length ? 'Fehlermeldung: ' + startErrors.slice(-3).join(' · ') : '';
}
setTimeout(() => { if (!$('screen-loading').hidden) showLoadHelp(); }, 10000);
$('reloadbtn').onclick = () => location.reload();

if (!configured) {
  show('screen-config');
} else {
  init().catch((e) => noteError(e && e.message));
}

async function init() {
  supabase.auth.onAuthStateChange((event, session) => {
    // Nichts direkt hier drin aufrufen, das wieder Supabase benutzt (kann sonst hängen bleiben)
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') { showLogin('recover'); return; }
      // Nur nach echtem Abmelden neu laden, nie beim Start (sonst Endlosschleife)
      if (event === 'SIGNED_OUT') { if (booted) location.reload(); return; }
      if (event === 'SIGNED_IN' && session && !booted && authMode !== 'recover') boot(session).catch((e) => noteError(e && e.message));
    }, 0);
  });
  const { data: { session } } = await withTimeout(supabase.auth.getSession(), 10000, 'Anmeldestatus');
  if (authMode === 'recover') showLogin('recover');
  else if (session) await boot(session);
  else {
    showLogin('login');
    if (linkError) showLinkError();
  }
}

function showLinkError() {
  const expired = /expired|invalid|otp/i.test(linkError.code + ' ' + linkError.description);
  $('a-err').textContent = expired
    ? 'Der Link aus der E-Mail ist abgelaufen oder wurde schon benutzt. Versuch dich einfach mit E-Mail und Passwort anzumelden. Klappt das nicht, lass dir unten einen neuen Bestätigungslink schicken.'
    : 'Der Link aus der E-Mail hat nicht funktioniert (' + (linkError.description || linkError.code) + '). Melde dich mit E-Mail und Passwort an oder lass dir einen neuen Link schicken.';
  $('a-err').hidden = false;
  $('a-resend').hidden = false;
}

function withTimeout(promise, ms, what) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ': keine Antwort vom Server nach ' + ms / 1000 + ' s')), ms))]);
}

/* ---------- Kalender starten ---------- */
async function boot(session) {
  if (booted) return;
  booted = true;
  show('screen-loading');
  let app = null;
  const store = createStore({
    client: supabase,
    userId: session.user.id,
    onStatus: (s) => { const el = $('syncstat'); if (el) { el.dataset.s = s; el.textContent = STATUS_TEXT[s] || ''; } },
    onRemote: (data) => app && app.replaceState(data)
  });
  const initial = await store.load();
  show('app');
  app = startApp({ initial, onChange: (data) => store.save(data) });
  store.startLiveUpdates();
  $('acctmail').textContent = session.user.email || '';
  // Anmeldedaten aus dem E-Mail-Link nicht in der Adresse stehen lassen
  if (/access_token|refresh_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  $('logout').onclick = async () => {
    await store.flush();
    store.clearLocal();
    await supabase.auth.signOut();
  };
}

/* ---------- Anmeldung ---------- */

const MESSAGES = [
  [/invalid login credentials/i, 'E-Mail oder Passwort stimmt nicht.'],
  [/email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir geschickt haben.'],
  [/already registered|already exists/i, 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.'],
  [/signups? not allowed|signup is disabled/i, 'Neue Konten sind für diese App gesperrt.'],
  [/password should be at least|weak password/i, 'Das Passwort ist zu kurz oder zu einfach. Nimm mindestens 8 Zeichen.'],
  [/rate limit|too many/i, 'Zu viele Versuche. Warte ein paar Minuten und versuch es dann noch einmal.'],
  [/failed to fetch|network/i, 'Keine Verbindung zum Server. Prüfe dein Internet.'],
  [/same password|different from the old/i, 'Das neue Passwort muss sich vom alten unterscheiden.']
];
const translate = (msg) => (MESSAGES.find(([re]) => re.test(msg || '')) || [null, 'Das hat nicht geklappt: ' + msg])[1];

function showLogin(mode) {
  authMode = mode;
  const cfg = {
    login:   { lead: 'Melde dich an, um deine Termine auf allen Geräten zu sehen.', btn: 'Anmelden', mail: true, pw: true, toggle: 'Noch kein Konto? Konto anlegen', forgot: true },
    signup:  { lead: 'Leg dein Konto an. Danach bekommst du eine E-Mail zum Bestätigen.', btn: 'Konto anlegen', mail: true, pw: true, toggle: 'Schon ein Konto? Anmelden', forgot: false },
    forgot:  { lead: 'Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.', btn: 'Link schicken', mail: true, pw: false, toggle: 'Zurück zur Anmeldung', forgot: false },
    recover: { lead: 'Leg jetzt dein neues Passwort fest.', btn: 'Passwort speichern', mail: false, pw: true, toggle: '', forgot: false }
  }[mode];
  $('authlead').textContent = cfg.lead;
  $('a-submit').textContent = cfg.btn;
  $('a-mailrow').hidden = !cfg.mail;
  $('a-pwrow').hidden = !cfg.pw;
  $('a-pw').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('a-toggle').hidden = !cfg.toggle;
  $('a-toggle').textContent = cfg.toggle;
  $('a-forgot').hidden = !cfg.forgot;
  $('a-resend').hidden = true;
  $('a-err').hidden = true;
  $('a-ok').hidden = true;
  show('screen-login');
}

$('a-toggle').onclick = () => showLogin(authMode === 'login' ? 'signup' : 'login');
$('a-forgot').onclick = () => showLogin('forgot');
$('a-resend').onclick = async () => {
  const email = $('a-mail').value.trim();
  const fail = (m) => { $('a-err').textContent = m; $('a-err').hidden = false; $('a-ok').hidden = true; };
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Trag oben deine E-Mail-Adresse ein, dann schicke ich den Link erneut.');
  $('a-resend').disabled = true;
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin } });
    if (error) return fail(translate(error.message));
    $('a-ok').textContent = 'Neuer Bestätigungslink ist unterwegs. Klick ihn bitte nur einmal an.';
    $('a-ok').hidden = false; $('a-err').hidden = true;
  } catch (e) { fail(translate(e && e.message)); } finally { $('a-resend').disabled = false; }
};

$('authform').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $('a-mail').value.trim(), password = $('a-pw').value;
  const fail = (m) => { $('a-err').textContent = m; $('a-err').hidden = false; $('a-ok').hidden = true; };
  const ok = (m) => { $('a-ok').textContent = m; $('a-ok').hidden = false; $('a-err').hidden = true; };
  if (authMode !== 'recover' && !/^\S+@\S+\.\S+$/.test(email)) return fail('Gib eine gültige E-Mail-Adresse ein.');
  if (authMode !== 'forgot' && password.length < 8) return fail('Das Passwort braucht mindestens 8 Zeichen.');
  $('a-submit').disabled = true;
  try {
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { fail(translate(error.message)); if (/not confirmed/i.test(error.message)) $('a-resend').hidden = false; return; }
    } else if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) return fail(translate(error.message));
      if (!data.session) ok('Fast geschafft: Wir haben dir eine E-Mail geschickt. Klick auf den Link darin und melde dich danach hier an.');
    } else if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (error) return fail(translate(error.message));
      ok('Wenn es ein Konto mit dieser E-Mail gibt, ist der Link unterwegs.');
    } else if (authMode === 'recover') {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return fail(translate(error.message));
      authMode = 'login';
      history.replaceState(null, '', location.pathname);
      boot(data.user ? (await supabase.auth.getSession()).data.session : null);
    }
  } catch (e) {
    fail(translate(e && e.message));
  } finally {
    $('a-submit').disabled = false;
  }
});
