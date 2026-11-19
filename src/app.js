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
/* Ansicht (Raster): 1 Tag, 3 Tage, Woche (7) oder Monat ('m') – wählbar in der Leiste, pro Gerät und Modus gemerkt.
   1/3 Tage: Fenster ab DAY0, blättern in 1-/3-Tage-Schritten (auch über Wochengrenzen).
   Woche: VIEW (Montag-Woche). Monat: MON = {y,m}, Raster von Montag vor dem 1. bis Sonntag nach dem Monatsende. */
let DAY0=TODAY;
const SPANS=[[1,'Tag'],[3,'3 Tage'],[7,'Woche'],['m','Monat']];
let spanPref={}; try{spanPref=JSON.parse(localStorage.getItem('stufenkalender-span')||'{}')||{};}catch(e){}
const spanKey=()=>(narrow.matches?'n-':'w-')+mode;
const SPAN=()=>{const v=spanPref[spanKey()]; return [1,3,7,'m'].includes(v)?v:(narrow.matches&&mode==='daily'?3:7);};
const dayWin=()=>SPAN()===1||SPAN()===3;
const threeDay=dayWin; // alter Name: „Fenster ab DAY0“
const win3=()=>Array.from({length:SPAN()},(_,i)=>DAY0+i);
let MON=(()=>{const d=dateOf(TODAY); return {y:d.getFullYear(),m:d.getMonth()};})();
function monthDays(){
  const first=dayOfDate(new Date(MON.y,MON.m,1)), last=dayOfDate(new Date(MON.y,MON.m+1,0));
  const a=first-wdi(first), b=last+(6-wdi(last)); return Array.from({length:b-a+1},(_,i)=>a+i);
}
const setMonthOf=d=>{const x=dateOf(d); MON={y:x.getFullYear(),m:x.getMonth()};};
let START=6*60;
const TIERS={1:{name:'Fix',rule:'wird nie verschoben'},2:{name:'Wichtig',rule:'weicht nur Stufe 1 aus'},3:{name:'Flexibel',rule:'weicht allem aus'}};
const COLORS=['blue','orange','violet','green','pink','teal','red','yellow','slate'];
const TC={1:'t1',2:'t2',3:'t3'};
// Farbe = Kategorie (c-blue …), Füllung = Stufe (f1 voll, f2 getönt, f3 nur Umriss)
const kc=c=>`c-${COLORS.includes(c&&c.color)?c.color:'slate'} f${(c&&c.tier)||3}`;
const COLOR_NAMES={red:'Himbeere',orange:'Orange',yellow:'Gelb',green:'Grün',teal:'Türkis',blue:'Blau',violet:'Violett',pink:'Pink',slate:'Grau'};
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
  places:[{id:'home',name:'Zuhause'}],home:'home',travel:{},lockMode:'eve',todos:[],trackers:{gym:true,run:true,sprint:true}};}
function normalize(s){
  const st=(s&&Array.isArray(s.events)&&Array.isArray(s.cats))?Object.assign(fresh(),clone(s)):fresh();
  // Früher hing „Gewohnheit“ an einzelnen Serien, jetzt an der Kategorie
  st.events.forEach(e=>{ if(e.habit){const c=st.cats.find(x=>x.id===e.cat); if(c) c.habit=true;} delete e.habit; });
  // Kategorien ohne gültige Farbe bekommen die erste noch freie
  st.cats.forEach(c=>{ if(!COLORS.includes(c.color)){ const used=st.cats.map(x=>x.color); c.color=COLORS.find(k=>!used.includes(k))||'slate'; } });
  if(!Array.isArray(st.todos)) st.todos=[];
  if(!st.trackers) st.trackers={gym:true,run:true,sprint:true};
  if(st.trackers.sprint==null) st.trackers.sprint=true;
  st.events.forEach(e=>{
    if(e.exercises&&!e.track) e.track='gym';
    // Sprint: früher Liste abgehakter Übungen, jetzt {[Übung]: [Satz erledigt?, …]}
    if(e.slog) Object.keys(e.slog).forEach(o=>{ const v=e.slog[o]; if(Array.isArray(v)){ const m={}; v.forEach(n=>{ if(typeof n==='string') m[n]=[true]; }); e.slog[o]=m; } });
    // Workout-Einträge: jetzt eine Liste einzelner Sätze [{reps,kg}].
    // Ältere Einträge {sets,reps,kg} werden in entsprechend viele gleiche Sätze umgerechnet.
    if(e.wlog) Object.values(e.wlog).forEach(log=>Object.keys(log).forEach(k=>{ const v=log[k];
      if(Array.isArray(v)){ log[k]=v.map(x=>({reps:x&&x.reps!=null?x.reps:'',kg:x&&x.kg!=null?x.kg:''})); return; }
      if(v&&typeof v==='object'){ const n=Math.max(1,Math.min(20,parseInt(v.sets)||1));
        log[k]=Array.from({length:n},()=>({reps:v.reps??'',kg:v.kg??''})); } else delete log[k]; }));
  });
  return st;
}
let state=normalize(initial);
const placeName=id=>(state.places.find(p=>p.id===id)||{name:'?'}).name;
function travel(a,b){if(!a||!b||a===b) return {min:0,est:false}; const v=state.travel[pkey(a,b)]; return v==null?{min:DEFAULT_TRAVEL,est:true}:{min:v,est:false};}
function save(){ if(onChange) onChange(clone(state)); }
/* ---------- Rückgängig ----------
   Nach jeder echten Änderung (Filter zählen nicht) wird der vorherige Stand gemerkt
   und unten kurz „Rückgängig“ angeboten. */
let snap=null, undoPrev=null, undoFresh=false, undoMsgShown=false;
const dataSnap=()=>JSON.stringify(Object.assign({},state,{hidden:undefined}));
function trackUndo(){
  const cur=dataSnap();
  if(snap===null){snap=cur; return;}
  if(cur===snap) return;
  const prev=JSON.parse(snap); undoPrev=snap; snap=cur;
  if(undoFresh) return;
  undoFresh=true; undoMsgShown=false;
  setTimeout(()=>{ if(!undoMsgShown) toast(undoText(prev)); undoFresh=false; },0);
}
function undoText(prev){
  const a=prev.events.length, b=state.events.length;
  if(b<a) return a-b>1?`${a-b} Termine gelöscht.`:'Termin gelöscht.';
  if(b>a) return b-a>1?`${b-a} Termine angelegt.`:'Termin angelegt.';
  if(JSON.stringify(prev.events)!==JSON.stringify(state.events)) return 'Termin geändert.';
  const ta=(prev.todos||[]).length, tb=(state.todos||[]).length;
  if(tb>ta) return 'To-do angelegt.'; if(tb<ta) return 'To-do entfernt.';
  if(JSON.stringify(prev.todos||[])!==JSON.stringify(state.todos||[])) return 'To-do geändert.';
  return 'Einstellung geändert.';
}
function doUndo(){
  if(!undoPrev) return;
  const hidden=state.hidden; state=normalize(JSON.parse(undoPrev)); state.hidden=hidden;
  undoPrev=null; snap=dataSnap(); prevPlan=null; render();
  toast('Rückgängig gemacht.');
}
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
/* ---------- Abhaken und Gewohnheiten ----------
   event.done = {[Tagesnummer des Vorkommens]: 1}; cat.habit = true macht eine Kategorie zur Gewohnheit.
   Die Serie zählt nur Tage mit geplantem Termin – Tage ohne Termin unterbrechen sie nicht. */
const isDone=inst=>!!(inst&&inst.done&&inst.done[inst.occ]);
function toggleDone(sid,occ){
  const s=state.events.find(x=>x.id===sid); if(!s) return;
  s.done=s.done||{}; const was=!!s.done[occ];
  if(was) delete s.done[occ]; else s.done[occ]=1;
  if(!Object.keys(s.done).length) delete s.done;
  render();
  if(was) toast(`${s.title}: nicht mehr erledigt.`);
  else if((catOf(s)||{}).habit){const st=habitStats(s.cat); toast(`${s.title} erledigt – ${catOf(s).name}: ${st.streak} am Stück${st.streak>1&&st.streak>=st.best?' (Rekord!)':''}.`);}
  else toast(`${s.title} erledigt.`);
}
// Alle Vorkommen einer Serie bis heute, mit ihrem tatsächlichen Tag (verschobene berücksichtigt)
function pastOcc(e,limit=400){
  const out=[];
  for(let d=Math.max(e.day,TODAY-limit); d<=TODAY+7; d++){
    if(!occursOn(e,d)) continue; const x=e.ex&&e.ex[d]; if(x==='skip') continue;
    const day=x?x.day:d; if(day>TODAY) continue; out.push({occ:d,day});
  }
  return out.sort((a,b)=>a.day-b.day);
}
// Serie einer Gewohnheits-Kategorie: zählt Tage, an denen mindestens ein Termin der Kategorie geplant ist.
// Ein Tag gilt als geschafft, wenn mindestens ein Termin an dem Tag abgehakt ist.
function habitStats(cid){
  const byDay=new Map();
  state.events.filter(e=>e.cat===cid).forEach(e=>pastOcc(e).forEach(o=>{
    if(!byDay.has(o.day)) byDay.set(o.day,{day:o.day,items:[],done:false});
    const d=byDay.get(o.day); const dn=!!(e.done&&e.done[o.occ]);
    d.items.push({sid:e.id,occ:o.occ,start:(e.ex&&e.ex[o.occ]&&e.ex[o.occ].start)||e.start,done:dn}); if(dn) d.done=true;
  }));
  const days=[...byDay.values()].sort((a,b)=>a.day-b.day);
  const today=byDay.get(TODAY)||null;
  const list=today&&!today.done?days.filter(d=>d!==today):days; // heute zählt erst, wenn erledigt
  let streak=0; for(let i=list.length-1;i>=0&&list[i].done;i--) streak++;
  let best=0,run=0; days.forEach(d=>{ if(d.done){run++; best=Math.max(best,run);} else if(d!==today) run=0; });
  const recent=days.slice(-10).map(d=>({day:d.day,state:d.done?'done':d===today?'today':'miss'}));
  if(today) today.items.sort((a,b)=>a.start-b.start);
  return {streak,best,today,recent};
}
// „Heute abhaken“: ersten Termin von heute abhaken; ist schon etwas erledigt, alles von heute zurücknehmen
function toggleHabitToday(cid){
  const st=habitStats(cid), c=state.cats.find(x=>x.id===cid); if(!st.today||!c) return;
  if(st.today.done){ st.today.items.forEach(it=>{const s=state.events.find(x=>x.id===it.sid); if(s&&s.done){delete s.done[it.occ]; if(!Object.keys(s.done).length) delete s.done;}}); render(); toast(`${c.name}: heute nicht mehr erledigt.`); return; }
  const it=st.today.items[0]; toggleDone(it.sid,it.occ);
}
const FLAME='<svg class="flame" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.3 2.2-3 2.3 1.8 3.5 4.3 3.5 6.6C18.5 19.3 15.6 22 12 22s-6.5-2.7-6.5-6.4C5.5 10.4 10.5 7.6 12 2z"/></svg>';
function renderHabits(){
  const hs=state.cats.filter(c=>c.habit);
  const box=$('habits'); box.hidden=!hs.length; if(!hs.length){box.innerHTML='';return;}
  box.innerHTML='<h2 class="hhead">Gewohnheiten</h2><div class="hlist">'+hs.map(c=>{
    const st=habitStats(c.id), dn=st.today&&st.today.done;
    const dots=st.recent.map(o=>`<span class="hd ${o.state}" title="${wd(o.day)} ${dtxt(o.day)}: ${o.state==='done'?'erledigt':o.state==='today'?'heute':'nicht erledigt'}"></span>`).join('');
    const btn=st.today?`<button type="button" class="hbtn${dn?' on':''}" data-habitcat="${c.id}" aria-pressed="${!!dn}">${dn?'✓ Heute erledigt':'Heute abhaken'}</button>`:'<span class="hfree">Heute nicht geplant</span>';
    return `<div class="hcard ${kc(c)}">
      <div class="htop"><span class="htitle">${esc(c.name)}</span><span class="hstreak${st.streak?'':' zero'}" title="Rekord: ${st.best}">${FLAME}${st.streak}</span></div>
      <div class="hdots" aria-label="Letzte Tage mit ${esc(c.name)}">${dots||'<span class="hfree">Noch keine vergangenen Termine</span>'}</div>
      <div class="hfoot">${btn}<span class="hbest">Rekord ${st.best}</span></div></div>`;}).join('')+'</div>';
}
/* ---------- To-dos ----------
   state.todos = [{id,title,cat,dur,due}] – Aufgaben ohne feste Zeit. Wird ein To-do in den Kalender
   gezogen oder ein Vorschlag übernommen, wird daraus ein normaler Termin (mit fromTodo:true, due). */
const todoEv=t=>({id:'todo:'+t.id,todoId:t.id,title:t.title,cat:t.cat,dur:t.dur,loc:null,day:TODAY,start:0});
function durTxt(m){const h=Math.floor(m/60), r=m%60; return (h?h+' h':'')+(h&&r?' ':'')+(r?r+' min':'');}
// Nächste passende Lücke in der angezeigten Woche (ab jetzt, vor der Frist)
function todoSuggest(t,taken=[]){
  const e=todoEv(t), placed=othersPlaced(e.id).concat(taken);
  for(const d of shownDays()){
    if(d<TODAY) continue; if(t.due!=null&&d>t.due) break;
    for(let m=START;m<=END-t.dur;m+=STEP){
      // Vorschläge immer in eine wirklich freie Lücke – auch für Fix-To-dos, und nie in die Schlafenszeit
      if(d*1440+m<Math.ceil((nowAbs()+1)/STEP)*STEP||inSleep(d,m,t.dur)) continue;
      if(fits({day:d,start:m,dur:t.dur,loc:null},placed,state.buffer).ok) return {day:d,start:m,dur:t.dur};
    }
  }
  return null;
}
function scheduleTodo(tid,day,start){
  const i=state.todos.findIndex(x=>x.id===tid); if(i<0) return; const t=state.todos[i];
  const before=propSnapshot();
  state.todos.splice(i,1);
  state.events.push({id:state.nextId++,title:t.title,cat:t.cat,day,start,dur:t.dur,loc:null,note:'',rec:null,locked:false,fromTodo:true,due:t.due??null});
  delete state.hidden[t.cat];
  render(); toast(`${t.title}: eingeplant für ${wdl(day)}, ${dtxt(day)} ${fmt(start)}.`); showNewProps(before,t.title);
}
function doneTodo(tid){
  const i=state.todos.findIndex(x=>x.id===tid); if(i<0) return; const t=state.todos.splice(i,1)[0];
  render(); toast(`${t.title} erledigt.`);
}
function renderTodos(){
  const list=state.todos.slice().sort((a,b)=>(a.due??1e9)-(b.due??1e9));
  $('todocount').textContent=list.length?list.length:'';
  $('todohint').textContent=list.length?'Zieh sie in den Kalender – grün markierte Bereiche passen – oder nimm den Vorschlag.':'Aufgaben ohne feste Zeit, z. B. „Hausarbeit gliedern“. Leg sie mit „+ To-do“ an.';
  const taken=[]; // Vorschläge sollen sich nicht gegenseitig überschneiden (dringendste zuerst)
  $('todolist').innerHTML=list.map(t=>{
    const c=catOf(t), sug=todoSuggest(t,taken); if(sug) taken.push({id:'sug:'+t.id,day:sug.day,start:sug.start,dur:sug.dur,loc:null});
    const dueTxt=t.due==null?'':t.due<TODAY?` · <span class="over">überfällig (${dtxt(t.due)})</span>`:t.due===TODAY?' · <b>heute fällig</b>':` · bis ${wd(t.due)} ${dtxt(t.due)}`;
    return `<div class="tchip todo ${kc(c)}" data-todo="${t.id}" aria-label="${esc(t.title)} – zum Einplanen in den Kalender ziehen">
      <span class="grip">⠿ ZIEHEN</span>
      <button type="button" class="tedit" data-todoedit="${t.id}" title="Bearbeiten">${esc(t.title)}</button>
      <span class="h">${durTxt(t.dur)}${dueTxt}</span>
      <div class="tacts">${sug?`<button type="button" data-todosug="${t.id}" data-day="${sug.day}" data-start="${sug.start}">Vorschlag: ${wd(sug.day)} ${fmt(sug.start)}</button>`:`<span class="nos">${t.due!=null&&t.due<shownDays()[0]?'Frist liegt vorher':SPAN()===1?'Kein Platz an diesem Tag':SPAN()===3?'Kein Platz in diesen Tagen':SPAN()==='m'?'Kein Platz in diesem Monat':'Kein Platz in dieser Woche'}</span>`}
        <button type="button" class="tdone" data-tododone="${t.id}" aria-label="${esc(t.title)} als erledigt abhaken" title="Erledigt">✓</button></div>
    </div>`;}).join('');
}
// Alltag: Kasten mit noch nicht eingeplanten To-dos – kurze (< 30 min) zum direkten Abhaken
const QUICK_MAX=30;
function renderQuick(){
  const all=state.todos.slice().sort((a,b)=>(a.due??1e9)-(b.due??1e9)||a.dur-b.dur);
  const box=$('quick'); box.hidden=!all.length; if(!all.length){box.innerHTML='';return;}
  const short=all.filter(t=>t.dur<QUICK_MAX), long=all.length-short.length;
  const due=t=>t.due==null?'':t.due<TODAY?' · <span class="over">überfällig</span>':t.due===TODAY?' · <b>heute fällig</b>':` · bis ${wd(t.due)} ${dtxt(t.due)}`;
  box.innerHTML=`<h2 class="hhead" id="quick-h">Kurz erledigen${short.length?` <span class="todocount">${short.length}</span>`:''}</h2>
    ${short.length?`<ul class="qlist">${short.map(t=>`<li class="${kc(catOf(t))}">
      <button type="button" class="qcheck" data-tododone="${t.id}" aria-label="${esc(t.title)} abhaken"></button>
      <span class="qt">${esc(t.title)}</span><span class="qm">${durTxt(t.dur)}${due(t)}</span></li>`).join('')}</ul>`
      :'<p class="qnone">Keine kurzen To-dos offen.</p>'}
    ${long?`<p class="qmore">${long===1?'1 größeres To-do wartet':`${long} größere To-dos warten`} noch aufs Einplanen. <button type="button" class="linkbtn" data-mode="plan">Im Planen-Modus einplanen</button></p>`:''}`;
}
let editTodo=null;
function openTodo(tid){
  if(!state.cats.length){openMgr(); return;}
  const t=tid?state.todos.find(x=>x.id===tid):null; editTodo=t?t.id:null;
  $('t-head').textContent=t?'To-do bearbeiten':'Neues To-do';
  $('t-cat').innerHTML=[1,2,3].map(n=>{const cs=state.cats.filter(c=>c.tier===n); if(!cs.length) return '';
    return `<optgroup label="Stufe ${n} · ${TIERS[n].name}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;}).join('');
  $('t-title').value=t?t.title:''; $('t-cat').value=t?t.cat:(state.cats.find(c=>c.tier===2)||state.cats[0]).id;
  $('t-dur').value=String(t?t.dur:60); if(!$('t-dur').value) $('t-dur').value='60';
  $('t-due').value=t&&t.due!=null?isoDate(t.due):'';
  $('t-del').hidden=!t; $('t-err').hidden=true; syncTodoCat();
  $('ov-todo').hidden=false; setTimeout(()=>$('t-title').focus(),0);
}
function syncTodoCat(){const c=state.cats.find(x=>x.id===$('t-cat').value); if(c) $('t-catinfo').textContent=`Stufe ${c.tier} · ${TIERS[c.tier].name}: ${TIERS[c.tier].rule}`;}
/* ---------- Tracker: Krafttraining und Laufen ----------
   event.track = 'gym' | 'run' | 'sprint' (Art des Termins), an/aus über state.trackers {gym,run,sprint}.
   Sprint: event.exercises wie beim Krafttraining, event.slog = {[Vorkommen]: {[Übung]: [true|false je Satz]}} – Sätze zum Abhaken.
   Krafttraining: event.exercises = ['Kniebeugen', …], event.wlog = {[Vorkommen]: {[Übung]: [{reps,kg}, …]}} (ein Eintrag pro Satz).
   Laufen: event.rlog = {[Vorkommen]: {km, sec, kind?}} (kind = Art des Laufs, z. B. „Long Run“). „Letztes Mal“ = jüngster Eintrag davor (egal welche Serie). */
const numTxt=n=>String(n).replace('.',',');
const trackOn=e=>!!(e&&e.track&&state.trackers&&state.trackers[e.track]);
const occDay=(e,occ)=>(e.ex&&e.ex[occ]&&e.ex[occ].day)??occ;
function lastSets(name,beforeDay){
  const key=name.toLowerCase(); let best=null;
  state.events.forEach(e=>{ if(!e.wlog) return;
    Object.entries(e.wlog).forEach(([occ,log])=>{ occ=+occ; const day=occDay(e,occ); if(day>=beforeDay) return;
      const k=Object.keys(log).find(x=>x.toLowerCase()===key); if(!k) return;
      if(!best||day>best.day) best={day,name:k,sets:log[k]}; }); });
  return best;
}
// Letzter Lauf vor dem Tag; mit kind nur Läufe derselben Art (Groß-/Kleinschreibung egal)
function lastRun(beforeDay,kind){
  const k=(kind||'').trim().toLowerCase(); let best=null;
  state.events.forEach(e=>{ if(!e.rlog) return;
    Object.entries(e.rlog).forEach(([occ,r])=>{ const day=occDay(e,+occ); if(day>=beforeDay) return;
      if(k&&(r.kind||'').toLowerCase()!==k) return; if(!best||day>best.day) best={day,...r}; }); });
  return best;
}
// Bisher benutzte Lauf-Arten (neueste zuerst), aufgefüllt mit Beispielen
function runKinds(){
  const seen=[]; state.events.forEach(e=>{ if(!e.rlog) return; Object.entries(e.rlog).forEach(([occ,r])=>{ if(r.kind) seen.push({day:occDay(e,+occ),kind:r.kind}); }); });
  seen.sort((a,b)=>b.day-a.day); const out=[];
  [...seen.map(x=>x.kind),'Long Run','Recovery Run','3 km','5 km'].forEach(k=>{ if(out.length<8&&!out.some(x=>x.toLowerCase()===k.toLowerCase())) out.push(k); });
  return out;
}
const runTxt=r=>`${numTxt(r.km)} km in ${fmtDur(r.sec)} min${paceTxt(r.km,r.sec)?' · '+paceTxt(r.km,r.sec):''}`;
const fmtDur=sec=>{sec=Math.round(sec); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), x=sec%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
function parseRunTime(t){ t=(t||'').trim().replace(',','.'); if(!t) return null;
  if(/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t)*60); // nur Minuten
  const p=t.split(':').map(Number); if(p.some(isNaN)) return null;
  if(p.length===2) return p[0]*60+p[1]; if(p.length===3) return p[0]*3600+p[1]*60+p[2]; return null; }
const paceTxt=(km,sec)=>km>0&&sec>0?fmtDur(sec/km)+' min/km':'';
const hasV=x=>x!==''&&x!=null;
const setTxt=x=>hasV(x.kg)?`${numTxt(x.kg)} kg × ${hasV(x.reps)?x.reps:'–'}`:`${hasV(x.reps)?x.reps:'–'} Wdh.`;
// Kurzfassung einer Übung: gleiche Sätze zusammengefasst („3 Sätze · 60 kg × 10“), sonst jeder Satz einzeln
function gymTxt(sets){ sets=sets||[]; if(!sets.length) return '–';
  const same=sets.every(x=>String(x.reps)===String(sets[0].reps)&&String(x.kg)===String(sets[0].kg));
  return same?`${sets.length} ${sets.length===1?'Satz':'Sätze'} · ${setTxt(sets[0])}`:sets.map(setTxt).join(' · '); }
const wRow=(i,x)=>`<div class="wset"><span class="wno">${i+1}</span>
  <label class="wf"><span>Wdh.</span><input class="wreps" inputmode="numeric" value="${hasV(x.reps)?x.reps:''}" placeholder="0"></label>
  <label class="wf"><span>Gewicht</span><input class="wkg" inputmode="decimal" value="${hasV(x.kg)?numTxt(x.kg):''}" placeholder="0"><em>kg</em></label>
  <button type="button" class="wdel" title="Satz entfernen" aria-label="Satz entfernen">×</button></div>`;
const renumber=box=>box.querySelectorAll('.wset .wno').forEach((n,i)=>n.textContent=i+1);
function wexHTML(name,cur,day){
  const last=lastSets(name,day);
  const sets=cur&&cur.length?cur:last?last.sets:[{reps:'',kg:''},{reps:'',kg:''},{reps:'',kg:''}];
  const lastTxt=last?`Letztes Mal (${wd(last.day)} ${dtxt(last.day)}): ${gymTxt(last.sets)}`:'Noch kein früherer Eintrag.';
  return `<div class="wex" data-name="${esc(name)}"><div class="wname">${esc(name)}</div><div class="wlast">${lastTxt}</div>
    <div class="wsets">${sets.map((x,j)=>wRow(j,x)).join('')}</div>
    <button type="button" class="linkbtn wadd">+ Satz</button></div>`;
}
// Sprint: Satzzahl vom letzten Mal, sonst Zahl vorne im Namen („4× 30 m“), sonst 1
function lastSprint(name,beforeDay){
  const key=name.toLowerCase(); let best=null;
  state.events.forEach(e=>{ if(!e.slog) return;
    Object.entries(e.slog).forEach(([occ,log])=>{ const day=occDay(e,+occ); if(day>=beforeDay) return;
      const k=Object.keys(log).find(x=>x.toLowerCase()===key); if(!k) return;
      if(!best||day>best.day) best={day,name:k,sets:log[k]}; }); });
  return best;
}
function sprintHTML(name,cur,day){
  let sets=cur&&cur.length?cur:null;
  if(!sets){ const last=lastSprint(name,day), m=name.match(/^\s*(\d{1,2})\s*[×x*]/i);
    const n=last?last.sets.length:m?Math.min(20,Math.max(1,+m[1])):1; sets=Array(n).fill(false); }
  return `<div class="sex" data-name="${esc(name)}"><div class="shead"><span class="sname">${esc(name)}</span><span class="sfrac"></span></div>
    <div class="ssets">${sets.map((d,i)=>sSet(i,d)).join('')}
      <span class="sbtns"><button type="button" class="sminus" aria-label="Satz weniger">−</button><button type="button" class="splus" aria-label="Satz mehr">+</button></span></div></div>`;
}
const sSet=(i,d)=>`<button type="button" class="sset${d?' on':''}" aria-pressed="${d?'true':'false'}" aria-label="Satz ${i+1}">${d?'✓':i+1}</button>`;
let wInst=null;
function openWorkout(inst){
  const s=state.events.find(x=>x.id===inst.sid); if(!s||!trackOn(s)) return; wInst=inst;
  const run=s.track==='run', sprint=s.track==='sprint';
  $('w-head').textContent=run?`Lauf: ${s.title}`:sprint?`Sprint: ${s.title}`:`Workout: ${s.title}`;
  $('w-sub').textContent=`${wdl(inst.day)}, ${dtxt(inst.day)}`;
  $('w-gym').hidden=run||sprint; $('w-run').hidden=!run; $('w-sprint').hidden=!sprint; $('r-err').hidden=true;
  $('w-adder').hidden=run; $('w-newex').hidden=true; $('w-addex').hidden=false; $('w-exname').value='';
  $('w-exname').placeholder=sprint?'Name der Übung, z. B. 3× 60 m fliegend':'Name der Übung, z. B. Klimmzüge';
  if(sprint){
    const cur=(s.slog&&s.slog[inst.occ])||{};
    const names=[...(s.exercises||[])]; Object.keys(cur).forEach(n=>{ if(!names.some(x=>x.toLowerCase()===n.toLowerCase())) names.push(n); });
    $('s-list').innerHTML=names.map(n=>sprintHTML(n,cur[n],inst.day)).join('');
    syncSprint(); $('ov-workout').hidden=false; return;
  }
  if(run){
    const cur=s.rlog&&s.rlog[inst.occ];
    // Art vorschlagen: gespeicherte Art, sonst die Art vom letzten Lauf dieses Termins
    let kind=cur&&cur.kind||'';
    if(!cur&&s.rlog){ const prev=Object.entries(s.rlog).map(([o,r])=>({day:occDay(s,+o),r})).filter(x=>x.day<inst.day&&x.r.kind).sort((a,b)=>b.day-a.day)[0]; if(prev) kind=prev.r.kind; }
    $('r-kind').value=kind;
    $('r-kinds').innerHTML=runKinds().map(k=>`<button type="button" class="rkind" data-kind="${esc(k)}">${esc(k)}</button>`).join('');
    $('r-km').value=cur?numTxt(cur.km):''; $('r-time').value=cur?fmtDur(cur.sec):'';
    syncRun(); $('ov-workout').hidden=false; setTimeout(()=>$('r-km').focus(),0); return;
  }
  const cur=(s.wlog&&s.wlog[inst.occ])||{};
  // Übungen des Termins plus Übungen, die nur bei diesem Workout dazukamen
  const names=[...(s.exercises||[])]; Object.keys(cur).forEach(n=>{ if(!names.some(x=>x.toLowerCase()===n.toLowerCase())) names.push(n); });
  $('w-list').innerHTML=names.map(name=>wexHTML(name,cur[name],inst.day)).join('');
  $('w-gym').hidden=false; $('w-newex').hidden=true; $('w-exname').value='';
  $('ov-workout').hidden=false;
}
// „Letztes Mal“ passend zur Art + Tempo im Vergleich zum letzten Lauf dieser Art
function syncRun(){
  $('r-err').hidden=true; const inst=wInst; if(!inst) return;
  const kind=$('r-kind').value.trim(), last=lastRun(inst.day,kind);
  document.querySelectorAll('#r-kinds .rkind').forEach(b=>b.classList.toggle('on',!!kind&&b.dataset.kind.toLowerCase()===kind.toLowerCase()));
  $('r-last').textContent=last?`Letzter ${kind?'„'+(last.kind||kind)+'“':'Lauf'} (${wd(last.day)} ${dtxt(last.day)}): ${runTxt(last)}`
    :kind?`Noch kein früherer Lauf „${kind}“ – ab jetzt wird damit verglichen.`:'Noch kein früherer Lauf.';
  const km=parseFloat($('r-km').value.replace(',','.')), sec=parseRunTime($('r-time').value);
  let t=paceTxt(km,sec)?'Tempo: '+paceTxt(km,sec):'';
  if(t&&last&&last.km>0&&last.sec>0){ const d=Math.round(sec/km-last.sec/last.km);
    t+=d===0?' · gleich schnell wie letztes Mal':` · ${fmtDur(Math.abs(d)).replace(/^0:/,'')}${Math.abs(d)<60?' s':' min'}/km ${d<0?'schneller':'langsamer'} als letztes Mal`; }
  $('r-pace').textContent=t;
}
$('r-km').addEventListener('input',syncRun); $('r-time').addEventListener('input',syncRun); $('r-kind').addEventListener('input',syncRun);
$('r-kinds').addEventListener('click',ev=>{ const b=ev.target.closest('.rkind'); if(!b) return;
  $('r-kind').value=$('r-kind').value.trim().toLowerCase()===b.dataset.kind.toLowerCase()?'':b.dataset.kind; syncRun(); });
$('w-cancel').onclick=()=>{$('ov-workout').hidden=true;};
// „+ Übung“: weitere Übung nur für dieses Workout (dauerhaft: im Termin unter „Übungen“)
$('w-addex').onclick=()=>{ $('w-newex').hidden=false; $('w-addex').hidden=true; $('w-exname').focus(); };
function addExercise(){
  let name=$('w-exname').value.trim().replace(/\s+/g,' '); if(!name){ $('w-exname').focus(); return; }
  if(!$('w-sprint').hidden){
    const known=lastSprint(name,wInst.day); name=known?known.name:name[0].toUpperCase()+name.slice(1);
    const have=[...document.querySelectorAll('#s-list .sex')].find(b=>b.dataset.name.toLowerCase()===name.toLowerCase());
    if(!have){ $('s-list').insertAdjacentHTML('beforeend',sprintHTML(name,null,wInst.day)); syncSprint(); }
    $('w-exname').value=''; $('w-newex').hidden=true; $('w-addex').hidden=false; return;
  }
  const known=lastSets(name,wInst.day); name=known?known.name:name[0].toUpperCase()+name.slice(1); // Schreibweise vom letzten Mal
  const have=[...document.querySelectorAll('#w-list .wex')].find(b=>b.dataset.name.toLowerCase()===name.toLowerCase());
  if(have){ have.querySelector('.wreps').focus(); }
  else { $('w-list').insertAdjacentHTML('beforeend',wexHTML(name,null,wInst.day)); $('w-list').lastElementChild.querySelector('.wreps').focus(); }
  $('w-exname').value=''; $('w-newex').hidden=true; $('w-addex').hidden=false;
}
$('w-exok').onclick=addExercise;
$('w-exname').addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); addExercise(); } if(ev.key==='Escape'){ ev.stopPropagation(); $('w-newex').hidden=true; $('w-addex').hidden=false; } });
// „+ Satz“ übernimmt die Werte des letzten Satzes; × entfernt einen Satz
$('w-list').addEventListener('click',ev=>{
  const add=ev.target.closest('.wadd'), del=ev.target.closest('.wdel'); if(!add&&!del) return;
  const box=ev.target.closest('.wex').querySelector('.wsets');
  if(add){ const rows=box.querySelectorAll('.wset'), l=rows[rows.length-1];
    const x=l?{reps:l.querySelector('.wreps').value,kg:l.querySelector('.wkg').value}:{reps:'',kg:''};
    box.insertAdjacentHTML('beforeend',wRow(rows.length,x)); box.lastElementChild.querySelector('.wreps').focus(); }
  else { del.closest('.wset').remove(); renumber(box); }
});
function syncSprint(){
  const all=$('s-list').querySelectorAll('.sset'), on=$('s-list').querySelectorAll('.sset.on');
  $('s-list').querySelectorAll('.sex').forEach(b=>{ const a=b.querySelectorAll('.sset').length, o=b.querySelectorAll('.sset.on').length;
    b.querySelector('.sfrac').textContent=`${o}/${a}`; b.classList.toggle('full',a>0&&o===a); });
  $('s-count').textContent=all.length?`${on.length} von ${all.length} Sätzen erledigt`:'Noch keine Übungen – tippe auf „+ Übung“.'; }
// Satz antippen = abhaken/zurücknehmen; − / + ändert die Zahl der Sätze
$('s-list').addEventListener('click',ev=>{
  const b=ev.target.closest('.sset,.sminus,.splus'); if(!b) return; const box=b.closest('.sex').querySelector('.ssets');
  if(b.classList.contains('sset')){ const on=!b.classList.contains('on'), i=[...box.querySelectorAll('.sset')].indexOf(b); b.outerHTML=sSet(i,on); }
  else if(b.classList.contains('splus')){ const n=box.querySelectorAll('.sset').length; if(n<20) box.querySelector('.sbtns').insertAdjacentHTML('beforebegin',sSet(n,false)); }
  else { const all=box.querySelectorAll('.sset'); if(all.length>1) all[all.length-1].remove(); }
  syncSprint();
});
$('wform').addEventListener('submit',ev=>{
  ev.preventDefault(); const inst=wInst; const s=inst&&state.events.find(x=>x.id===inst.sid); if(!s) return;
  let saved=false;
  if(s.track==='sprint'){
    const log={}; let any=false;
    $('s-list').querySelectorAll('.sex').forEach(b=>{ const v=[...b.querySelectorAll('.sset')].map(x=>x.classList.contains('on')); log[b.dataset.name]=v; if(v.some(Boolean)) any=true; });
    s.slog=s.slog||{}; if(any){ s.slog[inst.occ]=log; saved=true; } else delete s.slog[inst.occ];
    if(!Object.keys(s.slog).length) delete s.slog;
  } else if(s.track==='run'){
    const kmT=$('r-km').value.trim(), tT=$('r-time').value.trim();
    const km=parseFloat(kmT.replace(',','.')), sec=parseRunTime(tT);
    if((kmT&&!(km>0))||(tT&&!(sec>0))){$('r-err').textContent='Gib die Distanz als Zahl (z. B. 5,2) und die Zeit als mm:ss (z. B. 28:30) ein.'; $('r-err').hidden=false; return;}
    s.rlog=s.rlog||{};
    let kind=$('r-kind').value.trim().replace(/\s+/g,' ');
    if(kind){ const known=runKinds().find(k=>k.toLowerCase()===kind.toLowerCase()); if(known) kind=known; }
    if(km>0||sec>0){ s.rlog[inst.occ]={km:km>0?km:0,sec:sec>0?sec:0}; if(kind) s.rlog[inst.occ].kind=kind; saved=true; } else delete s.rlog[inst.occ];
    if(!Object.keys(s.rlog).length) delete s.rlog;
  } else {
    const log={};
    document.querySelectorAll('#w-list .wex').forEach(box=>{ const name=box.dataset.name;
      const n=el=>{const v=parseFloat(el.value.replace(',','.')); return isNaN(v)?'':v;};
      const sets=[...box.querySelectorAll('.wset')].map(r=>({reps:n(r.querySelector('.wreps')),kg:n(r.querySelector('.wkg'))}))
        .filter(x=>x.reps!==''||x.kg!=='');
      if(sets.length) log[name]=sets; });
    s.wlog=s.wlog||{}; if(Object.keys(log).length){ s.wlog[inst.occ]=log; saved=true; } else delete s.wlog[inst.occ];
    if(!Object.keys(s.wlog).length) delete s.wlog;
  }
  if(saved){ s.done=s.done||{}; s.done[inst.occ]=1; }
  $('ov-workout').hidden=true; render(); toast(`${s.track==='run'?'Lauf':s.track==='sprint'?'Sprint-Workout':'Workout'} gespeichert${saved?' – Termin abgehakt':''}.`);
});
function trackSummary(e){
  if(e.track==='sprint'){const g=e.slog&&e.slog[e.occ]; if(!g) return ''; return Object.entries(g).map(([n,v])=>`${esc(n)}: ${v.filter(Boolean).length}/${v.length}`).join('<br>');}
  if(e.track==='run'){const r=e.rlog&&e.rlog[e.occ]; return r?`${r.kind?esc(r.kind)+': ':''}${runTxt(r)}`:'';}
  const lg=e.wlog&&e.wlog[e.occ]; return lg?Object.entries(lg).map(([n,v])=>`${esc(n)}: ${gymTxt(v)}`).join('<br>'):'';
}
/* ---------- Fortschritt: ein Liniendiagramm pro Übung bzw. Lauf-Art ----------
   Krafttraining: schwerstes Gewicht pro Training (ohne kg: meiste Wdh.). Laufen: Tempo pro Art (oben = schneller). */
function progressData(){
  const gym=new Map(), run=new Map();
  const add=(m,key,name,day,pt)=>{ let g=m.get(key); if(!g){ g={name,last:-1e9,pts:[]}; m.set(key,g); } if(day>=g.last){ g.last=day; g.name=name; } g.pts.push({day,...pt}); };
  state.events.forEach(e=>{
    if(e.wlog) Object.entries(e.wlog).forEach(([occ,log])=>{ const day=occDay(e,+occ); if(day>TODAY) return;
      Object.entries(log).forEach(([name,sets])=>{ if(!Array.isArray(sets)||!sets.length) return;
        const kgs=sets.filter(x=>+x.kg>0), kg=kgs.length?Math.max(...kgs.map(x=>+x.kg)):0;
        const repsAt=kg?Math.max(0,...kgs.filter(x=>+x.kg===kg).map(x=>+x.reps||0)):0, reps=Math.max(0,...sets.map(x=>+x.reps||0));
        if(kg||reps) add(gym,name.toLowerCase(),name,day,{kg,repsAt,reps,n:sets.length}); }); });
    if(e.rlog) Object.entries(e.rlog).forEach(([occ,r])=>{ const day=occDay(e,+occ); if(day>TODAY||!(r.km>0&&r.sec>0)) return;
      const k=(r.kind||'').trim(); add(run,k.toLowerCase(),k||'Ohne Art',day,{km:r.km,sec:r.sec,v:r.sec/r.km}); });
  });
  const gyms=[...gym.values()].map(g=>{ const useKg=g.pts.some(p=>p.kg>0);
    // pro Tag nur der beste Wert
    const byDay=new Map(); g.pts.filter(p=>useKg?p.kg>0:p.reps>0).forEach(p=>{ const v=useKg?p.kg:p.reps, o=byDay.get(p.day); if(!o||v>o.v) byDay.set(p.day,{...p,v}); });
    const pts=[...byDay.values()].sort((a,b)=>a.day-b.day);
    return {name:g.name,last:g.last,unit:useKg?'kg':'Wdh.',caption:useKg?'Schwerstes Gewicht pro Training':'Meiste Wiederholungen pro Training',pts,
      fmt:v=>useKg?numTxt(+v.toFixed(1))+' kg':v+' Wdh.',
      tip:p=>useKg?`${numTxt(p.kg)} kg × ${p.repsAt||'–'} · ${p.n} ${p.n===1?'Satz':'Sätze'}`:`${p.reps} Wdh. · ${p.n} ${p.n===1?'Satz':'Sätze'}`}; });
  const runs=[...run.values()].map(g=>({name:g.name,last:g.last,invert:true,caption:'Tempo pro Lauf (oben = schneller)',pts:g.pts.sort((a,b)=>a.day-b.day),
      fmt:v=>fmtDur(v)+' min/km', tip:p=>runTxt(p)}));
  const by=(a,b)=>b.last-a.last;
  return {gym:gyms.filter(g=>g.pts.length).sort(by), run:runs.sort(by)};
}
// Schöne Achsenwerte (1, 2, 2,5, 5 × 10^n)
function niceTicks(lo,hi,count){
  const span=hi-lo||Math.abs(hi)||1, raw=span/count, mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(x=>x>=raw)||10*mag;
  const a=Math.floor(lo/step)*step, b=Math.ceil(hi/step)*step, out=[]; for(let v=a; v<=b+step/2; v+=step) out.push(+v.toFixed(6));
  return out;
}
function chartSVG(g,W,sel){
  const H=170, L=58, R=14, T=12, B=26, pts=g.pts;
  let lo=Math.min(...pts.map(p=>p.v)), hi=Math.max(...pts.map(p=>p.v));
  if(g.invert){ lo=Math.floor((lo-5)/15)*15; hi=Math.ceil((hi+5)/15)*15; } // Tempo: 15-s-Schritte
  let ticks=g.invert?(()=>{ const st=Math.max(15,Math.ceil((hi-lo)/3/15)*15), o=[]; for(let v=lo; v<=hi+1; v+=st) o.push(v); return o; })()
    :niceTicks(lo===hi?Math.max(0,lo-1):lo,lo===hi?hi+1:hi,3);
  const y0=ticks[0], y1=ticks[ticks.length-1]||y0+1;
  const d0=pts[0].day, d1=pts[pts.length-1].day;
  const X=d=>d1===d0?L+(W-L-R)/2:L+(d-d0)/(d1-d0)*(W-L-R);
  const Y=v=>{ const t=(v-y0)/((y1-y0)||1); return g.invert?T+t*(H-T-B):H-B-t*(H-T-B); };
  const grid=ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="pggrid"/><text x="${L-8}" y="${Y(v)+4}" class="pgax" text-anchor="end">${g.invert?fmtDur(v):numTxt(v)}</text>`).join('');
  const line=pts.length>1?`<polyline class="pgline" points="${pts.map(p=>X(p.day)+','+Y(p.v)).join(' ')}"/>`:'';
  const dots=pts.map((p,i)=>`<circle class="pgdot${i===sel?' sel':''}" cx="${X(p.day)}" cy="${Y(p.v)}" r="${i===sel?6:4}"/>`).join('');
  const hits=pts.map((p,i)=>`<circle class="pghit" data-i="${i}" cx="${X(p.day)}" cy="${Y(p.v)}" r="16"><title>${wd(p.day)} ${dtxt(p.day)}: ${esc(g.tip(p))}</title></circle>`).join('');
  const xl=`<text x="${X(d0)}" y="${H-6}" class="pgax" text-anchor="${pts.length>1?'start':'middle'}">${dtxt(d0)}</text>`+(pts.length>1?`<text x="${X(d1)}" y="${H-6}" class="pgax" text-anchor="end">${dtxt(d1)}</text>`:'');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.name)}: ${esc(g.caption)}">${grid}${xl}${line}${dots}${hits}</svg>`;
}
let pgTab=null, pgData=null; const pgSel={};
function renderProgress(){
  pgData=progressData(); const tabs=[['gym','Krafttraining'],['run','Laufen']].filter(([k])=>pgData[k].length);
  if(!tabs.some(([k])=>k===pgTab)) pgTab=tabs.length?tabs[0][0]:null;
  $('pg-tabs').hidden=tabs.length<2;
  $('pg-tabs').innerHTML=tabs.map(([k,l])=>`<button type="button" data-pg="${k}" aria-pressed="${k===pgTab}">${l}</button>`).join('');
  if(!pgTab){ $('pg-list').innerHTML='<p class="qnone">Noch keine Einträge. Sobald du ein Workout oder einen Lauf einträgst, siehst du hier deinen Verlauf.</p>'; return; }
  const W=Math.max(260,Math.min(580,$('pg-list').clientWidth-26));
  $('pg-list').innerHTML=pgData[pgTab].map((g,gi)=>{
    const key=pgTab+gi, n=g.pts.length, sel=Math.min(pgSel[key]??n-1,n-1), p=g.pts[sel], first=g.pts[0], last=g.pts[n-1];
    let delta='';
    if(n>1){ const d=last.v-first.v;
      if(g.invert){ const s=Math.round(-d); delta=s===0?'gleiches Tempo wie am Anfang':`${fmtDur(Math.abs(s)).replace(/^0:/,'')}${Math.abs(s)<60?' s':' min'}/km ${s>0?'schneller':'langsamer'} als am ${dtxt(first.day)}`; }
      else delta=d===0?`gleich wie am ${dtxt(first.day)}`:`${d>0?'+':'−'}${g.unit==='kg'?numTxt(+Math.abs(d).toFixed(1))+' kg':Math.abs(d)+' Wdh.'} seit ${dtxt(first.day)}`; }
    return `<section class="pgcard" data-g="${gi}">
      <div class="pgtop"><div><div class="pgname">${esc(g.name)}</div><div class="pgcap">${g.caption}</div></div>
        <div class="pgnow"><div class="pgval">${g.fmt(last.v)}</div>${delta?`<div class="pgdelta">${delta}</div>`:''}</div></div>
      <div class="pgread">${wd(p.day)} ${dtxt(p.day)}: ${esc(g.tip(p))}</div>
      <div class="pgchart">${chartSVG(g,W,sel)}</div>
      ${n===1?'<div class="pgcap">Ab dem nächsten Eintrag siehst du hier eine Linie.</div>':''}
    </section>`; }).join('');
}
$('progbtn').onclick=()=>{ $('ov-progress').hidden=false; renderProgress(); setTimeout(()=>$('pg-close').focus({preventScroll:true}),0); };
$('pg-close').onclick=()=>{ $('ov-progress').hidden=true; $('progbtn').focus(); };
$('pg-tabs').addEventListener('click',ev=>{ const b=ev.target.closest('[data-pg]'); if(!b) return; pgTab=b.dataset.pg; renderProgress(); $('ov-progress').querySelector('.dialog').scrollTop=0; });
// Punkt antippen oder mit der Maus darüberfahren = Wert oben anzeigen
const pgPick=ev=>{ const h=ev.target.closest('.pghit'); if(!h) return; const gi=h.closest('.pgcard').dataset.g, k=pgTab+gi, i=+h.dataset.i;
  if(pgSel[k]===i&&ev.type!=='click') return; pgSel[k]=i; const g=pgData[pgTab][gi], p=g.pts[i], card=h.closest('.pgcard');
  card.querySelector('.pgread').textContent=`${wd(p.day)} ${dtxt(p.day)}: ${g.tip(p)}`;
  card.querySelectorAll('.pgdot').forEach((c,j)=>{ c.classList.toggle('sel',j===i); c.setAttribute('r',j===i?6:4); }); };
$('pg-list').addEventListener('click',pgPick); $('pg-list').addEventListener('pointerover',pgPick);
window.addEventListener('resize',()=>{ if(!$('ov-progress').hidden) renderProgress(); });
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
    $('filters').innerHTML=[1,2,3].map(t=>{
    const cats=state.cats.filter(c=>c.tier===t);
    const on=cats.length===0||cats.some(c=>!state.hidden[c.id]);
    const chips=cats.length?cats.map(c=>{
      const vis=!state.hidden[c.id];
      return `<span class="chip ${kc(c)}" data-on="${vis}">
        <button type="button" class="ctog" data-cattog="${c.id}" aria-pressed="${vis}" title="Tippen: ${vis?'ausblenden':'einblenden'} · lange drücken: nur ${esc(c.name)}"><span class="dot"></span>${esc(c.name)}</button></span>`;}).join('')
      :'<span class="empty">Noch keine Kategorie in dieser Stufe.</span>';
    const sel=tierSel(), solo=!!sel&&sel.includes(t);
    const click=cats.length?` data-tiersolo="${t}" role="button" tabindex="0" aria-pressed="${solo}" title="${solo?'Diese Stufe abwählen':sel&&sel.length===1?'Diese Stufe dazunehmen':'Nur diese Stufe zeigen'}"`:'';
    return `<div class="tgroup c-slate f${t}${cats.length?' clickable':''}" data-on="${on}"${click}>
      <div class="thead"><span class="ttog"><span><span class="nm">Stufe ${t} · ${TIERS[t].name}</span><span class="rule">${TIERS[t].rule}</span></span></span></div>
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
    else if(tierSel()) txt='Nur '+tierSel().map(t=>`<b>Stufe ${t} · ${TIERS[t].name}</b>`).join(' und ');
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

function shownDays(){ return dayWin()?win3():SPAN()==='m'?monthDays():weekDays(); }
function renderGrid(plan){
  if(SPAN()==='m') return renderMonth(plan);
  $('grid').classList.remove('month');
  const H=(END-START)*PX, daily=mode==='daily', days=shownDays();
  const g=$('grid'); g.style.gridTemplateColumns=`52px repeat(${days.length},minmax(0,1fr))`; g.style.minWidth=days.length===7&&narrow.matches?'760px':'0'; document.body.classList.toggle('scroll7',days.length===7&&narrow.matches);
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
      if(!daily && p.moved && e.day===d) ghosts+=`<div class="ghost ${kc(c)}" style="top:${(e.start-START)*PX}px;height:${e.dur*PX}px">${fmt(e.start)} urspr.</div>`;
    });
    lanes(items);
    const evs=items.map(it=>{
      const {e,p,c}=it, w=100/it.cols;
      const pos=`top:${(p.start-START)*PX}px;height:${Math.max(e.dur*PX,22)}px;left:calc(${w*it.lane}% + 3px);width:calc(${w}% - 6px)`;
      const label=`${esc(e.title)}, ${wdl(p.day)} ${fmt(p.start)} bis ${fmt(p.start+e.dur)}, ${esc(c.name)}`;
      const where=e.loc?placeName(e.loc):'', short=e.dur<45;
      const lock=p.locked&&p.locked!=='past'&&c.tier!==1?LOCK_SVG:'';
      const firstLine=e.note?e.note.split('\n')[0]:'';
      const inner=short
        ?`<span class="one"><span class="t">${isDone(e)?'<span class="ck" aria-label="erledigt">✓</span>':''}${esc(e.title)}${e.series?'<span class="rp" title="Wiederkehrend">↻</span>':''}</span><span class="h">${lock}${fmt(p.start)}</span></span>`
        :`<span class="t">${isDone(e)?'<span class="ck" aria-label="erledigt">✓</span>':''}${esc(e.title)}${e.series?'<span class="rp" title="Wiederkehrend">↻</span>':''}</span><span class="h">${lock}${fmt(p.start)}–${fmt(p.start+e.dur)}${where?' · '+esc(where):''}</span>${firstLine&&e.dur>=45?`<span class="nt">${esc(firstLine)}</span>`:''}`;
      const cls=`${p.moved?' prop':''}${p.locked==='past'?' past':''}${e.dur<=75?' compact':''}${isDone(e)?' done':''}`;
      const tr=TRAVEL[e.id]; let trv='';
      if(tr&&tr.min>0){
        const top=Math.max(0,tr.leave-START), h=(p.start-START-top)*PX;
        const txt=h>=11?`${tr.est?'ca. ':''}${tr.min} min ab ${esc(placeName(tr.from))}`:'';
        trv=`<div class="travel ${kc(c)}${tr.tight?' tight':''}" style="top:${top*PX}px;height:${h}px;left:calc(${w*it.lane}% + 3px);width:calc(${w}% - 12px)" title="${tr.min} min Weg ab ${esc(placeName(tr.from))}">${txt}</div>`;
      }
      const tag=p.moved?'<span class="pl">Vorschlag</span>':'';
      if(!daily&&p.moved) return `<button type="button" class="slotprop ${kc(c)}" data-accept="${e.id}" style="${pos}" title="Vorschlag übernehmen"><b>Vorschlag</b>${esc(e.title)}</button>`;
      if(daily) return `${trv}<button type="button" class="ev ${kc(c)} s${c.tier}${cls}" data-view="${e.id}" style="${pos}" aria-label="${label}${p.moved?', Vorschlag':''}, Details ansehen">${inner}${tag}</button>`;
      return `${trv}<button type="button" class="ev ${kc(c)} s${c.tier}${cls}${flashIds.has(e.id)?' flash':''}" data-id="${e.id}" style="${pos}" aria-label="${label}, Stufe ${c.tier}${p.moved?', Vorschlag':''}">
        ${inner}${tag}</button>`;
    }).join('');
    const nowl=(d===TODAY&&NOW.min>=START&&NOW.min<=END)?`<div class="nowline" style="top:${(NOW.min-START)*PX}px"></div>`:'';
    html+=`<div class="col${d===TODAY?' today':''}" data-day="${d}" style="height:${H}px">${ghosts}${evs}${nowl}</div>`;
  });
  g.innerHTML=html;
}

// Monatsansicht: pro Tag bis zu 3 Termine als kleine Balken (Farbe = Kategorie, Füllung = Stufe), Tag antippen = Tagesansicht
function renderMonth(plan){
  const days=monthDays(), g=$('grid'), max=narrow.matches?3:4;
  document.body.classList.remove('scroll7');
  g.classList.add('month'); g.style.gridTemplateColumns='repeat(7,minmax(0,1fr))'; g.style.minWidth='0';
  let html=[0,1,2,3,4,5,6].map(i=>`<div class="mh">${DAYS[i]}</div>`).join('');
  days.forEach(d=>{
    const x=dateOf(d), inM=x.getMonth()===MON.m;
    const items=EV.filter(e=>visible(e)&&plan[e.id]&&!plan[e.id].unplaced&&plan[e.id].day===d).sort((a,b)=>plan[a.id].start-plan[b.id].start);
    const pills=items.slice(0,max).map(e=>{const c=catOf(e), p=plan[e.id];
      return `<span class="mev ${kc(c)}${p.locked==='past'?' past':''}${isDone(e)?' done':''}"><span class="mt">${narrow.matches?'':fmt(p.start)+' '}</span>${esc(e.title)}</span>`;}).join('');
    const more=items.length>max?`<span class="mmore">+${items.length-max} weitere</span>`:'';
    html+=`<button type="button" class="mcell${inM?'':' out'}${d===TODAY?' today':''}" data-mday="${d}" aria-label="${wdl(d)}, ${dtxt(d)}: ${items.length} Termin${items.length===1?'':'e'} – Tag öffnen"><span class="mnum">${x.getDate()}</span>${pills}${more}</button>`;
  });
  g.innerHTML=html;
}
$('grid').addEventListener('click',ev=>{const c=ev.target.closest('.mcell[data-mday]'); if(!c) return; setSpan(1,+c.dataset.mday);});

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
  const card=(x,lbl,tm,cls,go)=>{const c=catOf(x.e); return `<div class="nx ${cls} ${kc(c)}"><span class="lbl">${lbl}</span><span class="tt"><span class="dot"></span>${esc(x.e.title)}</span><span class="tm">${tm}${x.e.loc?' · '+esc(placeName(x.e.loc)):''}</span>${go||''}${x.e.note?`<span class="note">${esc(x.e.note.split('\n')[0])}</span>`:''}</div>`;};
  const goLine=x=>{const tr=TRAVEL[x.e.id]; if(!tr||!tr.min) return ''; return `<span class="go">Los um ${fmt(tr.leave)} ab ${esc(placeName(tr.from))} (${tr.est?'ca. ':''}${tr.min} min)</span>`;};
  let html=cur.map(x=>card(x,'Jetzt',`bis ${fmt((x.a+x.e.dur)%1440)}`,'now')).join('');
  html+=up.map((x,i)=>card(x,i===0?'Als Nächstes':'Danach',relTime(x.a),'',goLine(x))).join('');
  if(!cur.length&&!up.length) html=`<div class="nx"><span class="lbl">Als Nächstes</span><span class="tt">${SPAN()===1?'Heute steht nichts mehr an.':SPAN()===3?'In den nächsten Tagen steht nichts mehr an.':SPAN()==='m'?'Diesen Monat steht nichts mehr an.':'Diese Woche steht nichts mehr an.'}</span></div>`;
  if(PROPS) html+=`<div class="pbanner">${PROPS} Vorschl${PROPS>1?'äge warten':'ag wartet'} auf deine Bestätigung. <button type="button" data-mode="plan">Im Planen-Modus prüfen</button></div>`;
  $('next').innerHTML=html;
  $('next').hidden=!shownDays().includes(TODAY); // Jetzt/Als Nächstes gilt nur, wenn heute zu sehen ist
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
  $('minis').innerHTML=cats.length>1?cats.map(c=>`<button type="button" class="mini ${kc(c)}" data-mini="${c.id}" aria-pressed="${!state.hidden[c.id]}"><span class="dot"></span>${esc(c.name)}</button>`).join(''):'';
}

function renderLog(plan){
  const rows=[], props=[];
  EV.forEach(e=>{const p=plan[e.id]; if(!p||!p.conflict) return; const c=catOf(e);
    rows.push({o:e.day*1440+e.start,h:`<li class="${kc(c)}"><span class="dot"></span><div><div class="what">${LOCK_SVG}${esc(e.title)}</div><div class="from bad">${wd(e.day)} ${fmt(e.start)}: überschneidet sich mit ${esc(p.conflict.title)}</div><div class="why">Der Termin ist festgeschrieben und wird nicht mehr verschoben. Ändere ihn selbst, falls nötig.</div></div></li>`});});
  EV.filter(e=>tierOf(e)===1&&inSleep(e.day,e.start,e.dur)).forEach(e=>{
    const c=catOf(e);
    rows.push({o:e.day*1440+e.start,h:`<li class="${kc(c)}"><span class="dot"></span><div><div class="what">${esc(e.title)}</div><div class="from bad">${wd(e.day)} ${fmt(e.start)}: liegt in deiner Schlafenszeit</div><div class="why">Fix-Termine werden nicht verschoben. Passe Termin oder Schlafzeit an.</div></div></li>`});
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
    const head=`<span class="grip">⠿ ZIEHEN</span><span class="t">${isDone(e)?'<span class="ck" aria-label="erledigt">✓</span>':''}${esc(e.title)}</span><span class="h">${durTxt} · war ${wd(e.day)} ${fmt(e.start)}</span>`;
    if(p.unplaced) props.push({o:e.day*1440+e.start,h:`<div class="tchip ${kc(c)} s${c.tier}" data-drag="${e.id}" aria-label="${esc(e.title)} neu einplanen">${head}<span class="bad">Kein freier Platz mehr. Zieh ihn selbst in den Kalender oder kürze die Dauer.</span></div>`});
    else props.push({o:p.day*1440+p.start,h:`<div class="tchip ${kc(c)} s${c.tier}" data-drag="${e.id}" aria-label="${esc(e.title)} neu einplanen">${head}<span class="why">${why}</span><button type="button" data-accept="${e.id}">Vorschlag: ${wd(p.day)} ${fmt(p.start)}</button></div>`});
  });
  EV.forEach(e=>{
    const tr=TRAVEL[e.id], p=plan[e.id]; if(!tr||!tr.tight||!p||p.unplaced) return;
    const c=catOf(e);
    const have=tr.gap!=null?`du hast ${Math.max(0,tr.gap)} min Zeit`:`du müsstest um ${fmt(tr.leave)} los, stehst aber erst um ${fmt(wakeOf(p.day))} auf`;
    rows.push({o:p.day*1440+p.start,h:`<li class="${kc(c)}"><span class="dot"></span><div><div class="what">${esc(e.title)}</div><div class="from bad">${wd(p.day)} ${fmt(p.start)}: Weg wird knapp</div><div class="why">Ab ${esc(placeName(tr.from))} brauchst du ${tr.est?'ca. ':''}${tr.min} min, ${have}.</div></div></li>`});
  });
  rows.sort((a,b)=>a.o-b.o); props.sort((a,b)=>a.o-b.o);
  $('log').innerHTML=rows.map(r=>r.h).join('');
  $('logpanel').hidden=!rows.length; $('logcount').textContent=rows.length;
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
  $('wtoday').hidden=VIEW===CURWEEK; $('wtoday').textContent='Zur aktuellen Woche';
  if(SPAN()===3){
    const x=dateOf(DAY0), y=dateOf(DAY0+2), kx=isoWeek(x), ky=isoWeek(y);
    $('weeklabel').textContent=`KW ${kx}${ky!==kx?'/'+ky:''} · ${wd(DAY0)} ${x.getDate()}.${x.getMonth()!==y.getMonth()?' '+MONTHS[x.getMonth()].slice(0,3)+'.':''} – ${wd(DAY0+2)} ${y.getDate()}. ${MONTHS[y.getMonth()].slice(0,3)}.`;
    $('wtoday').hidden=DAY0===TODAY; $('wtoday').textContent='Heute';
  } else if(SPAN()===1){
    const x=dateOf(DAY0);
    $('weeklabel').textContent=`${wdl(DAY0)}, ${x.getDate()}. ${MONTHS[x.getMonth()]}${DAY0===TODAY?' · heute':''}`;
    $('wtoday').hidden=DAY0===TODAY; $('wtoday').textContent='Heute';
  } else if(SPAN()==='m'){
    $('weeklabel').textContent=`${MONTHS[MON.m]} ${MON.y}`;
    const t=dateOf(TODAY); $('wtoday').hidden=t.getFullYear()===MON.y&&t.getMonth()===MON.m; $('wtoday').textContent='Aktueller Monat';
  }
  document.querySelectorAll('#spansw [data-span]').forEach(b=>b.setAttribute('aria-pressed',String(String(SPAN())===b.dataset.span)));
  const nm=SPAN()===1?'Tag':SPAN()===3?'3 Tage':SPAN()==='m'?'Monat':'Woche';
  $('wprev').setAttribute('aria-label','Zurück ('+nm+')'); $('wnext').setAttribute('aria-label','Weiter ('+nm+')');
}
function shiftMonth(n){ MON=(()=>{const d=new Date(MON.y,MON.m+n,1); return {y:d.getFullYear(),m:d.getMonth()};})(); prevPlan=null; render(); }
function step(n){ const s=SPAN(); if(s==='m') shiftMonth(n); else if(s===7) goWeek(VIEW+n); else shiftDays(n*s); }
// Ansicht wechseln: aktuellen Bezugstag mitnehmen
function setSpan(v,at){
  const from=SPAN(), ref=at!=null?at:from==='m'?(dateOf(TODAY).getMonth()===MON.m&&dateOf(TODAY).getFullYear()===MON.y?TODAY:dayOfDate(new Date(MON.y,MON.m,1)))
    :from===7?(VIEW===CURWEEK?TODAY:VIEW*7):DAY0;
  spanPref[spanKey()]=v; try{localStorage.setItem('stufenkalender-span',JSON.stringify(spanPref));}catch(e){}
  if(v==='m') setMonthOf(ref); else if(v===7) VIEW=Math.floor(ref/7); else DAY0=ref;
  prevPlan=null; render(); window.scrollTo({top:Math.min(window.scrollY,($('grid').getBoundingClientRect().top+window.scrollY)-80)});
}
$('spansw').addEventListener('click',ev=>{const b=ev.target.closest('[data-span]'); if(!b) return; setSpan(b.dataset.span==='m'?'m':+b.dataset.span);});
function shiftDays(n){DAY0+=n; prevPlan=null; render();}
function goWeek(w){VIEW=w; prevPlan=null; render();}
// Sorgt dafür, dass Tag d zu sehen ist (Woche bzw. 3-Tage-Fenster am Handy)
function showDay(d){ if(dayWin()){ if(!win3().includes(d)) DAY0=d; } else if(SPAN()==='m'){ if(!monthDays().includes(d)) setMonthOf(d); } else if(Math.floor(d/7)!==VIEW) VIEW=Math.floor(d/7); }
$('wprev').onclick=()=>step(-1);
$('wnext').onclick=()=>step(1);
$('wtoday').onclick=()=>{const s=SPAN(); if(s==='m'){setMonthOf(TODAY); prevPlan=null; render();} else if(s===7) goWeek(CURWEEK); else {DAY0=TODAY; prevPlan=null; render();}};
// Plan einer ganzen Woche (der Planer arbeitet immer wochenweise)
function planWeek(w){
  const keepV=VIEW, keepE=EV; VIEW=w;
  const ev=buildEV(), pl=schedule(ev,state.buffer); EV=ev; const tr=computeTravel(pl);
  VIEW=keepV; EV=keepE; return {ev,pl,tr};
}
function render(){
  const wakes=[0,1,2,3,4,5,6].map(wakeOf);
  if(dayWin()) VIEW=Math.floor(DAY0/7);
  const weeks=SPAN()===7?[VIEW]:[...new Set(shownDays().map(d=>Math.floor(d/7)))];
  const plan={}; EV=[]; TRAVEL={};
  weeks.forEach(w=>{const r=planWeek(w); EV.push(...r.ev); Object.assign(plan,r.pl); Object.assign(TRAVEL,r.tr);});
  START=Math.min(6*60,Math.floor(Math.min(...wakes,...EV.map(e=>e.start))/60)*60);
  PLAN=plan;
  renderWeek();
  flashIds=new Set();
  if(prevPlan) Object.keys(plan).forEach(id=>{const a=plan[id],b=prevPlan[id]; if(b&&!a.unplaced&&!b.unplaced&&(a.day!==b.day||a.start!==b.start)) flashIds.add(id);});
  prevPlan=plan;
  renderFilters(); renderGrid(plan); renderLog(plan); renderNext(plan); renderSeg(); renderHabits(); renderTodos(); renderQuick(); stickHead(); save(); trackUndo();
}

/* ---------- Filter-Interaktion ---------- */
function setOnly(ids){state.cats.forEach(c=>{if(ids.includes(c.id)) delete state.hidden[c.id]; else state.hidden[c.id]=true;});}
// Gewählte Stufen-Kästen: null = keine Auswahl (alles zu sehen oder gemischt per Kategorie-Knopf),
// sonst die Stufen, deren Kategorien alle sichtbar sind, während alle anderen ganz ausgeblendet sind.
function tierSel(){
  const tiers=[1,2,3].filter(t=>state.cats.some(c=>c.tier===t)), on=[];
  for(const t of tiers){const cs=state.cats.filter(c=>c.tier===t), n=cs.filter(c=>!state.hidden[c.id]).length;
    if(n===cs.length) on.push(t); else if(n) return null;}
  return on.length&&on.length<tiers.length?on:null;
}
function clickTier(t){
  const sel=tierSel(); let next;
  if(!sel) next=[t];                                   // erster Klick: nur diese Stufe
  else if(sel.includes(t)) next=sel.filter(x=>x!==t);  // gewählte Stufe nochmal: abwählen
  else if(sel.length===1) next=[...sel,t];             // zweite Stufe dazu
  else next=[t];                                       // dritte Stufe: nur noch diese
  if(!next.length){state.hidden={};return;}
  setOnly(state.cats.filter(c=>next.includes(c.tier)).map(c=>c.id));
}
function isOnly(ids){return state.cats.every(c=>!!state.hidden[c.id]===!ids.includes(c.id));}
// Kategorie-Knopf lange drücken (oder Rechtsklick) = nur diese Kategorie, nochmal = alle
let longPressAt=0, lpT=null;
function soloCat(id){isOnly([id])?(state.hidden={}):setOnly([id]); render();
  const c=state.cats.find(x=>x.id===id); toast(isOnly([id])?`Nur noch ${c?c.name:'diese Kategorie'} zu sehen.`:'Wieder alles zu sehen.');}
$('filters').addEventListener('pointerdown',ev=>{
  const b=ev.target.closest('[data-cattog]'); clearTimeout(lpT); if(!b||ev.button>0) return;
  lpT=setTimeout(()=>{longPressAt=Date.now(); if(navigator.vibrate) navigator.vibrate(15); soloCat(b.dataset.cattog);},500);
});
['pointerup','pointercancel','pointerleave'].forEach(t=>$('filters').addEventListener(t,()=>clearTimeout(lpT)));
// Rechtsklick am Computer; auf manchen Handys feuert langes Drücken zusätzlich „contextmenu“ – dann nicht doppelt
$('filters').addEventListener('contextmenu',ev=>{const b=ev.target.closest('[data-cattog]'); if(!b) return; ev.preventDefault(); clearTimeout(lpT);
  if(Date.now()-longPressAt<800) return; longPressAt=Date.now(); soloCat(b.dataset.cattog);});

// Am Handy im Planen-Modus scrollt die Woche seitlich. Dort klebt die Tageszeile nicht von selbst
// am oberen Rand, deshalb wird sie beim Scrollen der Seite mitgeschoben.
function stickHead(){
  const cal=document.querySelector('.cal'), g=$('grid'); if(!cal||!g) return;
  if(!(narrow.matches&&SPAN()===7)){ g.style.removeProperty('--dhs'); return; }
  const r=cal.getBoundingClientRect(), h=(g.querySelector('.dh')||{offsetHeight:0}).offsetHeight;
  g.style.setProperty('--dhs', Math.max(0,Math.min(-r.top, r.height-h-40))+'px');
}
addEventListener('scroll',stickHead,{passive:true}); addEventListener('resize',stickHead);

/* Wischen im Kalender (Touch): Wochen blättern. Lässt sich die Woche seitlich scrollen,
   wird erst am Rand umgeblättert. */
(()=>{
  const cal=document.querySelector('.cal'); if(!cal) return; let sw=null;
  cal.addEventListener('touchstart',ev=>{
    if(ev.touches.length!==1||ev.target.closest('.ev,.tchip')){sw=null; return;}
    const t=ev.touches[0]; sw={x:t.clientX,y:t.clientY,t:Date.now(),sl:cal.scrollLeft};
  },{passive:true});
  cal.addEventListener('touchend',ev=>{
    if(!sw||(drag&&drag.started)){sw=null; return;}
    const t=ev.changedTouches[0], dx=t.clientX-sw.x, dy=t.clientY-sw.y, ms=Date.now()-sw.t; const s0=sw; sw=null;
    if(Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*0.6||ms>700) return;
    const max=cal.scrollWidth-cal.clientWidth;
    if(SPAN()!==7){ step(dx<0?1:-1); toast($('weeklabel').textContent); return; }
    if(dx<0){ if(max>2&&s0.sl<max-2) return; goWeek(VIEW+1); }
    else { if(max>2&&s0.sl>2) return; goWeek(VIEW-1); const m=cal.scrollWidth-cal.clientWidth; if(m>2) cal.scrollLeft=m; }
    toast($('weeklabel').textContent);
  },{passive:true});
})();

// Stufen-Kasten per Tastatur (Enter/Leertaste) wie ein Knopf
$('filters').addEventListener('keydown',ev=>{
  const g=ev.target.closest&&ev.target.closest('.tgroup[data-tiersolo]');
  if(!g||ev.target!==g||(ev.key!=='Enter'&&ev.key!==' ')) return;
  ev.preventDefault(); g.click(); setTimeout(()=>{const n=document.querySelector(`.tgroup[data-tiersolo="${g.dataset.tiersolo}"]`); if(n) n.focus();},0);
});
document.addEventListener('click',ev=>{
  let b;
  if(ev.target.closest('[data-cattog]')&&Date.now()-longPressAt<700) return; // Klick nach langem Drücken ignorieren
  if(b=ev.target.closest('[data-cattog]')){const id=b.dataset.cattog; if(state.hidden[id]) delete state.hidden[id]; else state.hidden[id]=true; render(); return;}
  if(b=ev.target.closest('[data-catsolo]')){const ids=[b.dataset.catsolo]; isOnly(ids)?(state.hidden={}):setOnly(ids); render(); return;}
  if(b=ev.target.closest('[data-tiersolo]')){clickTier(+b.dataset.tiersolo); render(); return;}
  if(b=ev.target.closest('[data-mode]')){setMode(b.dataset.mode); return;}
  if(b=ev.target.closest('[data-seg]')){const t=+b.dataset.seg; if(t===0) state.hidden={}; else setOnly(state.cats.filter(c=>c.tier===t).map(c=>c.id)); render(); return;}
  if(b=ev.target.closest('[data-mini]')){const id=b.dataset.mini, c=state.cats.find(x=>x.id===id);
    if(isOnly([id])) setOnly(state.cats.filter(x=>x.tier===c.tier).map(x=>x.id)); else setOnly([id]); render(); return;}
  if(b=ev.target.closest('[data-habitcat]')){toggleHabitToday(b.dataset.habitcat); return;}
  if(!justDragged&&(b=ev.target.closest('[data-todosug]'))){scheduleTodo(b.dataset.todosug,+b.dataset.day,+b.dataset.start); return;}
  if(b=ev.target.closest('[data-tododone]')){doneTodo(b.dataset.tododone); return;}
  if(!justDragged&&(b=ev.target.closest('[data-todoedit]'))){openTodo(b.dataset.todoedit); return;}
  if(justDragged) return;
  if(b=ev.target.closest('[data-accept]')){accept([b.dataset.accept]); return;}
  if(justDragged) return;
  if(b=ev.target.closest('[data-view]')){openDetail(b.dataset.view); return;}
  if(mode==='plan'&&(b=ev.target.closest('.ev'))){openForm(b.dataset.id);}
  if(mode==='plan'&&(b=ev.target.closest('.col[data-day]'))&&!ev.target.closest('.ev,.slotprop,.travel')){
    const r=b.getBoundingClientRect(), min=START+(ev.clientY-r.top)/PX;
    const start=Math.max(0,Math.min(END-STEP,Math.floor(min/STEP)*STEP));
    openForm(null,{day:+b.dataset.day,start});
  }
});
$('showall').onclick=()=>{state.hidden={}; render();};
$('buf').addEventListener('change',()=>{state.buffer=+$('buf').value; render();});
$('lockm').addEventListener('change',()=>{state.lockMode=$('lockm').value; render();});
$('add').onclick=()=>openForm(null);
$('todoadd').onclick=()=>openTodo(null);
$('t-cat').addEventListener('change',syncTodoCat);
$('t-cancel').onclick=()=>{$('ov-todo').hidden=true;};
$('t-del').onclick=()=>{const i=state.todos.findIndex(x=>x.id===editTodo); if(i<0) return; const t=state.todos.splice(i,1)[0]; $('ov-todo').hidden=true; render(); toast(`To-do „${t.title}“ gelöscht.`);};
$('tform').addEventListener('submit',ev=>{
  ev.preventDefault();
  const fail=m=>{$('t-err').textContent=m; $('t-err').hidden=false;};
  const title=$('t-title').value.trim(); if(!title) return fail('Schreib kurz, was zu tun ist.');
  const cat=$('t-cat').value, dur=+$('t-dur').value, due=$('t-due').value?fromIso($('t-due').value):null;
  if(due!=null&&due<TODAY&&!editTodo) return fail('Das Datum liegt in der Vergangenheit.');
  if(editTodo){const t=state.todos.find(x=>x.id===editTodo); Object.assign(t,{title,cat,dur,due});}
  else state.todos.push({id:'t'+(state.nextId++),title,cat,dur,due});
  delete state.hidden[cat];
  $('ov-todo').hidden=true; render();
});
$('setbtn').onclick=()=>{syncTrackers(); $('ov-settings').hidden=false; setTimeout(()=>$('set-close').focus(),0);};
$('set-close').onclick=()=>{$('ov-settings').hidden=true; $('setbtn').focus();};
// Ein Unterpunkt öffnet sein eigenes Fenster und schließt die Einstellungen
['mgr','sleepbtn','placebtn','impbtn'].forEach(id=>$(id).addEventListener('click',()=>{$('ov-settings').hidden=true;},true));


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
  // Neuer Termin: Kategorie bleibt leer, bis man eine wählt
  $('f-cat').innerHTML='<option value="" hidden></option>'+[1,2,3].map(t=>{const cs=state.cats.filter(c=>c.tier===t); if(!cs.length) return '';
    return `<optgroup label="Stufe ${t} · ${TIERS[t].name}">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;}).join('');
  $('f-cat').value=sel||'';
}
function syncCat(){const c=state.cats.find(x=>x.id===$('f-cat').value); if(!c){ $('f-catinfo').textContent=''; $('f-lockrow').hidden=false; $('f-habit').checked=false; return; } $('f-lockrow').hidden=c.tier===1;
  $('f-catinfo').textContent=`Stufe ${c.tier} · ${TIERS[c.tier].name}: ${TIERS[c.tier].rule}`;
  $('f-habit').checked=!!c.habit; }
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
function openForm(iid,preset){
  if(!state.cats.length){openMgr(); return;}
  const inst=iid?EV.find(i=>i.id===iid):null; const e=inst?state.events.find(x=>x.id===inst.sid):null;
  editing=e?e.id:null; editingInst=inst;
  $('f-head').textContent=e?(e.rec?'Serie bearbeiten':'Termin bearbeiten'):'Neuer Termin';
  $('f-title').value=e?e.title:'';
  fillCatSelect(e?e.cat:'');
  const defDay=preset?preset.day:shownDays().includes(TODAY)?TODAY:dayWin()?DAY0:SPAN()==='m'?dayOfDate(new Date(MON.y,MON.m,1)):VIEW*7;
  $('f-day').value=isoDate(e?e.day:defDay); $('f-time').value=fmt(e?e.start:preset?preset.start:1080);
  $('f-rec').checked=!!(e&&e.rec); $('f-freq').value=e&&e.rec?e.rec.freq:'weekly';
  $('f-until').value=e&&e.rec&&e.rec.until!=null?isoDate(e.rec.until):'';
  recDays=e&&e.rec&&e.rec.days?e.rec.days.slice():[wdi(e?e.day:defDay)]; syncRec();
  setDur(e?e.dur:60);
  fillLocSelect(e?e.loc:''); $('f-newname').value=''; $('f-newmin').value=20; $('f-locked').checked=!!(e&&e.locked); $('f-note').value=e&&e.note?e.note:'';
  $('f-ex').value=e&&e.exercises?e.exercises.join('\n'):''; $('f-track').value=e&&e.track?e.track:''; syncTrack();
  $('f-del').hidden=!e; $('f-del').textContent=e&&e.rec?'Ganze Serie löschen':'Löschen';
  $('f-delone').hidden=!(e&&e.rec);
  $('f-workout').hidden=!(inst&&trackOn(inst)&&inst.day<=TODAY); $('f-workout').textContent=inst&&inst.track==='run'?'Lauf eintragen':inst&&inst.track==='sprint'?'Sprint abhaken':'Workout';
  { const show=!!inst&&inst.day<=TODAY; $('f-done').hidden=!show;
    if(show) $('f-done').textContent=isDone(inst)?'✓ Erledigt – zurücknehmen':'Als erledigt markieren'; }
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
  if(!state.cats.some(x=>x.id===$('f-cat').value)) return fail('Wähle eine Kategorie.');
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
  if(!$('f-trackrow').hidden){ const tr=$('f-track').value; data.track=tr||undefined;
    const exercises=$('f-ex').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30);
    data.exercises=(tr==='gym'||tr==='sprint')&&exercises.length?exercises:undefined; }
  if($('f-habit').checked) c.habit=true; else delete c.habit;
  if(editing){const i=state.events.findIndex(x=>x.id===editing); state.events[i]=Object.assign({},state.events[i],data,{id:editing}); if(!rec) delete state.events[i].ex;}
  else state.events.push(Object.assign({id:state.nextId++},data));
  delete state.hidden[cat];
  closeForm();
  if(!editing) showDay(day);
  render(); showNewProps(before,title);
});

/* ---------- Kategorien verwalten ---------- */
let draft=[];
function openMgr(){draft=clone(state.cats); renderMgr(); $('c-err').hidden=true; $('ov-cat').hidden=false;}
function readMgr(){
  draft.forEach(c=>{const r=document.querySelector(`.crow[data-cid="${c.id}"]`); if(!r) return;
    c.name=r.querySelector('.c-name').value; c.tier=+r.querySelector('.c-tier').value; c.habit=r.querySelector('.c-habit').checked;
    const col=r.querySelector('.cswatches input:checked'); if(col) c.color=col.value;
    });
}
function renderMgr(){
  const counts={}; state.events.forEach(e=>counts[e.cat]=(counts[e.cat]||0)+1);
  $('clist').innerHTML=draft.map(c=>`
    <div class="crow ${kc(c)}${c.del?' del':''}" data-cid="${c.id}">
      <input class="c-name" id="cn-${c.id}" value="${esc(c.name)}" placeholder="Name, z. B. Training" aria-label="Name der Kategorie" ${c.del?'disabled':''}>
      <select class="c-tier" id="ct-${c.id}" aria-label="Stufe" ${c.del?'disabled':''}>
        ${[1,2,3].map(t=>`<option value="${t}" ${c.tier===t?'selected':''}>Stufe ${t} · ${TIERS[t].name}</option>`).join('')}</select>
      <button type="button" class="iconbtn" data-cdel="${c.id}">${c.del?'Wiederherstellen':'Löschen'}</button>
      <label class="chabit"><input type="checkbox" class="c-habit" ${c.habit?'checked':''} ${c.del?'disabled':''}> Als Gewohnheit verfolgen</label>
      <div class="cswatches" role="radiogroup" aria-label="Farbe">${COLORS.map(k=>`<label class="sw c-${k} f1" title="${COLOR_NAMES[k]}"><input type="radio" name="col-${c.id}" value="${k}" ${c.color===k?'checked':''} ${c.del?'disabled':''} aria-label="${COLOR_NAMES[k]}"><span></span></label>`).join('')}</div>

      ${c.del&&counts[c.id]?`<div class="delnote">${counts[c.id]} Termin${counts[c.id]>1?'e werden':' wird'} beim Speichern mitgelöscht.</div>`:''}
    </div>`).join('') || '<p class="empty">Noch keine Kategorien.</p>';
}
$('clist').addEventListener('change',ev=>{if(ev.target.matches('.c-tier,.cswatches input')){readMgr(); renderMgr();}});
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
  state.cats=keep.map(c=>Object.assign({id:c.id,name:c.name.trim(),tier:c.tier,color:c.color},c.habit?{habit:true}:{}));
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
$('sleepbtn').onclick=openSleep;
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
  $('dt-title').textContent=e.title; $('dt-dot').className='dot '+kc(c);
  const rows=[['Wann',`${wdl(p.day)}, ${dtxt(p.day)} · ${fmt(p.start)}–${fmt(p.start+e.dur)}`+(p.moved?' (Vorschlag)':'')],
    ['Stufe',`${c.tier} · ${TIERS[c.tier].name} · ${c.name}`]];
  if(e.loc) rows.push(['Ort',placeName(e.loc)]);
  if(e.rec) rows.push(['Wiederholung',e.rec.freq==='daily'?'Jeden Tag':`${e.rec.freq==='weekly'?'Jede Woche':'Alle 2 Wochen'} am ${(e.rec.days||[wdi(e.day)]).map(i=>DAYS[i]).join(', ')}`+(e.rec.until!=null?` bis ${dtxt(e.rec.until)}`:'')]);
  if(tr&&tr.min) rows.push(['Los',`${fmt(tr.leave)} ab ${placeName(tr.from)} (${tr.est?'ca. ':''}${tr.min} min)`]);
  $('dt-list').innerHTML=rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('dt-note').hidden=!e.note; $('dt-note').textContent=e.note||'';
  if(c.habit){const st=habitStats(c.id); $('dt-list').insertAdjacentHTML('beforeend',`<dt>Serie</dt><dd>${esc(c.name)}: ${st.streak} am Stück · Rekord ${st.best}</dd>`);}
  const canDone=p.day<=TODAY; $('dt-done').hidden=!canDone; detailId=id;
  $('dt-workout').hidden=!(trackOn(e)&&p.day<=TODAY); $('dt-workout').textContent=e.track==='run'?'Lauf eintragen':e.track==='sprint'?'Sprint abhaken':'Workout';
  if(trackOn(e)){ const sm=trackSummary(e); if(sm) $('dt-list').insertAdjacentHTML('beforeend',`<dt>${e.track==='run'?'Lauf':e.track==='sprint'?'Sprint':'Workout'}</dt><dd>${sm}</dd>`); }
  if(canDone){const d=isDone(e); $('dt-done').textContent=d?'✓ Erledigt – zurücknehmen':'Als erledigt markieren'; $('dt-done').classList.toggle('on',d);}
  $('ov-detail').hidden=false; setTimeout(()=>$('dt-close').focus(),0);
}
$('dt-close').onclick=()=>{$('ov-detail').hidden=true;};
let detailId=null;
function syncTrack(){
  const tr=state.trackers||{}, any=tr.gym||tr.run||tr.sprint, cur=$('f-track').value;
  $('f-trackrow').hidden=!any&&!cur;
  [...$('f-track').options].forEach(o=>{ if(o.value) o.hidden=!tr[o.value]&&o.value!==cur; });
  $('f-exrow').hidden=cur!=='gym'&&cur!=='sprint';
  $('f-trackinfo').textContent=cur==='gym'?'Beim Termin kannst du dann „Workout“ antippen und für jeden Satz Wdh. und Gewicht eintragen.':cur==='run'?'Beim Termin kannst du dann „Lauf eintragen“ antippen und km und Zeit eintragen.':cur==='sprint'?'Beim Termin kannst du dann „Sprint abhaken“ antippen und die Übungen einzeln abhaken.':'';
}
$('f-track').addEventListener('change',syncTrack);
function syncTrackers(){ ['gym','run','sprint'].forEach(k=>$('tr-'+k).checked=!!state.trackers[k]); }
['gym','run','sprint'].forEach(k=>$('tr-'+k).addEventListener('change',()=>{ state.trackers=Object.assign({},state.trackers,{[k]:$('tr-'+k).checked}); render(); }));
$('dt-workout').onclick=()=>{const e=EV.find(x=>x.id===detailId); if(!e) return; $('ov-detail').hidden=true; openWorkout(e);};
$('f-workout').onclick=()=>{const inst=editingInst; if(!inst) return; closeForm(); openWorkout(inst);};
$('dt-done').onclick=()=>{const e=EV.find(x=>x.id===detailId); if(!e) return; $('ov-detail').hidden=true; toggleDone(e.sid,e.occ);};
$('f-done').onclick=()=>{const inst=editingInst; if(!inst) return; closeForm(); toggleDone(inst.sid,inst.occ);};
$('helpbtn').onclick=()=>{$('ov-help').hidden=false; setTimeout(()=>{$('help-close').focus({preventScroll:true}); $('ov-help').querySelector('.dialog').scrollTop=0;},0);};
$('help-close').onclick=()=>{$('ov-help').hidden=true; $('helpbtn').focus();};

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
  if(first!==Infinity&&!imp.some(e=>shownDays().some(d=>occursOn(e,d)))) showDay(first);
  prevPlan=null; render();
  toast(`${added} Termin${added===1?'':'e'} importiert${updated?`, ${updated} aktualisiert`:''}.`);
  showNewProps(before,'den Import');
});

/* ---------- Drag & Drop ---------- */
let drag=null, justDragged=false, toastT=null;
function toast(msg){
  const t=$('toast'), withUndo=undoFresh&&!!undoPrev;
  if(undoFresh) undoMsgShown=true;
  t.textContent=msg;
  if(withUndo){const b=document.createElement('button'); b.type='button'; b.className='undobtn'; b.textContent='Rückgängig'; b.onclick=()=>{t.hidden=true; doUndo();}; t.appendChild(b);}
  t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,withUndo?7000:3200);
}
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
  const g=document.createElement('div'); g.className=`dragghost ${kc(c)}`; g.textContent=e.title; document.body.appendChild(g); drag.ghost=g;
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
  if(e.todoId){scheduleTodo(e.todoId,tg.day,tg.start); return;}
  const before=propSnapshot();
  setInst(e.id,tg.day,tg.start); render();
  toast(`${e.title}: ${wdl(tg.day)}, ${dtxt(tg.day)} ${fmt(tg.start)}${e.series?' (nur dieser Termin der Serie)':''}`);
  showNewProps(before,e.title);
}
document.addEventListener('pointerdown',ev=>{
  if(mode!=='plan'||ev.button>0||drag) return;
  if(ev.target.closest('button[data-accept]')&&!ev.target.closest('.slotprop')) return;
  if(ev.target.closest('[data-todosug],[data-tododone]')) return;
  const el=ev.target.closest('.tchip[data-todo], .tchip[data-drag], .ev[data-id], .slotprop[data-accept]'); if(!el) return;
  let id, e;
  if(el.dataset.todo){const t=state.todos.find(x=>x.id===el.dataset.todo); if(!t) return; e=todoEv(t); id=e.id;}
  else{ id=el.dataset.drag||el.dataset.id||el.dataset.accept; e=EV.find(x=>x.id===id); if(!e) return;
    if(lockReason(e)==='past') return; }
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
document.addEventListener('keydown',ev=>{
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&ev.key.toLowerCase()==='z'&&undoPrev&&mode==='plan'&&!ev.target.closest('input,textarea,select')&&!document.querySelector('.overlay:not([hidden])')){ev.preventDefault(); doUndo();}
});

/* ---------- Modus ---------- */
function setMode(m){
  mode=m==='daily'?'daily':'plan'; if(mode==='daily'){VIEW=CURWEEK; DAY0=TODAY; setMonthOf(TODAY);}
  try{localStorage.setItem(KEY+'-mode',mode);}catch(e){}
  document.body.classList.toggle('daily',mode==='daily');
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  prevPlan=null; render();
}
narrow.addEventListener('change',()=>{ if(dayWin()) DAY0=VIEW===CURWEEK?TODAY:VIEW*7; prevPlan=null; render(); });
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
['ov-ev','ov-cat','ov-sleep','ov-place','ov-prop','ov-detail','ov-import','ov-help','ov-settings','ov-todo','ov-workout','ov-progress'].forEach(id=>$(id).addEventListener('click',ev=>{if(ev.target.id===id) $(id).hidden=true;}));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){['ov-ev','ov-cat','ov-sleep','ov-place','ov-prop','ov-detail','ov-import','ov-help','ov-settings','ov-todo','ov-workout','ov-progress'].forEach(id=>$(id).hidden=true);}});

let savedMode='plan'; try{savedMode=localStorage.getItem(KEY+'-mode')||'plan';}catch(e){}
setMode(savedMode);

return {
  // Neue Daten von einem anderen Gerät übernehmen
  replaceState(s){ state=normalize(s); snap=dataSnap(); undoPrev=null; prevPlan=null; render(); }
};
}
