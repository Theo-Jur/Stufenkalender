const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = process.argv[2], OUT = process.argv[3], ICS = process.argv[4];
// kleiner statischer Server mit SPA-Fallback
const srv = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
  const ext = path.extname(p); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'content-type': (types[ext] || 'application/octet-stream') + '; charset=utf-8' }); fs.createReadStream(p).pipe(res);
}).listen(4173);
// Supabase-Attrappe
const db = {}; const USER = { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com' };
let offline = false;
async function mock(route) {
  const req = route.request(), url = new URL(req.url());
  if (url.hostname !== 'mock.supabase.co') return route.continue();
  if (offline) return route.abort('internetdisconnected');
  if (url.pathname === '/auth/v1/token') {
    const body = JSON.parse(req.postData() || '{}');
    if (body.password !== 'richtiges-pw') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'ref', user: USER }) });
  }
  if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
  if (url.pathname === '/rest/v1/calendar_state') {
    if (req.method() === 'GET') {
      const row = db[USER.id]; const acc = req.headers()['accept'] || '';
      if (acc.includes('vnd.pgrst.object')) return row ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) }) : route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
    }
    if (req.method() === 'POST') { const b = JSON.parse(req.postData()); const r = Array.isArray(b) ? b[0] : b; db[r.user_id] = { data: r.data, updated_at: r.updated_at }; return route.fulfill({ status: 201, body: '' }); }
  }
  return route.fulfill({ status: 404, body: '' });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (opts = {}) => { const c = await browser.newContext({ serviceWorkers: 'block', ...opts }); await c.route('**/*', mock); const p = await c.newPage(); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/websocket|realtime|ERR_INTERNET|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); }); return { c, p }; };
  const A = await mk({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  await A.p.goto('http://localhost:4173/'); await A.p.waitForSelector('#screen-login:not([hidden])');
  await A.p.screenshot({ path: OUT + '/1-login.png' });
  await A.p.fill('#a-mail', 'test@example.com'); await A.p.fill('#a-pw', 'falsches-pw'); await A.p.click('#a-submit');
  await A.p.waitForSelector('#a-err:not([hidden])'); console.log('wrong pw ->', await A.p.textContent('#a-err'));
  await A.p.fill('#a-pw', 'richtiges-pw'); await A.p.click('#a-submit');
  await A.p.waitForSelector('#app:not([hidden])'); console.log('logged in, mail:', await A.p.textContent('#acctmail'));
  await sleep(1200); console.log('server row after first start:', !!db[USER.id], 'events', db[USER.id] && db[USER.id].data.events.length, 'status', await A.p.textContent('#syncstat'));
  // Termin anlegen
  await A.p.click('#add'); await A.p.fill('#f-title', 'Klausur Mathe'); await A.p.fill('#f-day', '2026-11-13'); await A.p.fill('#f-time', '10:00');
  await A.p.selectOption('#f-cat', 'uni'); await A.p.click('#form button[type=submit]');
  console.log('status right after save:', await A.p.textContent('#syncstat')); await sleep(1500);
  console.log('server events:', db[USER.id].data.events.map((e) => e.title), 'status', await A.p.textContent('#syncstat'));
  // Zweites Gerät
  const B = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await B.p.goto('http://localhost:4173/'); await B.p.fill('#a-mail', 'test@example.com'); await B.p.fill('#a-pw', 'richtiges-pw'); await B.p.click('#a-submit');
  await B.p.waitForSelector('#app:not([hidden])'); await sleep(500);
  console.log('device B sees:', await B.p.$$eval('.ev .t', (els) => els.map((e) => e.textContent)));
  // Änderung auf A, B holt sie beim Zurückkommen
  await A.p.click('#add'); await A.p.fill('#f-title', 'Training'); await A.p.fill('#f-day', '2026-11-13'); await A.p.fill('#f-time', '17:00'); await A.p.selectOption('#f-cat', 'train'); await A.p.click('#form button[type=submit]');
  await sleep(1500); await B.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(600);
  console.log('device B after refresh:', await B.p.$$eval('.ev .t', (els) => els.map((e) => e.textContent)));
  // Offline auf A
  offline = true; await A.c.setOffline(true); await A.p.evaluate(() => window.dispatchEvent(new Event('offline')));
  await A.p.click('#add'); await A.p.fill('#f-title', 'Offline-Termin'); await A.p.fill('#f-day', '2026-11-14'); await A.p.fill('#f-time', '11:00'); await A.p.click('#form button[type=submit]');
  await sleep(1500); console.log('offline status:', await A.p.textContent('#syncstat'), '| server has', db[USER.id].data.events.length);
  offline = false; await A.c.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(1500);
  console.log('after online:', await A.p.textContent('#syncstat'), '| server has', db[USER.id].data.events.map((e) => e.title));
  // Neu laden: Sitzung bleibt
  await A.p.reload(); await A.p.waitForSelector('#app:not([hidden])', { timeout: 5000 }); console.log('reload keeps session, events:', await A.p.$$eval('.ev .t', (els) => els.length));
  // Import
  await A.p.click('#setbtn'); await A.p.click('#impbtn'); await A.p.setInputFiles('#i-file', ICS); await A.p.waitForSelector('#i-opts:not([hidden])');
  console.log('import summary:', (await A.p.textContent('#i-sum')).replace(/\s+/g, ' '));
  await A.p.click('#i-ok'); await sleep(1500); console.log('server events after import:', db[USER.id].data.events.length);
  await A.p.screenshot({ path: OUT + '/2-app-desktop.png' });
  await B.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(600);
  await B.p.click('[data-mode="daily"]'); await sleep(300); await B.p.screenshot({ path: OUT + '/3-alltag-handy.png' });
  // Abmelden
  await A.p.click('#acctbtn'); await A.p.click('#logout'); await A.p.waitForSelector('#screen-login:not([hidden])', { timeout: 5000 }); console.log('logout ok, cache cleared:', await A.p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('stufenkalender-cache')).length === 0));
  console.log('ERRORS', errors);
  await browser.close(); srv.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
