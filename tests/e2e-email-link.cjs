const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const DIST=process.argv[2];
const srv=http.createServer((q,r)=>{let p=path.join(DIST,q.url.split('?')[0]); if(!fs.existsSync(p)||fs.statSync(p).isDirectory()) p=path.join(DIST,'index.html'); const t={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(p)]||'application/octet-stream'; r.writeHead(200,{'content-type':t}); fs.createReadStream(p).pipe(r);}).listen(4175);
const USER={id:'u1',aud:'authenticated',role:'authenticated',email:'a@b.de'}; let resend=0;
(async()=>{const b=await chromium.launch(); const errs=[];
const mk=async()=>{const c=await b.newContext({serviceWorkers:'block'}); await c.route('**/*',async route=>{const u=new URL(route.request().url()); if(u.hostname!=='mock.supabase.co') return route.continue();
 if(u.pathname==='/auth/v1/user') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(USER)});
 if(u.pathname==='/auth/v1/resend'){resend++; return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
 if(u.pathname==='/rest/v1/calendar_state') return route.request().method()==='GET'?route.fulfill({status:200,contentType:'application/json',body:'[]'}):route.fulfill({status:201,body:''});
 return route.fulfill({status:404,body:''});}); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;};
// 1) abgelaufener Link
let p=await mk(); let navs=0; p.on('framenavigated',f=>{if(f===p.mainFrame()) navs++;});
await p.goto('http://localhost:4175/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
await new Promise(r=>setTimeout(r,3000));
console.log('expired link -> navigations:',navs,'| url:',p.url(),'| login visible:',await p.isVisible('#screen-login'),'| resend visible:',await p.isVisible('#a-resend'));
console.log('message:',await p.textContent('#a-err'));
await p.fill('#a-mail','a@b.de'); await p.click('#a-resend'); await new Promise(r=>setTimeout(r,800)); console.log('resend calls:',resend,'|',await p.textContent('#a-ok'));
// 2) gültiger Link
p=await mk(); await p.goto('http://localhost:4175/#access_token=tok&expires_at='+(Math.floor(Date.now()/1000)+3600)+'&expires_in=3600&refresh_token=ref&token_type=bearer&type=signup');
await p.waitForSelector('#app:not([hidden])',{timeout:10000}); await new Promise(r=>setTimeout(r,500));
console.log('valid link -> app shown, mail:',await p.textContent('#acctmail'),'| url:',p.url());
console.log('ERRORS',errs); await b.close(); srv.close();})().catch(e=>{console.log('FAIL',e.message);process.exit(1)});
