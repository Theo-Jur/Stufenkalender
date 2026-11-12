import './style.css';
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

if (!configured) {
  show('screen-config');
} else {
  init();
}

async function init() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { showLogin('recover'); return; }
    if (event === 'SIGNED_OUT') { location.reload(); return; }
    if (event === 'SIGNED_IN' && session && !booted && authMode !== 'recover') boot(session);
  });
  const { data: { session } } = await supabase.auth.getSession();
  if (authMode === 'recover') showLogin('recover');
  else if (session) boot(session);
  else showLogin('login');
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
  $('a-err').hidden = true;
  $('a-ok').hidden = true;
  show('screen-login');
}

$('a-toggle').onclick = () => showLogin(authMode === 'login' ? 'signup' : 'login');
$('a-forgot').onclick = () => showLogin('forgot');

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
      if (error) return fail(translate(error.message));
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
