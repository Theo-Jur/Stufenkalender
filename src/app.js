// Die eigentliche Kalender-App. Wird von main.js gestartet, sobald Anmeldung und Daten bereit sind.
export function startApp({initial=null,onChange=null}={}){
const DAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
const DAYS_LONG=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
// Tage werden als fortlaufende Nummer gezählt: 0 = Montag, 9.11.2026
const BASE=new Date(2026,10,9);
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const dateOf=d=>new Date(2026,10,9+d);
const dayOfDate=dt=>Math.round((new Date(dt.getFullYear(),dt.getMonth(),dt.getDate())-BASE)/86400000);
const wdi=d=>((d%7)+7)%7;
const wd=d=>DAYS[wdi(d)], wdl=d=>DAYS_LONG[wdi(d)];
const dtxt=d=>{const x=dateOf(d); return `${x.getDate()}.${x.getMonth()+1}.`;};
const isoDate=d=>{const x=dateOf(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
const fromIso=v=>{if(!v) return null; const [y,m,dd]=v.split('-').map(Number); if(!y) return null; return dayOfDate(new Date(y,m-1,dd));};
function isoWeek(dt){const t=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())); const n=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-n); const y=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y)/86400000+1)/7);}
const NOW=(()=>{const n=new Date(); return {day:dayOfDate(n),min:n.getHours()*60+n.getMinutes(),real:true};})();
const TODAY=NOW.day, END=24*60, PX=0.8, STEP=15;
const CURWEEK=Math.floor(TODAY/7);
let VIEW=CURWEEK; // angezeigte Woche
const weekDays=()=>[0,1,2,3,4,5,6].map(i=>VIEW*7+i);
let mode='plan';
const narrow=matchMedia('(max-width:700px)');
let START=6*60;
const TIERS={1:{name:'Fix',rule:'wird nie verschoben'},2:{name:'Wichtig',rule:'weicht nur Stufe 1 aus'},3:{name:'Flexibel',rule:'weicht allem aus'}};
const COLORS=['red','orange','yellow','green','teal','blue','violet','pink'];
const TC={1:'red',2:'yellow',3:'green'}; // Farbe = Priorität
const COLOR_NAMES={red:'Rot',orange:'Orange',yellow:'Gelb',green:'Grün',teal:'Türkis',blue:'Blau',violet:'Violett',pink:'Pink'};
const KEY='stufenkalender-v2';

// Startkategorien für ein neues Konto
const SEED_CATS=[
 {id:'uni',name:'Uni',tier:1,color:'blue'},
 {id:'ges',name:'Gesundheit',tier:1,color:'red'},
 {id:'job',name:'Job',tier:1,color:'violet'},
 {id:'lern',name:'Lernen',tier:2,color:'orange'},
 {id:'train',name:'Training',tier:3,color:'green'},
 {id:'freunde',name:'Freunde',tier:3,color:'pink'}
];
const DEFAULT_TRAVEL=30;
const pkey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
function fresh(){return {cats:clone(SEED_CATS),events:[],hidden:{},buffer:15,nextId:100,
  sleep:{mode:'split',wd:{wake:420,bed:1380},we:{wake:540,bed:30},days:null},
  places:[{id:'home',name:'Zuhause'}],home:'home',travel:{},lockMode:'eve'};}
function normalize(s){return (s&&Array.isArray(s.events)&&Array.isArray(s.cats))?Object.assign(fresh(),clone(s)):fresh();}
let state=normalize(initial);
const placeName=id=>(state.places.find(p=>p.id===id)||{name:'?'}).name;
function travel(a,b){if(!a||!b||a===b) return {min:0,est:false}; const v=state.travel[pkey(a,b)]; return v==null?{min:DEFAULT_TRAVEL,est:true}:{min:v,est:false};}
function save(){ if(onChange) onChange(clone(state)); }
function clone(x){return JSON.parse(JSON.stringify(x));}
const fmt=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=id=>document.getElementById(id);
const catOf=e=>state.cats.find(c=>c.id===e.cat)||{id:'?',name:'Ohne Kategorie',tier:3,color:'teal'};
const tierOf=e=>catOf(e).tier;
const visible=e=>!state.hidden[e.cat];

/* ---------- Serien → einzelne Termine der angezeigten Woche ---------- */
function occursOn(e,d){
  if(!e.rec) return d===e.day;
  if(d<e.day) return false; if(e.rec.until!=null&&d>e.rec.until) return false;
  if(e.rec.freq==='daily') return true;
  const days=e.rec.days&&e.rec.days.length?e.rec.days:[wdi(e.day)];
  if(!days.includes(wdi(d))) return false;
  if(e.rec.freq==='biweekly') return ((Math.floor(d/7)-Math.floor(e.day/7))%2+2)%2===0;
  return true;
}
function buildEV(){
  const out=[], days=weekDays();
  state.events.forEach(e=>{
    days.forEach(d=>{
      if(!occursOn(e,d)) return;
      const ex=e.ex&&e.ex[d]; if(ex==='skip') return;
      const inst=Object.assign({},e,{id:e.id+'@'+d,sid:e.id,occ:d,day:ex?ex.day:d,start:ex?ex.start:e.start,series:!!e.rec});
      delete inst.ex; out.push(inst);
    });
  });
  return out;
}
let EV=[];
const seriesOf=iid=>state.events.find(x=>x.id===(EV.find(i=>i.id===iid)||{}).sid);
// Einen einzelnen Termin verschieben: bei Serien nur dieses eine Mal (Ausnahme)
function setInst(iid,day,start){
  const inst=EV.find(i=>i.id===iid); if(!inst) return; const s=state.events.find(x=>x.id===inst.sid); if(!s) return;
  if(!s.rec){s.day=day; s.start=start; return;}
  s.ex=s.ex||{}; if(day===inst.occ&&start===s.start) delete s.ex[inst.occ]; else s.ex[inst.occ]={day,start};
}

/* ---------- Schlaf ---------- */
const effBed=m=>m<12*60?END:m; // nach Mitternacht → bis Tagesende
if(!state.sleep.mode) state.sleep.mode=state.sleep.split===false?'same':'split';
function rawWake(d){d=wdi(d); const s=state.sleep; if(s.mode==='daily'&&s.days) return s.days[d].wake; return (s.mode==='split'&&d>=5?s.we:s.wd).wake;}
function rawBed(d){d=wdi(d); const s=state.sleep; if(s.mode==='daily'&&s.days) return s.days[d].bed; return (s.mode==='split'&&(d===4||d===5)?s.we:s.wd).bed;}
const wakeOf=d=>rawWake(d);
const bedOf=d=>effBed(rawBed(d));
const inSleep=(d,start,dur)=>start<wakeOf(d)||start+dur>bedOf(d);

/* ---------- Planer ---------- */
function clash(a,b,buf){return a.day===b.day && a.start<b.start+b.dur+buf && a.start+a.dur>b.start-buf;}
// Wo bin ich voraussichtlich zum Zeitpunkt t? Ort des letzten Termins davor, sonst Zuhause.
function locBefore(items,t){let loc=state.home,end=-1; items.forEach(p=>{const e=p.start+p.dur; if(p.loc&&e<=t&&e>end){end=e;loc=p.loc;}}); return loc;}
// Passt Kandidat c (day,start,dur,loc) zwischen die bereits gesetzten Termine – inkl. Puffer und Wegzeit?
function fits(c,placed,buf){
  const same=placed.filter(p=>p.day===c.day);
  const o=same.find(p=>clash(c,p,buf)); if(o) return {ok:false,by:o.id,kind:'overlap'};
  const end=c.start+c.dur;
  if(c.loc){
    const from=locBefore(same,c.start), t=travel(from,c.loc).min;
    const prev=same.filter(p=>p.start+p.dur<=c.start).sort((a,b)=>(b.start+b.dur)-(a.start+a.dur))[0];
    if(prev){ if(c.start-(prev.start+prev.dur)<t) return {ok:false,by:prev.id,kind:'travel',min:t}; }
    else if(c.start-t<wakeOf(c.day)) return {ok:false,kind:'early',min:t};
  }
  const next=same.filter(p=>p.start>=end).sort((a,b)=>a.start-b.start)[0];
  if(next&&next.loc){
    const from=c.loc||locBefore(same,c.start), t=travel(from,next.loc).min;
    if(next.start-end<t) return {ok:false,by:next.id,kind:'travel',min:t};
  }
  return {ok:true};
}
const nowAbs=()=>TODAY*1440+NOW.min;
// Warum ist ein Termin festgeschrieben? past = schon begonnen, manual = von dir, auto = Festschreib-Zeit erreicht
function lockReason(e){
  const abs=e.day*1440+e.start; if(abs<=nowAbs()) return 'past';
  if(e.locked) return 'manual';
  const lm=state.lockMode||'eve'; let at=Infinity;
  if(lm==='eve') at=(e.day-1)*1440+20*60; else if(lm==='24') at=abs-1440; else if(lm==='2') at=abs-120;
  return nowAbs()>=at?'auto':null;
}
function schedule(events,buf){
  const out={}, placed=[];
  const fixed=events.filter(e=>tierOf(e)===1||lockReason(e)).sort((a,b)=>tierOf(a)-tierOf(b));
  fixed.forEach(e=>{
    const pref={day:e.day,start:e.start,dur:e.dur,loc:e.loc}, lr=lockReason(e);
    let conflict=null;
    if(tierOf(e)!==1&&lr!=='past'){const r=fits(pref,placed,buf); if(!r.ok&&r.by) conflict=events.find(x=>x.id===r.by);}
    placed.push({id:e.id,...pref}); out[e.id]={day:e.day,start:e.start,moved:false,locked:lr,conflict};
  });
  const minAbs=Math.ceil((nowAbs()+1)/STEP)*STEP;
  const flex=events.filter(e=>tierOf(e)!==1&&!lockReason(e)).sort((a,b)=>tierOf(a)-tierOf(b)||(a.day*1440+a.start)-(b.day*1440+b.start));
  flex.forEach(e=>{
    const pref={day:e.day,start:e.start,dur:e.dur,loc:e.loc};
    const sleeping=inSleep(e.day,e.start,e.dur);
    const res=sleeping?null:fits(pref,placed,buf);
    if(res&&res.ok){placed.push({id:e.id,...pref});out[e.id]={day:e.day,start:e.start,moved:false};return;}
    const target=e.day*1440+e.start; let best=null,bestCost=Infinity;
    for(const d of weekDays()) for(let t=wakeOf(d); t<=bedOf(d)-e.dur; t+=STEP){
      const c={day:d,start:t,dur:e.dur,loc:e.loc};
      if(!fits(c,placed,buf).ok) continue;
      const v=d*1440+t; if(v<minAbs) continue;
      const cost=Math.abs(v-target)+(v<target?1:0);
      if(cost<bestCost){bestCost=cost;best=c;}
    }
    const by=sleeping?{sleep:true}:res.kind==='early'?{early:true,min:res.min}:Object.assign({},events.find(x=>x.id===res.by),{kind:res.kind,min:res.min});
    if(best){placed.push({id:e.id,...best});out[e.id]={day:best.day,start:best.start,moved:true,by};}
    else out[e.id]={unplaced:true,by};
  });
  return out;
}
// Wegzeiten nach dem fertigen Plan: von wo komme ich, wann muss ich los, reicht es?
function computeTravel(plan){
  const info={};
  for(const d of weekDays()){
    const items=EV.map(e=>({e,p:plan[e.id]})).filter(x=>x.p&&!x.p.unplaced&&x.p.day===d).sort((a,b)=>a.p.start-b.p.start);
    let cur=state.home,lastEnd=null;
    items.forEach(({e,p})=>{
      if(e.loc){
        const t=travel(cur,e.loc), leave=p.start-t.min;
        const tight=t.min>0&&(lastEnd!=null?leave<lastEnd:leave<wakeOf(d));
        info[e.id]={from:cur,min:t.min,est:t.est,leave,tight,gap:lastEnd!=null?p.start-lastEnd:null};
        cur=e.loc;
      }
      lastEnd=lastEnd==null?p.start+e.dur:Math.max(lastEnd,p.start+e.dur);
    });
  }
  return info;
}
let TRAVEL={}, PLAN={};
const LOCK_SVG='<svg class="lk" viewBox="0 0 12 12" aria-label="festgeschrieben"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>';

/* ---------- Render ---------- */
let prevPlan=null, flashIds=new Set();

function renderFilters(){
  const counts={}; state.events.forEach(e=>counts[e.cat]=(counts[e.cat]||0)+1);
  $('filters').innerHTML=[1,2,3].map(t=>{
    const cats=state.cats.filter(c=>c.tier===t);
    const on=cats.length===0||cats.some(c=>!state.hidden[c.id]);
    const chips=cats.length?cats.map(c=>{
      const vis=!state.hidden[c.id];
      return `<span class="chip k-${TC[c.tier]}" data-on="${vis}">
        <button type="button" class="ctog" data-cattog="${c.id}" aria-pressed="${vis}" title="${vis?'Ausblenden':'Einblenden'}"><span class="dot"></span>${esc(c.name)}<span class="count">${counts[c.id]||0}</span></button>
        <button type="button" class="solo" data-catsolo="${c.id}" aria-label="Nur ${esc(c.name)} ansehen">nur</button></span>`;}).join('')
      :'<span class="empty">Noch keine Kategorie in dieser Stufe.</span>';
    return `<div class="tgroup" data-on="${on}">
      <div class="thead">
        <button type="button" class="ttog" data-tiertog="${t}" aria-pressed="${on}" ${cats.length?'':'disabled'}>
          <span class="bstyle s${t}"></span><span><span class="nm">Stufe ${t} · ${TIERS[t].name}</span><span class="rule">${TIERS[t].rule}</span></span></button>
        ${cats.length?`<button type="button" class="linkbtn" data-tiersolo="${t}">nur diese Stufe</button>`:''}
      </div>
      <div class="chips">${chips}</div></div>`;
  }).join('');
  // Ansicht beschreiben
  const vis=state.cats.filter(c=>!state.hidden[c.id]);
  let txt;
  if(vis.length===state.cats.length) txt='<b>Alle Termine</b>';
  else if(vis.length===0) txt='<b>Nichts eingeblendet</b>';
  else{
    const tiers=[...new Set(vis.map(c=>c.tier))];
    const full=t=>state.cats.filter(c=>c.tier===t).every(c=>!state.hidden[c.id]);
    if(tiers.length===1 && full(tiers[0])) txt=`Nur <b>Stufe ${tiers[0]} · ${TIERS[tiers[0]].name}</b>`;
    else txt='Nur '+vis.map(c=>`<b>${esc(c.name)}</b>`).join(', ');
  }
  $('view').innerHTML='Ansicht: '+txt;
  $('showall').hidden=vis.length===state.cats.length;
  $('buf').value=String(state.buffer); $('lockm').value=state.lockMode||'eve';
}

function lanes(items){
  items.sort((a,b)=>a.start-b.start);
  const ends=[];
  items.forEach(it=>{let l=ends.findIndex(e=>e<=it.start); if(l<0){l=ends.length;ends.push(0);} ends[l]=it.start+it.dur; it.lane=l;});
  items.forEach(it=>{let m=it.lane; items.forEach(o=>{if(o.start<it.start+it.dur&&o.start+o.dur>it.start) m=Math.max(m,o.lane);}); it.cols=m+1;});
}

function shownDays(){
  const w=weekDays();
  if(mode==='daily'&&narrow.matches) return [TODAY,TODAY+1,TODAY+2].filter(d=>w.includes(d));
  return w;
}
function renderGrid(plan){
  const H=(END-START)*PX, daily=mode==='daily', days=shownDays();
  const g=$('grid'); g.style.gridTemplateColumns=`52px repeat(${days.length},minmax(0,1fr))`; g.style.minWidth=days.length===7?'760px':'0';
  let html='<div class="dh" aria-hidden="true"></div>';
  days.forEach(i=>html+=`<div class="dh${i===TODAY?' today':''}"><div class="d">${wd(i)}</div><div class="n">${dtxt(i)}${i===TODAY?' · heute':''}</div></div>`);
  let times='';
  for(let h=START/60+1;h<24;h++) times+=`<span style="top:${(h*60-START)*PX}px">${String(h).padStart(2,'0')}:00</span>`;
  html+=`<div class="times" style="height:${H}px">${times}</div>`;
  days.forEach(d=>{
    const items=[]; let ghosts='';
    const wk=wakeOf(d), bd=bedOf(d);
    if(wk>START) ghosts+=`<div class="sleep am" style="top:0;height:${(wk-START)*PX}px">${daily?'':'Schlaf bis '+fmt(wk)}</div>`;
    if(bd<END) ghosts+=`<div class="sleep pm" style="top:${(bd-START)*PX}px;height:${(END-bd)*PX}px">${daily?'':'Schlafen ab '+fmt(bd)}</div>`;
    EV.forEach(e=>{
      if(!visible(e)) return;
      const p=plan[e.id]; if(!p||p.unplaced) return;
      const c=catOf(e);
      if(p.day===d) items.push({e,p,c,start:p.start,dur:e.dur});
      if(!daily && p.moved && e.day===d) ghosts+=`<div class="ghost k-${TC[c.tier]}" style="top:${(e.start-START)*PX}px;height:${e.dur*PX}px">${fmt(e.start)} urspr.</div>`;
    });
    lanes(items);
    const evs=items.map(it=>{
      const {e,p,c}=it, w=100/it.cols;
      const pos=`top:${(p.start-START)*PX}px;height:${Math.max(e.dur*PX,22)}px;left:calc(${w*it.lane}% + 3px);width:calc(${w}% - 6px)`;
      const label=`${esc(e.title)}, ${wdl(p.day)} ${fmt(p.start)} bis ${fmt(p.start+e.dur)}, ${esc(c.name)}`;
      const where=e.loc?placeName(e.loc):(daily?'':c.name);
      const lock=p.locked&&p.locked!=='past'&&c.tier!==1?LOCK_SVG:'';
      const firstLine=e.note?e.note.split('\n')[0]:'';
      const inner=`<span class="t">${esc(e.title)}${e.series?'<span class="rp" title="Wiederkehrend">↻</span>':''}</span><span class="h">${lock}${fmt(p.start)}–${fmt(p.start+e.dur)}${where?' · '+esc(where):''}</span>${firstLine&&e.dur>=45?`<span class="nt">${esc(firstLine)}</span>`:''}`;
      const cls=`${p.moved?' prop':''}${p.locked==='past'?' past':''}`;
      const tr=TRAVEL[e.id]; let trv='';
      if(tr&&tr.min>0){
        const top=Math.max(0,tr.leave-START), h=(p.start-START-top)*PX;
        const txt=h>=11?`${tr.est?'ca. ':''}${tr.min} min ab ${esc(placeName(tr.from))}`:'';
        trv=`<div class="travel k-${TC[c.tier]}${tr.tight?' tight':''}" style="top:${top*PX}px;height:${h}px;left:calc(${w*it.lane}% + 3px);width:calc(${w}% - 12px)" title="${tr.min} min Weg ab ${esc(placeName(tr.from))}">${txt}</div>`;
      }
      const tag=p.moved?'<span class="pl">Vorschlag</span>':'';
      if(!daily&&p.moved) return `<button type="button" class="slotprop k-${TC[c.tier]}" data-accept="${e.id}" style="${pos}" title="Vorschlag übernehmen"><b>Vorschlag</b>${esc(e.title)}</button>`;
      if(daily) return `${trv}<button type="button" class="ev k-${TC[c.tier]} s${c.tier}${cls}" data-view="${e.id}" style="${pos}" aria-label="${label}${p.moved?', Vorschlag':''}, Details ansehen">${inner}${tag}</button>`;
      return `${trv}<button type="button" class="ev k-${TC[c.tier]} s${c.tier}${cls}${flashIds.has(e.id)?' flash':''}" data-id="${e.id}" style="${pos}" aria-label="${label}, Stufe ${c.tier}${p.moved?', Vorschlag':''}">
        ${inner}${tag}</button>`;
    }).join('');
    const nowl=(d===TODAY&&NOW.min>=START&&NOW.min<=END)?`<div class="nowline" style="top:${(NOW.min-START)*PX}px"></div>`:'';
    html+=`<div class="col${d===TODAY?' today':''}" data-day="${d}" style="height:${H}px">${ghosts}${evs}${nowl}</div>`;
  });
  g.innerHTML=html;
}

/* ---------- Alltag: Als Nächstes + kleine Stufenwahl ---------- */
function relTime(abs){
  const d=Math.floor(abs/1440), m=abs%1440, nowAbs=TODAY*1440+NOW.min, diff=abs-nowAbs;
  const dayTxt=d===TODAY?'heute':d===TODAY+1?'morgen':wd(d);
  let inTxt='';
  if(diff>0&&diff<60) inTxt=` · in ${diff} min`;
  else if(diff>=60&&diff<12*60) inTxt=` · in ${Math.floor(diff/60)} h${diff%60?' '+diff%60+' min':''}`;
  return `${dayTxt} ${fmt(m)}${inTxt}`;
}
function renderNext(plan){
  const nowAbs=TODAY*1440+NOW.min;
  const list=EV.filter(visible).map(e=>({e,p:plan[e.id]})).filter(x=>x.p&&!x.p.unplaced)
    .map(x=>({...x,a:x.p.day*1440+x.p.start})).sort((a,b)=>a.a-b.a);
  const cur=list.filter(x=>x.a<=nowAbs&&x.a+x.e.dur>nowAbs);
  const up=list.filter(x=>x.a>nowAbs).slice(0,cur.length?1:2);
  const card=(x,lbl,tm,cls,go)=>{const c=catOf(x.e); return `<div class="nx ${cls} k-${TC[c.tier]}"><span class="lbl">${lbl}</span><span class="tt"><span class="dot"></span>${esc(x.e.title)}</span><span class="tm">${tm}${x.e.loc?' · '+esc(placeName(x.e.loc)):''}</span>${go||''}${x.e.note?`<span class="note">${esc(x.e.note.split('\n')[0])}</span>`:''}</div>`;};
  const goLine=x=>{const tr=TRAVEL[x.e.id]; if(!tr||!tr.min) return ''; return `<span class="go">Los um ${fmt(tr.leave)} ab ${esc(placeName(tr.from))} (${tr.est?'ca. ':''}${tr.min} min)</span>`;};
  let html=cur.map(x=>card(x,'Jetzt',`bis ${fmt((x.a+x.e.dur)%1440)}`,'now')).join('');
  html+=up.map((x,i)=>card(x,i===0?'Als Nächstes':'Danach',relTime(x.a),'',goLine(x))).join('');
  if(!cur.length&&!up.length) html='<div class="nx"><span class="lbl">Als Nächstes</span><span class="tt">Diese Woche steht nichts mehr an.</span></div>';
  if(PROPS) html+=`<div class="pbanner">${PROPS} Vorschl${PROPS>1?'äge warten':'ag wartet'} auf deine Bestätigung. <button type="button" data-mode="plan">Im Planen-Modus prüfen</button></div>`;
  $('next').innerHTML=html;
}
function activeTier(){
  const vis=state.cats.filter(c=>!state.hidden[c.id]);
  if(vis.length===state.cats.length||!vis.length) return 0;
  const ts=[...new Set(vis.map(c=>c.tier))]; return ts.length===1?ts[0]:-1;
}
function renderSeg(){
  const at=activeTier();
  $('seg').innerHTML=`<button type="button" data-seg="0" aria-pressed="${at===0}">Alle</button>`+
    [1,2,3].filter(t=>state.cats.some(c=>c.tier===t)).map(t=>`<button type="button" data-seg="${t}" aria-pressed="${at===t}"><span class="bstyle s${t}"></span>${TIERS[t].name}</button>`).join('');
  const cats=at>0?state.cats.filter(c=>c.tier===at):[];
  $('minis').innerHTML=cats.length>1?cats.map(c=>`<button type="button" class="mini k-${TC[c.tier]}" data-mini="${c.id}" aria-pressed="${!state.hidden[c.id]}"><span class="dot"></span>${esc(c.name)}</button>`).join(''):'';
}

function renderLog(plan){
  const rows=[], props=[];
  EV.forEach(e=>{const p=plan[e.id]; if(!p||!p.conflict) return; const c=catOf(e);
    rows.push({o:e.day*1440+e.start,h:`<li class="k-${TC[c.tier]}"><span class="dot"></span><div><div class="what">${LOCK_SVG}${esc(e.title)}</div><div class="from bad">${wd(e.day)} ${fmt(e.start)}: überschneidet sich mit ${esc(p.conflict.title)}</div><div class="why">Der Termin ist festgeschrieben und wird nicht mehr verschoben. Ändere ihn selbst, falls nötig.</div></div></li>`});});
  EV.filter(e=>tierOf(e)===1&&inSleep(e.day,e.start,e.dur)).forEach(e=>{
    const c=catOf(e);
    rows.push({o:e.day*1440+e.start,h:`<li class="k-${TC[c.tier]}"><span class="dot"></span><div><div class="what">${esc(e.title)}</div><div class="from bad">${wd(e.day)} ${fmt(e.start)}: liegt in deiner Schlafenszeit</div><div class="why">Fix-Termine werden nicht verschoben. Passe Termin oder Schlafzeit an.</div></div></li>`});
  });
  EV.filter(e=>tierOf(e)!==1).forEach(e=>{
    const p=plan[e.id], c=catOf(e);
    if(!p.moved&&!p.unplaced) return;
    let why, short;
    if(p.by.sleep){why='Lag in deiner Schlafenszeit'; short='deine Schlafenszeit';}
    else if(p.by.early){why=`Der Weg ab Zuhause (${p.by.min} min) hätte vor dem Aufstehen beginnen müssen`; short='deine Aufstehzeit';}
    else if(p.by.kind==='travel'){why=`Der Weg von oder zu <b>${esc(p.by.title)}</b> (${p.by.min} min) hätte nicht gereicht`; short=`den Weg zu ${esc(p.by.title)}`;}
    else{const bc=catOf(p.by); why=`Platz gemacht für <b>${esc(p.by.title)}</b> (${esc(bc.name)}, Stufe ${bc.tier})`; short=esc(p.by.title);}
    const durTxt=`${Math.floor(e.dur/60)?Math.floor(e.dur/60)+' h ':''}${e.dur%60?e.dur%60+' min':''}`.trim();
    const head=`<span class="grip">⠿ ZIEHEN</span><span class="t">${esc(e.title)}</span><span class="h">${durTxt} · war ${wd(e.day)} ${fmt(e.start)}</span>`;
    if(p.unplaced) props.push({o:e.day*1440+e.start,h:`<div class="tchip k-${TC[c.tier]} s${c.tier}" data-drag="${e.id}" aria-label="${esc(e.title)} neu einplanen">${head}<span class="bad">Kein freier Platz mehr. Zieh ihn selbst in den Kalender oder kürze die Dauer.</span></div>`});
    else props.push({o:p.day*1440+p.start,h:`<div class="tchip k-${TC[c.tier]} s${c.tier}" data-drag="${e.id}" aria-label="${esc(e.title)} neu einplanen">${head}<span class="why">${why}</span><button type="button" data-accept="${e.id}">Vorschlag: ${wd(p.day)} ${fmt(p.start)}</button></div>`});
  });
  EV.forEach(e=>{
    const tr=TRAVEL[e.id], p=plan[e.id]; if(!tr||!tr.tight||!p||p.unplaced) return;
    const c=catOf(e);
    const have=tr.gap!=null?`du hast ${Math.max(0,tr.gap)} min Zeit`:`du müsstest um ${fmt(tr.leave)} los, stehst aber erst um ${fmt(wakeOf(p.day))} auf`;
    rows.push({o:p.day*1440+p.start,h:`<li class="k-${TC[c.tier]}"><span class="dot"></span><div><div class="what">${esc(e.title)}</div><div class="from bad">${wd(p.day)} ${fmt(p.start)}: Weg wird knapp</div><div class="why">Ab ${esc(placeName(tr.from))} brauchst du ${tr.est?'ca. ':''}${tr.min} min, ${have}.</div></div></li>`});
  });
  rows.sort((a,b)=>a.o-b.o); props.sort((a,b)=>a.o-b.o);
  $('log').innerHTML=rows.length?rows.map(r=>r.h).join(''):'<p>Keine Probleme gefunden.</p>';
  $('props').innerHTML=props.map(r=>r.h).join('');
  $('tray').hidden=!props.length;
  $('acceptall').hidden=props.filter(r=>r.h.includes('data-accept')).length<2;
  PROPS=props.length;
}

let PROPS=0;
// Stand der Vorschläge merken, um nach einer Änderung nur die NEUEN zu zeigen
function propSnapshot(){EV=buildEV(); const plan=schedule(EV,state.buffer), m={};
  Object.keys(plan).forEach(id=>{const p=plan[id]; if(p.moved) m[id]=p.day*1440+p.start; else if(p.unplaced) m[id]='x';}); return m;}
function whyText(p){
  if(p.by.sleep) return 'Lag in deiner Schlafenszeit';
  if(p.by.early) return `Der Weg ab Zuhause (${p.by.min} min) hätte vor dem Aufstehen beginnen müssen`;
  if(p.by.kind==='travel') return `Der Weg von oder zu ${esc(p.by.title)} (${p.by.min} min) hätte nicht gereicht`;
  const bc=catOf(p.by); return `Weicht ${esc(p.by.title)} aus (Stufe ${bc.tier})`;
}
function showNewProps(before,cause){
  const plan=PLAN, ids=[];
  EV.forEach(e=>{const p=plan[e.id]; if(!p) return;
    if((p.moved&&before[e.id]!==p.day*1440+p.start)||(p.unplaced&&before[e.id]!=='x')) ids.push(e.id);});
  if(!ids.length) return;
  ids.forEach(id=>{const el=document.querySelector(`.tchip[data-drag="${id}"]`); if(el) el.classList.add('flash');});
  toast(ids.length>1?`${ids.length} Termine müssen neu eingeplant werden.`:'Ein Termin muss neu eingeplant werden.');
  const t=$('tray'); if(t&&!t.hidden){const r=t.getBoundingClientRect(); if(r.top<0||r.bottom>innerHeight) t.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
}
function accept(ids){
  EV=buildEV(); const plan=schedule(EV,state.buffer);
  ids.forEach(id=>{const p=plan[id]; if(!p||!p.moved) return; setInst(id,p.day,p.start);});
  render();
}
$('acceptall').onclick=()=>{EV=buildEV(); const plan=schedule(EV,state.buffer); accept(EV.filter(e=>plan[e.id]&&plan[e.id].moved).map(e=>e.id));};
function renderWeek(){
  const a=dateOf(VIEW*7), b=dateOf(VIEW*7+6);
  const range=a.getMonth()===b.getMonth()?`${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`:`${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  $('weeklabel').textContent=`KW ${isoWeek(a)} · ${range}`;
  $('wtoday').hidden=VIEW===CURWEEK;
}
function goWeek(w){VIEW=w; prevPlan=null; render(); const cal=document.querySelector('.cal'); if(cal) cal.scrollLeft=0;}
$('wprev').onclick=()=>goWeek(VIEW-1);
$('wnext').onclick=()=>goWeek(VIEW+1);
$('wtoday').onclick=()=>goWeek(CURWEEK);
function renderSleepSum(){
  const s=state.sleep, t=x=>`<b>${fmt(x.bed)}–${fmt(x.wake)}</b>`;
  $('sleepsum').innerHTML='Schlaf: '+(s.mode==='daily'?'<b>pro Tag eingestellt</b>':t(s.wd)+(s.mode==='split'?' · Wochenende '+t(s.we):''));
}
function render(){
  const wakes=[0,1,2,3,4,5,6].map(wakeOf);
  EV=buildEV();
  START=Math.min(6*60,Math.floor(Math.min(...wakes,...EV.map(e=>e.start))/60)*60);
  const plan=schedule(EV,state.buffer); PLAN=plan;
  renderWeek();
  TRAVEL=computeTravel(plan);
  renderSleepSum();
  flashIds=new Set();
  if(prevPlan) Object.keys(plan).forEach(id=>{const a=plan[id],b=prevPlan[id]; if(b&&!a.unplaced&&!b.unplaced&&(a.day!==b.day||a.start!==b.start)) flashIds.add(id);});
  prevPlan=plan;
  renderFilters(); renderGrid(plan); renderLog(plan); renderNext(plan); renderSeg(); save();
}

/* ---------- Filter-Interaktion ---------- */
function setOnly(ids){state.cats.forEach(c=>{if(ids.includes(c.id)) delete state.hidden[c.id]; else state.hidden[c.id]=true;});}
function isOnly(ids){return state.cats.every(c=>!!state.hidden[c.id]===!ids.includes(c.id));}
document.addEventListener('click',ev=>{
  let b;
  if(b=ev.target.closest('[data-cattog]')){const id=b.dataset.cattog; if(state.hidden[id]) delete state.hidden[id]; else state.hidden[id]=true; render(); return;}
  if(b=ev.target.closest('[data-catsolo]')){const ids=[b.dataset.catsolo]; isOnly(ids)?(state.hidden={}):setOnly(ids); render(); return;}
  if(b=ev.target.closest('[data-tiertog]')){const t=+b.dataset.tiertog; const cats=state.cats.filter(c=>c.tier===t); const anyOn=cats.some(c=>!state.hidden[c.id]); cats.forEach(c=>{if(anyOn) state.hidden[c.id]=true; else delete state.hidden[c.id];}); render(); return;}
  if(b=ev.target.closest('[data-tiersolo]')){const ids=state.cats.filter(c=>c.tier===+b.dataset.tiersolo).map(c=>c.id); isOnly(ids)?(state.hidden={}):setOnly(ids); render(); return;}
  if(b=ev.target.closest('[data-mode]')){setMode(b.dataset.mode); return;}
  if(b=ev.target.closest('[data-seg]')){const t=+b.dataset.seg; if(t===0) state.hidden={}; else setOnly(state.cats.filter(c=>c.tier===t).map(c=>c.id)); render(); return;}
  if(b=ev.target.closest('[data-mini]')){const id=b.dataset.mini, c=state.cats.find(x=>x.id===id);
    if(isOnly([id])) setOnly(state.cats.filter(x=>x.tier===c.tier).map(x=>x.id)); else setOnly([id]); render(); return;}
  if(justDragged) return;
  if(b=ev.target.closest('[data-accept]')){accept([b.dataset.accept]); return;}
  if(justDragged) return;
  if(b=ev.target.closest('[data-view]')){openDetail(b.dataset.view); return;}
  if(mode==='plan'&&(b=ev.target.closest('.ev'))){openForm(b.dataset.id);}
});
$('showall').onclick=()=>{state.hidden={}; render();};
$('buf').addEventListener('change',()=>{state.buffer=+$('buf').value; render();});
$('lockm').addEventListener('change',()=>{state.lockMode=$('lockm').value; render();});
$('add').onclick=()=>openForm(null);


/* ---------- Termin-Formular ---------- */
let editing=null, editingInst=null, recDays=[];
$('f-wd').innerHTML=DAYS.map((d,i)=>`<button type="button" data-wd="${i}" aria-pressed="false" aria-label="${DAYS_LONG[i]}">${d}</button>`).join('');
function syncRec(){
  const on=$('f-rec').checked, f=$('f-freq').value, d=fromIso($('f-day').value);
  $('f-recopts').hidden=!on; $('f-wdrow').hidden=f==='daily';
  if(d!=null&&!recDays.length) recDays=[wdi(d)];
  document.querySelectorAll('[data-wd]').forEach(b=>b.setAttribute('aria-pressed',String(recDays.includes(+b.dataset.wd))));
  $('f-daylbl').textContent=on?'Erster Termin am':'Datum';
  if(!on||d==null){$('f-recinfo').textContent='';return;}
  const names=recDays.slice().sort().map(i=>DAYS[i]).join(', ');
  const u=fromIso($('f-until').value);
  $('f-recinfo').textContent=(f==='daily'?'Jeden Tag':`${f==='weekly'?'Jede Woche':'Alle 2 Wochen'} am ${names||wd(d)}`)+` ab ${dtxt(d)}`+(u!=null?` bis ${dtxt(u)}`:', ohne Enddatum')+'.';
}
$('f-wd').addEventListener('click',ev=>{const b=ev.target.closest('[data-wd]'); if(!b) return; const i=+b.dataset.wd;
  recDays=recDays.includes(i)?recDays.filter(x=>x!==i):[...recDays,i]; syncRec();});
['f-rec','f-freq','f-until','f-day'].forEach(id=>$(id).addEventListener('change',syncRec));
$('f-day').addEventListener('change',()=>{const d=fromIso($('f-day').value); if(d!=null&&recDays.length<=1) recDays=[wdi(d)]; syncRec();});
function fillCatSelect(sel){
  $('f-cat').innerHTML=[1,2,3].map(t=>{const cs=state.cats.filter(c=>c.tier===t); if(!cs.length) return '';
    return `<optgroup label="Stufe ${t} · ${TIERS[t].name}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;}).join('');
  if(sel) $('f-cat').value=sel;
}
function syncCat(){const c=state.cats.find(x=>x.id===$('f-cat').value); if(!c) return; $('f-lockrow').hidden=c.tier===1;
  $('f-catinfo').textContent=`Stufe ${c.tier} · ${TIERS[c.tier].name}: ${TIERS[c.tier].rule}`;}
$('f-cat').addEventListener('change',syncCat);
function fillLocSelect(sel){
  $('f-loc').innerHTML='<option value="">Kein Ort</option>'+state.places.map(p=>`<option value="${p.id}">${esc(p.name)}${p.id===state.home?' (Zuhause)':''}</option>`).join('')+'<option value="__new">+ Neuer Ort …</option>';
  $('f-loc').value=sel||'';
}
function syncLoc(){
  const v=$('f-loc').value; $('f-newloc').hidden=v!=='__new';
  if(v==='__new'){$('f-locinfo').textContent='Der Ort wird beim Speichern angelegt.'; return;}
  if(!v){$('f-locinfo').textContent='Ohne Ort rechnet der Planer keine Wegzeit ein.'; return;}
  const t=travel(state.home,v);
  $('f-locinfo').textContent=v===state.home?'Keine Wegzeit, wenn du schon zuhause bist.':`Ab Zuhause ${t.est?'ca. ':''}${t.min} min. Kommst du von einem anderen Termin, gilt dessen Ort.`;
}
$('f-loc').addEventListener('change',()=>{syncLoc(); if($('f-loc').value==='__new') setTimeout(()=>$('f-newname').focus(),0);});
function openForm(iid){
  if(!state.cats.length){openMgr(); return;}
  const inst=iid?EV.find(i=>i.id===iid):null; const e=inst?state.events.find(x=>x.id===inst.sid):null;
  editing=e?e.id:null; editingInst=inst;
  $('f-head').textContent=e?(e.rec?'Serie bearbeiten':'Termin bearbeiten'):'Neuer Termin';
  $('f-title').value=e?e.title:'';
  fillCatSelect(e?e.cat:(state.cats.find(c=>c.tier===3)||state.cats[0]).id);
  const defDay=VIEW===CURWEEK?TODAY:VIEW*7;
  $('f-day').value=isoDate(e?e.day:defDay); $('f-time').value=fmt(e?e.start:1080);
  $('f-rec').checked=!!(e&&e.rec); $('f-freq').value=e&&e.rec?e.rec.freq:'weekly';
  $('f-until').value=e&&e.rec&&e.rec.until!=null?isoDate(e.rec.until):'';
  recDays=e&&e.rec&&e.rec.days?e.rec.days.slice():[wdi(e?e.day:defDay)]; syncRec();
  setDur(e?e.dur:60);
  fillLocSelect(e?e.loc:''); $('f-newname').value=''; $('f-newmin').value=20; $('f-locked').checked=!!(e&&e.locked); $('f-note').value=e&&e.note?e.note:'';
  $('f-del').hidden=!e; $('f-del').textContent=e&&e.rec?'Ganze Serie löschen':'Löschen';
  $('f-delone').hidden=!(e&&e.rec);
  $('f-err').hidden=true; syncCat(); syncLoc();
  $('ov-ev').hidden=false; setTimeout(()=>$('f-title').focus(),0);
}
function getDur(){const h=$('f-durh').value.trim(), m=$('f-durm').value.trim();
  const H=h===''?0:Number(h), M=m===''?0:Number(m);
  if(!Number.isInteger(H)||!Number.isInteger(M)||H<0||M<0||M>59) return null; return H*60+M;}
function setDur(d){$('f-durh').value=Math.floor(d/60); $('f-durm').value=d%60; syncDur();}
function syncDur(){
  const d=getDur(), t=toMin($('f-time').value), el=$('f-durend');
  document.querySelectorAll('[data-dur]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.dur===d)));
  if(d==null||t==null||d<=0){el.textContent='';return;}
  el.textContent=t+d>END?`Ende nach Mitternacht`:`Ende ${fmt(t+d)}`; el.classList.toggle('bad',t+d>END);
}
$('f-durchips').addEventListener('click',ev=>{const b=ev.target.closest('[data-dur]'); if(b) setDur(+b.dataset.dur);});
['f-durh','f-durm','f-time'].forEach(id=>$(id).addEventListener('input',syncDur));
const closeForm=()=>{$('ov-ev').hidden=true;};
$('f-cancel').onclick=closeForm;
$('f-del').onclick=()=>{state.events=state.events.filter(x=>x.id!==editing); closeForm(); render();};
$('f-delone').onclick=()=>{const s=state.events.find(x=>x.id===editing); if(s&&editingInst){s.ex=s.ex||{}; s.ex[editingInst.occ]='skip';} closeForm(); render(); toast(`${s.title} am ${wd(editingInst.occ)}, ${dtxt(editingInst.occ)} gelöscht. Die Serie bleibt.`);};
$('form').addEventListener('submit',ev=>{
  ev.preventDefault(); const before=propSnapshot();
  const err=$('f-err'), fail=m=>{err.textContent=m;err.hidden=false;};
  const title=$('f-title').value.trim(); const [hh,mm]=($('f-time').value||'').split(':').map(Number);
  if(!title) return fail('Gib dem Termin einen Titel.');
  if(isNaN(hh)) return fail('Wähle eine Uhrzeit.');
  const cat=$('f-cat').value, c=state.cats.find(x=>x.id===cat), day=fromIso($('f-day').value), start=hh*60+mm, dur=getDur();
  if(day==null) return fail('Wähle ein Datum.');
  if(dur==null) return fail('Gib die Dauer in ganzen Stunden und Minuten an.');
  if(dur<5) return fail('Ein Termin muss mindestens 5 Minuten dauern.');
  if(start<START) return fail(`Der Kalender beginnt um ${fmt(START)}. Wähle eine spätere Uhrzeit.`);
  if(start+dur>END) return fail(`So endet der Termin nach Mitternacht. Er darf höchstens bis 24:00 gehen, also maximal ${Math.floor((END-start)/60)} h ${(END-start)%60} min ab ${fmt(start)}.`);
  let loc=$('f-loc').value||null;
  if(loc==='__new'){
    const name=$('f-newname').value.trim(), min=Math.round(+$('f-newmin').value);
    if(!name) return fail('Gib dem neuen Ort einen Namen.');
    if(state.places.some(p=>p.name.toLowerCase()===name.toLowerCase())) return fail('Diesen Ort gibt es schon. Wähle ihn in der Liste aus.');
    if(!(min>=0&&min<=240)) return fail('Die Wegzeit muss zwischen 0 und 240 Minuten liegen.');
    loc='p'+(state.nextId++); state.places.push({id:loc,name}); state.travel[pkey(state.home,loc)]=min;
  }
  const note=$('f-note').value.trim();
  let rec=null;
  if($('f-rec').checked){
    const freq=$('f-freq').value, until=fromIso($('f-until').value);
    if(until!=null&&until<day) return fail('Das Enddatum liegt vor dem ersten Termin.');
    if(freq!=='daily'&&!recDays.length) return fail('Wähle mindestens einen Wochentag.');
    rec={freq,days:freq==='daily'?null:recDays.slice().sort(),until};
  }
  const data={title,cat,day,start,dur,loc,note,rec,locked:c.tier!==1&&$('f-locked').checked};
  if(editing){const i=state.events.findIndex(x=>x.id===editing); state.events[i]=Object.assign({},state.events[i],data,{id:editing}); if(!rec) delete state.events[i].ex;}
  else state.events.push(Object.assign({id:state.nextId++},data));
  delete state.hidden[cat];
  closeForm();
  if(Math.floor(day/7)!==VIEW&&!editing) VIEW=Math.floor(day/7);
  render(); showNewProps(before,title);
});

/* ---------- Kategorien verwalten ---------- */
let draft=[];
function openMgr(){draft=clone(state.cats); renderMgr(); $('c-err').hidden=true; $('ov-cat').hidden=false;}
function readMgr(){
  draft.forEach(c=>{const r=document.querySelector(`.crow[data-cid="${c.id}"]`); if(!r) return;
    c.name=r.querySelector('.c-name').value; c.tier=+r.querySelector('.c-tier').value;
    });
}
function renderMgr(){
  const counts={}; state.events.forEach(e=>counts[e.cat]=(counts[e.cat]||0)+1);
  $('clist').innerHTML=draft.map(c=>`
    <div class="crow k-${TC[c.tier]}${c.del?' del':''}" data-cid="${c.id}">
      <input class="c-name" id="cn-${c.id}" value="${esc(c.name)}" placeholder="Name, z. B. Training" aria-label="Name der Kategorie" ${c.del?'disabled':''}>
      <select class="c-tier" id="ct-${c.id}" aria-label="Stufe" ${c.del?'disabled':''}>
        ${[1,2,3].map(t=>`<option value="${t}" ${c.tier===t?'selected':''}>Stufe ${t} · ${TIERS[t].name}</option>`).join('')}</select>
      <button type="button" class="iconbtn" data-cdel="${c.id}">${c.del?'Wiederherstellen':'Löschen'}</button>

      ${c.del&&counts[c.id]?`<div class="delnote">${counts[c.id]} Termin${counts[c.id]>1?'e werden':' wird'} beim Speichern mitgelöscht.</div>`:''}
    </div>`).join('') || '<p class="empty">Noch keine Kategorien.</p>';
}
$('clist').addEventListener('change',ev=>{if(ev.target.matches('.c-tier')){readMgr(); renderMgr();}});
$('clist').addEventListener('click',ev=>{const b=ev.target.closest('[data-cdel]'); if(!b) return; readMgr();
  const c=draft.find(x=>x.id===b.dataset.cdel); if(c.isNew&&!c.del) draft=draft.filter(x=>x!==c); else c.del=!c.del; renderMgr();});
$('c-add').onclick=()=>{readMgr(); const used=draft.map(c=>c.color); const color=COLORS.find(c=>!used.includes(c))||'teal';
  const id='k'+(state.nextId++); draft.push({id,name:'',tier:3,color,isNew:true}); renderMgr(); setTimeout(()=>$('cn-'+id).focus(),0);};
$('c-cancel').onclick=()=>{$('ov-cat').hidden=true;};
$('cform').addEventListener('submit',ev=>{
  ev.preventDefault(); readMgr(); const before=propSnapshot();
  const keep=draft.filter(c=>!c.del);
  if(keep.some(c=>!c.name.trim())){$('c-err').textContent='Jede Kategorie braucht einen Namen.';$('c-err').hidden=false;return;}
  const names=keep.map(c=>c.name.trim().toLowerCase());
  if(new Set(names).size!==names.length){$('c-err').textContent='Zwei Kategorien haben denselben Namen.';$('c-err').hidden=false;return;}
  const gone=draft.filter(c=>c.del).map(c=>c.id);
  state.events=state.events.filter(e=>!gone.includes(e.cat));
  gone.forEach(id=>delete state.hidden[id]);
  state.cats=keep.map(c=>({id:c.id,name:c.name.trim(),tier:c.tier,color:c.color}));
  $('ov-cat').hidden=true; render(); showNewProps(before,'die geänderten Kategorien');
});
$('mgr').onclick=openMgr;

/* ---------- Schlafzeiten ---------- */
const toMin=v=>{const [h,m]=(v||'').split(':').map(Number); return isNaN(h)?null:h*60+m;};
function syncSplit(){const m=$('s-mode').value, on=m==='split';
  $('s-daily').hidden=m!=='daily'; $('s-simple').hidden=m==='daily'; $('s-we').hidden=!on;
  $('s-wd-h').textContent=on?'Unter der Woche':'Jeden Tag'; $('s-wd-note').textContent=on?'Aufstehen gilt Mo–Fr, Schlafen gehen gilt So–Do.':'Gilt für alle Tage.';}
function fillDays(days){
  $('s-days').innerHTML='<span class="hd">Tag</span><span class="hd">Aufstehen</span><span class="hd">Schlafen gehen</span>'+
    days.map((x,i)=>`<span class="dn${i>=5?' we':''}">${DAYS[i]}</span>
      <input type="time" step="900" id="sd-w-${i}" value="${fmt(x.wake)}" aria-label="${DAYS_LONG[i]} Aufstehen">
      <input type="time" step="900" id="sd-b-${i}" value="${fmt(x.bed)}" aria-label="${DAYS_LONG[i]} Schlafen gehen">`).join('');
}
function openSleep(){const s=state.sleep;
  $('s-mode').value=s.mode; $('s-wd-wake').value=fmt(s.wd.wake); $('s-wd-bed').value=fmt(s.wd.bed);
  $('s-we-wake').value=fmt(s.we.wake); $('s-we-bed').value=fmt(s.we.bed);
  fillDays(s.days||[0,1,2,3,4,5,6].map(d=>({wake:rawWake(d),bed:rawBed(d)})));
  $('s-err').hidden=true; syncSplit(); $('ov-sleep').hidden=false;}
$('s-mode').addEventListener('change',()=>{
  if($('s-mode').value==='daily'&&!state.sleep.days){ // aus den aktuellen Feldern vorbelegen
    const wd={wake:toMin($('s-wd-wake').value)??420,bed:toMin($('s-wd-bed').value)??1380}, we={wake:toMin($('s-we-wake').value)??540,bed:toMin($('s-we-bed').value)??30};
    const prev=state.sleep.mode; fillDays([0,1,2,3,4,5,6].map(d=>prev==='split'?{wake:d>=5?we.wake:wd.wake,bed:(d===4||d===5)?we.bed:wd.bed}:wd));
  }
  syncSplit();});
$('s-copy').onclick=()=>{const w=$('sd-w-0').value,b=$('sd-b-0').value; for(let i=1;i<7;i++){$('sd-w-'+i).value=w;$('sd-b-'+i).value=b;}};
$('sleepbtn').onclick=openSleep; $('sleepsum').onclick=openSleep;
$('s-cancel').onclick=()=>{$('ov-sleep').hidden=true;};
$('sform').addEventListener('submit',ev=>{
  ev.preventDefault(); const before=propSnapshot(); const fail=m=>{$('s-err').textContent=m;$('s-err').hidden=false;};
  const wd={wake:toMin($('s-wd-wake').value),bed:toMin($('s-wd-bed').value)};
  const we={wake:toMin($('s-we-wake').value),bed:toMin($('s-we-bed').value)};
  const mode=$('s-mode').value;
  const days=[0,1,2,3,4,5,6].map(i=>({wake:toMin($('sd-w-'+i).value),bed:toMin($('sd-b-'+i).value)}));
  const check=mode==='daily'?days.map((x,i)=>[x,DAYS_LONG[i]+': ']):mode==='split'?[[wd,''],[we,'Wochenende: ']]:[[wd,'']];
  for(const [x,pre] of check){
    if(x.wake===null||x.bed===null) return fail(pre+'Trag bei allen Feldern eine Uhrzeit ein.');
    if(x.wake>12*60) return fail(pre+'Aufstehen muss vor 12:00 liegen.');
    if(effBed(x.bed)-x.wake<6*60) return fail(pre+'Zwischen Aufstehen und Schlafen gehen sollten mindestens 6 Stunden liegen.');
  }
  const old=state.sleep;
  state.sleep={mode,wd:mode==='daily'?old.wd:wd,we:mode==='split'?we:old.we,days:mode==='daily'?days:old.days};
  $('ov-sleep').hidden=true; render(); showNewProps(before,'die neuen Schlafzeiten');
});

/* ---------- Termin ansehen (Alltag) ---------- */
function openDetail(id){
  const e=EV.find(x=>x.id===id), p=PLAN[id]; if(!e||!p) return; const c=catOf(e), tr=TRAVEL[id];
  $('dt-title').textContent=e.title; $('dt-dot').className='dot k-'+TC[c.tier];
  const rows=[['Wann',`${wdl(p.day)}, ${dtxt(p.day)} · ${fmt(p.start)}–${fmt(p.start+e.dur)}`+(p.moved?' (Vorschlag)':'')],
    ['Stufe',`${c.tier} · ${TIERS[c.tier].name} · ${c.name}`]];
  if(e.loc) rows.push(['Ort',placeName(e.loc)]);
  if(e.rec) rows.push(['Wiederholung',e.rec.freq==='daily'?'Jeden Tag':`${e.rec.freq==='weekly'?'Jede Woche':'Alle 2 Wochen'} am ${(e.rec.days||[wdi(e.day)]).map(i=>DAYS[i]).join(', ')}`+(e.rec.until!=null?` bis ${dtxt(e.rec.until)}`:'')]);
  if(tr&&tr.min) rows.push(['Los',`${fmt(tr.leave)} ab ${placeName(tr.from)} (${tr.est?'ca. ':''}${tr.min} min)`]);
  $('dt-list').innerHTML=rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('dt-note').hidden=!e.note; $('dt-note').textContent=e.note||'';
  $('ov-detail').hidden=false; setTimeout(()=>$('dt-close').focus(),0);
}
$('dt-close').onclick=()=>{$('ov-detail').hidden=true;};

/* ---------- Kalender importieren (.ics) ---------- */
const unesc=v=>v.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
function parseDT(v,p){
  const m=(v||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if(!m) return null;
  if(!m[4]||p.VALUE==='DATE') return {d:new Date(+m[1],+m[2]-1,+m[3]),allDay:true};
  const d=m[7]?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])):new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
  return {d,allDay:false};
}
function parseDur(v){const m=(v||'').match(/^[+]?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/); if(!m) return null;
  return (+m[1]||0)*10080+(+m[2]||0)*1440+(+m[3]||0)*60+(+m[4]||0);}
function parseICS(text){
  const lines=text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
  const list=[]; let cur=null, calname=null; const stack=[];
  for(const raw of lines){
    const i=raw.indexOf(':'); if(i<0) continue;
    const left=raw.slice(0,i), val=raw.slice(i+1);
    const [nm,...ps]=left.split(';'); const N=nm.toUpperCase(), p={};
    ps.forEach(x=>{const j=x.indexOf('='); if(j>0) p[x.slice(0,j).toUpperCase()]=x.slice(j+1).replace(/^"|"$/g,'');});
    if(N==='BEGIN'){stack.push(val.trim().toUpperCase()); if(val.trim().toUpperCase()==='VEVENT') cur={ex:[]}; continue;}
    if(N==='END'){const t=stack.pop(); if(t==='VEVENT'&&cur){list.push(cur);cur=null;} continue;}
    if(N==='X-WR-CALNAME'&&!cur){calname=unesc(val).trim(); continue;}
    if(!cur||stack[stack.length-1]!=='VEVENT') continue;
    if(N==='SUMMARY') cur.title=unesc(val).trim();
    else if(N==='LOCATION') cur.loc=unesc(val).trim();
    else if(N==='DESCRIPTION') cur.desc=unesc(val).trim();
    else if(N==='UID') cur.uid=val.trim();
    else if(N==='STATUS') cur.status=val.trim().toUpperCase();
    else if(N==='DTSTART') cur.start=parseDT(val,p);
    else if(N==='DTEND') cur.end=parseDT(val,p);
    else if(N==='DURATION') cur.dur=parseDur(val.trim());
    else if(N==='RECURRENCE-ID') cur.rid=parseDT(val,p);
    else if(N==='EXDATE') val.split(',').forEach(x=>{const d=parseDT(x.trim(),p); if(d) cur.ex.push(d);});
    else if(N==='RRULE'){cur.rrule={}; val.split(';').forEach(x=>{const [k,v]=x.split('='); if(k) cur.rrule[k.toUpperCase()]=(v||'').toUpperCase();});}
  }
  return {list,calname};
}
const BYDAY={MO:0,TU:1,WE:2,TH:3,FR:4,SA:5,SU:6};
// .ics-Einträge in Termine dieses Kalenders umwandeln
function convertICS(parsed,opt){
  const r={events:[],single:0,series:0,skip:{allDay:0,old:0,complex:0,clipped:0,cancelled:0,broken:0}};
  const byUid={};
  parsed.list.filter(x=>!x.rid).forEach(x=>{
    if(x.status==='CANCELLED'){r.skip.cancelled++;return;}
    if(!x.start){r.skip.broken++;return;}
    if(x.start.allDay){r.skip.allDay++;return;}
    const dt=x.start.d, day=dayOfDate(dt), start=dt.getHours()*60+dt.getMinutes();
    let dur=x.end&&!x.end.allDay?Math.round((x.end.d-dt)/60000):x.dur!=null?x.dur:60;
    if(!(dur>0)) dur=60;
    if(start+dur>END){dur=END-start; r.skip.clipped++;}
    if(dur<5){r.skip.broken++;return;}
    let rec=null;
    if(x.rrule){
      const f=x.rrule.FREQ, iv=+(x.rrule.INTERVAL||1);
      if((f==='WEEKLY'&&(iv===1||iv===2))||(f==='DAILY'&&iv===1)){
        let days=null;
        if(f==='WEEKLY'){days=(x.rrule.BYDAY?x.rrule.BYDAY.split(',').map(t=>BYDAY[t.replace(/^[+-]?\d+/,'')]).filter(v=>v!=null):[]); if(!days.length) days=[wdi(day)];}
        rec={freq:f==='DAILY'?'daily':iv===2?'biweekly':'weekly',days:days?[...new Set(days)].sort():null,until:null};
        if(x.rrule.UNTIL){const u=parseDT(x.rrule.UNTIL,{}); if(u) rec.until=dayOfDate(u.d);}
        else if(x.rrule.COUNT){let n=+x.rrule.COUNT, d=day; const probe={day,rec}; for(let k=0;k<3660&&n>0;k++,d++) if(occursOn(probe,d)) {n--; if(!n) rec.until=d;}}
      } else r.skip.complex++;
    }
    const last=rec?(rec.until==null?Infinity:rec.until):day;
    if(opt.range==='now'&&last<CURWEEK*7){r.skip.old++;return;}
    const ev={title:x.title||'(ohne Titel)',day,start,dur,rec,uid:x.uid||null,locText:x.loc||'',desc:x.desc||''};
    if(rec&&x.ex.length){ev.ex={}; x.ex.forEach(e=>ev.ex[dayOfDate(e.d)]='skip');}
    r.events.push(ev); rec?r.series++:r.single++;
    if(ev.uid) byUid[ev.uid]=ev;
  });
  // Einzelne geänderte Termine einer Serie (RECURRENCE-ID)
  parsed.list.filter(x=>x.rid).forEach(x=>{
    const m=byUid[x.uid]; if(!m||!m.rec) return;
    const occ=dayOfDate(x.rid.d); m.ex=m.ex||{};
    if(x.status==='CANCELLED'||!x.start||x.start.allDay){m.ex[occ]='skip'; return;}
    const dt=x.start.d, day=dayOfDate(dt), start=dt.getHours()*60+dt.getMinutes();
    let dur=x.end&&!x.end.allDay?Math.round((x.end.d-dt)/60000):x.dur!=null?x.dur:m.dur;
    if(start+dur>END) dur=END-start;
    if(dur===m.dur&&!x.title) {m.ex[occ]={day,start}; return;}
    if(dur===m.dur&&x.title===m.title){m.ex[occ]={day,start}; return;}
    m.ex[occ]='skip';
    if(dur>=5) r.events.push({title:x.title||m.title,day,start,dur,rec:null,uid:(x.uid||'')+'#'+occ,locText:x.loc||m.locText,desc:x.desc||m.desc});
  });
  return r;
}
let IMP=null;
const seedEvents=()=>state.events.filter(e=>e.id<100&&!e.uid);
function openImport(){
  IMP=null; $('i-file').value=''; $('i-opts').hidden=true; $('i-err').hidden=true; $('i-ok').disabled=true;
  $('i-droptxt').innerHTML='<b>Datei auswählen</b> oder hierher ziehen';
  $('ov-import').hidden=false;
}
function fillImpCats(def){
  $('i-cat').innerHTML=`<option value="__new">+ Neue Kategorie</option>`+[1,2,3].map(t=>{const cs=state.cats.filter(c=>c.tier===t); if(!cs.length) return '';
    return `<optgroup label="Stufe ${t} · ${TIERS[t].name}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;}).join('');
  $('i-cat').value='__new'; $('i-catname').value=def; $('i-cattier').value='1';
}
function impPreview(){
  if(!IMP) return;
  const r=convertICS(IMP.parsed,{range:$('i-range').value}); IMP.result=r;
  $('i-newcat').hidden=$('i-cat').value!=='__new';
  const sk=r.skip, notes=[];
  if(sk.old) notes.push(`${sk.old} vergangene${sk.old>1?'':'r'} Termin${sk.old>1?'e':''} ausgelassen`);
  if(sk.allDay) notes.push(`${sk.allDay} ganztägige${sk.allDay>1?'':'r'} Termin${sk.allDay>1?'e':''} übersprungen (z. B. Feiertage)`);
  if(sk.cancelled) notes.push(`${sk.cancelled} abgesagt`);
  if(sk.complex) notes.push(`${sk.complex} mit monatlicher oder seltener Wiederholung nur einmal übernommen`);
  if(sk.clipped) notes.push(`${sk.clipped} über Mitternacht, endet hier um 24:00`);
  if(sk.broken) notes.push(`${sk.broken} unvollständig und übersprungen`);
  const n=r.events.length;
  $('i-sum').innerHTML=`<span><b>${n}</b> Termin${n===1?'':'e'} gefunden: ${r.single} einmalig, ${r.series} wiederkehrend${IMP.parsed.calname?' · aus „'+esc(IMP.parsed.calname)+'“':''}</span>`+
    (notes.length?`<span class="skip">${notes.join(' · ')}</span>`:'');
  const seeds=seedEvents().length;
  $('i-noseedrow').hidden=!seeds; $('i-noseedtxt').textContent=`Die ${seeds} Beispieltermine vorher entfernen`;
  $('i-ok').disabled=!n; $('i-ok').textContent=n?`${n} Termin${n===1?'':'e'} importieren`:'Importieren';
}
function readImpFile(file){
  const fail=m=>{$('i-err').textContent=m; $('i-err').hidden=false; $('i-opts').hidden=true; $('i-ok').disabled=true; IMP=null;};
  $('i-err').hidden=true;
  if(!file) return;
  if(/\.zip$/i.test(file.name)) return fail('Das ist eine .zip-Datei. Entpacke sie zuerst und wähle dann die .ics-Datei darin.');
  if(file.size>15*1024*1024) return fail('Die Datei ist größer als 15 MB. Exportiere nur einen Kalender oder einen kürzeren Zeitraum.');
  const fr=new FileReader();
  fr.onerror=()=>fail('Die Datei konnte nicht gelesen werden. Versuch es noch einmal.');
  fr.onload=()=>{
    const text=String(fr.result||'');
    if(!/BEGIN:VCALENDAR/i.test(text)) return fail('Das ist keine Kalenderdatei. Wähle eine Datei mit der Endung .ics.');
    const parsed=parseICS(text);
    if(!parsed.list.length) return fail('In der Datei stehen keine Termine.');
    IMP={parsed,name:file.name};
    $('i-droptxt').innerHTML=`<b>${esc(file.name)}</b> · andere Datei wählen`;
    fillImpCats(parsed.calname||'Importiert'); $('i-opts').hidden=false; impPreview();
  };
  fr.readAsText(file,'utf-8');
}
$('i-file').addEventListener('change',()=>readImpFile($('i-file').files[0]));
['dragenter','dragover'].forEach(t=>$('i-drop').addEventListener(t,ev=>{ev.preventDefault(); $('i-drop').classList.add('over');}));
['dragleave','drop'].forEach(t=>$('i-drop').addEventListener(t,ev=>{ev.preventDefault(); $('i-drop').classList.remove('over');}));
$('i-drop').addEventListener('drop',ev=>{const f=ev.dataTransfer&&ev.dataTransfer.files[0]; if(f) readImpFile(f);});
['i-cat','i-range'].forEach(id=>$(id).addEventListener('change',impPreview));
$('i-cancel').onclick=()=>{$('ov-import').hidden=true;};
$('impbtn').onclick=openImport;
$('iform').addEventListener('submit',ev=>{
  ev.preventDefault(); if(!IMP||!IMP.result) return;
  const fail=m=>{$('i-err').textContent=m;$('i-err').hidden=false;};
  let cat=$('i-cat').value;
  if(cat==='__new'){
    const name=$('i-catname').value.trim(); if(!name) return fail('Gib der neuen Kategorie einen Namen.');
    const ex=state.cats.find(c=>c.name.toLowerCase()===name.toLowerCase());
    if(ex) cat=ex.id; else {cat='k'+(state.nextId++); state.cats.push({id:cat,name,tier:+$('i-cattier').value,color:'blue'});}
  }
  const before=propSnapshot();
  if(!$('i-noseedrow').hidden&&$('i-noseed').checked) state.events=state.events.filter(e=>!(e.id<100&&!e.uid));
  const locMode=$('i-loc').value; let added=0, updated=0;
  IMP.result.events.forEach(x=>{
    let loc=null, noteParts=[];
    if(x.locText){
      if(locMode==='place'){let p=state.places.find(q=>q.name.toLowerCase()===x.locText.toLowerCase());
        if(!p){p={id:'p'+(state.nextId++),name:x.locText.slice(0,80)}; state.places.push(p);} loc=p.id;}
      else noteParts.push(x.locText);
    }
    if(x.desc) noteParts.push(x.desc);
    const data={title:x.title.slice(0,120),cat,day:x.day,start:x.start,dur:x.dur,loc,note:noteParts.join('\n').slice(0,1000),rec:x.rec,uid:x.uid,locked:false};
    if(x.ex) data.ex=x.ex;
    const old=x.uid?state.events.find(e=>e.uid===x.uid):null;
    if(old){Object.assign(old,data); if(!x.ex) delete old.ex; updated++;}
    else {state.events.push(Object.assign({id:state.nextId++},data)); added++;}
  });
  delete state.hidden[cat];
  $('ov-import').hidden=true;
  // Zur Woche springen, in der der erste importierte Termin ab heute liegt
  const imp=state.events.filter(e=>e.cat===cat&&e.uid); let first=Infinity;
  imp.forEach(e=>{for(let d=Math.max(CURWEEK*7,e.day);d<CURWEEK*7+400;d++){ if(occursOn(e,d)&&!(e.ex&&e.ex[d]==='skip')){first=Math.min(first,d);break;} }});
  if(mode!=='plan') setMode('plan');
  if(first!==Infinity&&Math.floor(first/7)!==VIEW&&!imp.some(e=>weekDays().some(d=>occursOn(e,d)))) VIEW=Math.floor(first/7);
  prevPlan=null; render();
  toast(`${added} Termin${added===1?'':'e'} importiert${updated?`, ${updated} aktualisiert`:''}.`);
  showNewProps(before,'den Import');
});

/* ---------- Drag & Drop ---------- */
let drag=null, justDragged=false, toastT=null;
function toast(msg){const t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3200);}
function othersPlaced(id){return EV.filter(x=>x.id!==id&&PLAN[x.id]&&!PLAN[x.id].unplaced).map(x=>({id:x.id,day:PLAN[x.id].day,start:PLAN[x.id].start,dur:x.dur,loc:x.loc}));}
function canPlace(e,d,t,placed){
  if(d*1440+t<Math.ceil((nowAbs()+1)/STEP)*STEP) return false;
  if(t<START||t+e.dur>END) return false;
  if(tierOf(e)===1) return true;
  if(inSleep(d,t,e.dur)) return false;
  return fits({day:d,start:t,dur:e.dur,loc:e.loc},placed,state.buffer).ok;
}
function showBands(e){
  if(tierOf(e)===1) return;
  const placed=othersPlaced(e.id);
  document.querySelectorAll('.col[data-day]').forEach(col=>{
    const d=+col.dataset.day; const bands=[]; let cur=null;
    for(let t=START;t<=END-e.dur;t+=STEP){
      if(canPlace(e,d,t,placed)){ if(cur&&t<=cur.e) cur.e=t+e.dur; else{cur={s:t,e:t+e.dur};bands.push(cur);} }
    }
    bands.forEach(b=>{const el=document.createElement('div'); el.className='freeband'; el.style.top=(b.s-START)*PX+'px'; el.style.height=(b.e-b.s)*PX+'px'; col.appendChild(el);});
  });
}
function startDrag(){
  const e=drag.e, c=catOf(e);
  drag.started=true; drag.placed=othersPlaced(e.id);
  document.body.classList.add('dragging'); drag.el.classList.add('dragsrc');
  const g=document.createElement('div'); g.className=`dragghost k-${TC[c.tier]}`; g.textContent=e.title; document.body.appendChild(g); drag.ghost=g;
  showBands(e);
  const loop=()=>{ if(!drag||!drag.started) return;
    const y=drag.y, x=drag.x, edge=60;
    if(y<edge) scrollBy(0,-14); else if(y>innerHeight-edge) scrollBy(0,14);
    const cal=document.querySelector('.cal'), r=cal.getBoundingClientRect();
    if(cal.scrollWidth>cal.clientWidth){ if(x<r.left+40) cal.scrollLeft-=14; else if(x>r.right-40) cal.scrollLeft+=14; }
    moveDrag(drag.x,drag.y); drag.raf=requestAnimationFrame(loop); };
  drag.raf=requestAnimationFrame(loop);
}
function moveDrag(x,y){
  drag.x=x; drag.y=y;
  drag.ghost.style.left=(x+14)+'px'; drag.ghost.style.top=(y+14)+'px';
  const col=(document.elementFromPoint(x,y)||{closest:()=>null}).closest('.col[data-day]');
  if(!col){ if(drag.prev){drag.prev.remove();drag.prev=null;} drag.target=null; return; }
  const e=drag.e, r=col.getBoundingClientRect(), d=+col.dataset.day;
  let t=Math.round((START+(y-r.top)/PX-drag.grabMin)/STEP)*STEP;
  t=Math.max(START,Math.min(END-e.dur,t));
  const ok=canPlace(e,d,t,drag.placed);
  if(!drag.prev||drag.prev.parentNode!==col){ if(drag.prev) drag.prev.remove(); drag.prev=document.createElement('div'); col.appendChild(drag.prev); }
  drag.prev.className='dropprev'+(ok?'':' bad');
  drag.prev.style.top=(t-START)*PX+'px'; drag.prev.style.height=Math.max(e.dur*PX,22)+'px';
  drag.prev.textContent=`${wd(d)} ${fmt(t)}–${fmt(t+e.dur)}${ok?'':' · passt nicht'}`;
  drag.target={day:d,start:t,ok};
}
function cleanupDrag(){
  if(!drag) return; cancelAnimationFrame(drag.raf);
  if(drag.ghost) drag.ghost.remove(); if(drag.prev) drag.prev.remove();
  document.querySelectorAll('.freeband').forEach(b=>b.remove());
  document.body.classList.remove('dragging'); if(drag.el) drag.el.classList.remove('dragsrc');
}
function endDrag(){
  const tg=drag.target, e=drag.e; cleanupDrag();
  if(!tg) return;
  if(!tg.ok){ toast(tierOf(e)===1?'Diese Zeit liegt in der Vergangenheit oder außerhalb des Kalenders.':'Hier passt der Termin nicht. Grün markierte Bereiche passen.'); return; }
  const before=propSnapshot();
  setInst(e.id,tg.day,tg.start); render();
  toast(`${e.title}: ${wdl(tg.day)}, ${dtxt(tg.day)} ${fmt(tg.start)}${e.series?' (nur dieser Termin der Serie)':''}`);
  showNewProps(before,e.title);
}
document.addEventListener('pointerdown',ev=>{
  if(mode!=='plan'||ev.button>0||drag) return;
  if(ev.target.closest('button[data-accept]')&&!ev.target.closest('.slotprop')) return;
  const el=ev.target.closest('.tchip[data-drag], .ev[data-id], .slotprop[data-accept]'); if(!el) return;
  const id=el.dataset.drag||el.dataset.id||el.dataset.accept, e=EV.find(x=>x.id===id); if(!e) return;
  if(lockReason(e)==='past') return;
  const r=el.getBoundingClientRect(), inCal=!el.classList.contains('tchip');
  drag={id,e,el,x0:ev.clientX,y0:ev.clientY,x:ev.clientX,y:ev.clientY,started:false,pid:ev.pointerId,grabMin:inCal?Math.max(0,(ev.clientY-r.top)/PX):0};
});
document.addEventListener('pointermove',ev=>{
  if(!drag||ev.pointerId!==drag.pid) return;
  if(!drag.started){ if(Math.hypot(ev.clientX-drag.x0,ev.clientY-drag.y0)<6) return; startDrag(); }
  ev.preventDefault(); drag.x=ev.clientX; drag.y=ev.clientY;
},{passive:false});
document.addEventListener('pointerup',ev=>{
  if(!drag||ev.pointerId!==drag.pid) return;
  if(drag.started){ justDragged=true; setTimeout(()=>{justDragged=false;},50); endDrag(); }
  drag=null;
});
document.addEventListener('pointercancel',()=>{ if(drag&&drag.started) cleanupDrag(); drag=null; });
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&drag&&drag.started){ cleanupDrag(); drag=null; } });

/* ---------- Modus ---------- */
function setMode(m){
  mode=m==='daily'?'daily':'plan'; if(mode==='daily') VIEW=CURWEEK;
  try{localStorage.setItem(KEY+'-mode',mode);}catch(e){}
  document.body.classList.toggle('daily',mode==='daily');
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  prevPlan=null; render();
  if(mode==='daily'){const cal=document.querySelector('.cal'); cal.scrollTop=Math.max(0,(NOW.min-START-90)*PX);}
}
narrow.addEventListener('change',()=>render());
setInterval(()=>{const n=new Date(); if(dayOfDate(n)!==NOW.day){location.reload();return;} NOW.min=n.getHours()*60+n.getMinutes(); if(mode==='daily') render();},60000);

/* ---------- Orte & Wege ---------- */
let pdraft=null;
function openPlaces(){
  pdraft={places:clone(state.places).map(p=>({...p})),home:state.home,travel:clone(state.travel),from:state.home};
  renderPlaces(); $('p-err').hidden=true; $('ov-place').hidden=false;
}
function readPlaces(){
  pdraft.places.forEach(p=>{const i=$('pn-'+p.id); if(i) p.name=i.value;});
  const h=document.querySelector('input[name=homepick]:checked'); if(h) pdraft.home=h.value;
  document.querySelectorAll('.trow input').forEach(inp=>{const k=pkey(pdraft.from,inp.dataset.to); const v=inp.value.trim();
    if(v==='') delete pdraft.travel[k]; else pdraft.travel[k]=Math.max(0,Math.min(240,Math.round(+v)||0));});
}
function renderPlaces(){
  const used={}; state.events.forEach(e=>{if(e.loc) used[e.loc]=(used[e.loc]||0)+1;});
  $('plist').innerHTML=pdraft.places.map(p=>`<div class="prow${p.del?' del':''}">
    <input type="text" id="pn-${p.id}" value="${esc(p.name)}" aria-label="Name des Orts" ${p.del?'disabled':''}>
    <label class="homepick" for="ph-${p.id}"><input type="radio" name="homepick" id="ph-${p.id}" value="${p.id}" ${pdraft.home===p.id?'checked':''} ${p.del?'disabled':''}>Zuhause</label>
    <button type="button" class="iconbtn" data-pdel="${p.id}" ${pdraft.home===p.id&&!p.del?'disabled title="Dein Zuhause kann nicht gelöscht werden"':''}>${p.del?'Wiederherstellen':'Löschen'}</button>
    ${p.del&&used[p.id]?`<div class="delnote" style="grid-column:1/-1;font-size:12px;color:var(--danger)">${used[p.id]} Termin${used[p.id]>1?'e verlieren':' verliert'} den Ort.</div>`:''}</div>`).join('');
  const live=pdraft.places.filter(p=>!p.del);
  if(!live.some(p=>p.id===pdraft.from)) pdraft.from=live[0]?.id;
  $('p-from').innerHTML=live.map(p=>`<option value="${p.id}">${esc(p.name||'(ohne Namen)')}</option>`).join(''); $('p-from').value=pdraft.from;
  $('tlist').innerHTML=live.filter(p=>p.id!==pdraft.from).map(p=>{const v=pdraft.travel[pkey(pdraft.from,p.id)];
    return `<label class="trow" for="tv-${p.id}"><span>nach ${esc(p.name||'(ohne Namen)')}</span><input type="number" id="tv-${p.id}" data-to="${p.id}" min="0" max="240" step="5" value="${v??''}" placeholder="30"><span class="u">min</span></label>`;}).join('')||'<span class="note">Leg einen zweiten Ort an, um Wegzeiten einzutragen.</span>';
}
$('p-from').addEventListener('change',()=>{readPlaces(); pdraft.from=$('p-from').value; renderPlaces();});
$('plist').addEventListener('change',ev=>{if(ev.target.name==='homepick'){readPlaces(); renderPlaces();}});
$('plist').addEventListener('click',ev=>{const b=ev.target.closest('[data-pdel]'); if(!b) return; readPlaces();
  const p=pdraft.places.find(x=>x.id===b.dataset.pdel); if(p.isNew&&!p.del) pdraft.places=pdraft.places.filter(x=>x!==p); else p.del=!p.del; renderPlaces();});
$('p-add').onclick=()=>{readPlaces(); const id='p'+(state.nextId++); pdraft.places.push({id,name:'',isNew:true}); renderPlaces(); setTimeout(()=>$('pn-'+id).focus(),0);};
$('p-cancel').onclick=()=>{$('ov-place').hidden=true;};
$('placebtn').onclick=openPlaces;
$('pform').addEventListener('submit',ev=>{
  ev.preventDefault(); readPlaces(); const before=propSnapshot(); const fail=m=>{$('p-err').textContent=m;$('p-err').hidden=false;};
  const keep=pdraft.places.filter(p=>!p.del);
  if(keep.some(p=>!p.name.trim())) return fail('Jeder Ort braucht einen Namen.');
  const n=keep.map(p=>p.name.trim().toLowerCase()); if(new Set(n).size!==n.length) return fail('Zwei Orte haben denselben Namen.');
  if(!keep.some(p=>p.id===pdraft.home)) return fail('Wähle einen Ort als Zuhause.');
  const gone=pdraft.places.filter(p=>p.del).map(p=>p.id);
  state.events.forEach(e=>{if(gone.includes(e.loc)) e.loc=null;});
  Object.keys(pdraft.travel).forEach(k=>{if(k.split('|').some(id=>gone.includes(id))) delete pdraft.travel[k];});
  state.places=keep.map(p=>({id:p.id,name:p.name.trim()})); state.home=pdraft.home; state.travel=pdraft.travel;
  $('ov-place').hidden=true; render(); showNewProps(before,'die geänderten Wegzeiten');
});

/* Dialoge schließen */
['ov-ev','ov-cat','ov-sleep','ov-place','ov-prop','ov-detail','ov-import'].forEach(id=>$(id).addEventListener('click',ev=>{if(ev.target.id===id) $(id).hidden=true;}));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){['ov-ev','ov-cat','ov-sleep','ov-place','ov-prop','ov-detail','ov-import'].forEach(id=>$(id).hidden=true);}});

let savedMode='plan'; try{savedMode=localStorage.getItem(KEY+'-mode')||'plan';}catch(e){}
setMode(savedMode);

return {
  // Neue Daten von einem anderen Gerät übernehmen
  replaceState(s){ state=normalize(s); prevPlan=null; render(); }
};
}
