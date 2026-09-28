/* Manos Fuertes — ui.js
   Camada de UI: login (teléfono/Google), dashboard, agenda (via CFMS.generateActivities),
   wizard de inscrição. Persistência LOCAL (localStorage) neste piloto — backend (Google
   Sheets) entra depois. Design aprovado v6 (login) + tons por tipo.  */
'use strict';

/* ---------- estado ---------- */
const LANG = (window.CFMS_CONFIG && window.CFMS_CONFIG.DEFAULT_LANG) || 'es';
const MESES = { es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
                pt:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'] };
const cursor = new Date(); cursor.setDate(1);
let USER = null;                 // { name, phone } ou { name, email }
let INSCR = {};                  // { activityId: roleId }  (mis inscripciones, local)
let wzState = { step:1, activity:null, role:null };

/* mapear templateId -> tipo (para el color/tono) */
function tipoDe(templateId){
  const id = (templateId||'').replace(/-.*/,'');
  if(id==='A1'||id==='B1') return 'retirada';
  if(id==='A2'||id==='A3'||id==='B2') return 'prep';
  if(id==='A4'||id==='B3') return 'distri';
  return 'limpieza'; // A5/B4
}
const ICON_TIPO = { retirada:'🚐', prep:'📦', distri:'🤝', limpieza:'🧹' };

/* ---------- persistencia local ---------- */
function loadState(){
  try{ USER = JSON.parse(localStorage.getItem('mf_user')||'null'); }catch(e){ USER=null; }
  try{ INSCR = JSON.parse(localStorage.getItem('mf_inscr')||'{}'); }catch(e){ INSCR={}; }
}
function saveUser(){ localStorage.setItem('mf_user', JSON.stringify(USER)); }
function saveInscr(){ localStorage.setItem('mf_inscr', JSON.stringify(INSCR)); }
function normPhone(v){ return (v||'').replace(/[\s\-()]/g,''); }

/* ---------- DDI ---------- */
const DDIS = [
  { c:'+55', f:'🇧🇷', n:'Brasil' }, { c:'+34', f:'🇪🇸', n:'España' },
  { c:'+351', f:'🇵🇹', n:'Portugal' }, { c:'+1', f:'🇺🇸', n:'EE. UU.' },
  { c:'+44', f:'🇬🇧', n:'Reino Unido' }, { c:'+33', f:'🇫🇷', n:'Francia' },
  { c:'+49', f:'🇩🇪', n:'Alemania' }, { c:'+39', f:'🇮🇹', n:'Italia' },
  { c:'+52', f:'🇲🇽', n:'México' }, { c:'+54', f:'🇦🇷', n:'Argentina' }
];
function fillDdi(sel){ sel.innerHTML = DDIS.map(d=>`<option value="${d.c}">${d.f} ${d.c}</option>`).join(''); sel.value='+34'; }

/* ---------- LOGIN ---------- */
/* "base" local de voluntarios registrados por teléfono: { phone: name } */
function knownUsers(){ try{ return JSON.parse(localStorage.getItem('mf_known')||'{}'); }catch(e){ return {}; } }
function rememberUser(phone,name){ const k=knownUsers(); k[phone]=name; localStorage.setItem('mf_known',JSON.stringify(k)); }

function submitPhone(){
  const ddi = document.getElementById('ddi1').value;
  const local = normPhone(document.getElementById('inPhone').value.trim());
  if(local.length < 6){ document.getElementById('inPhone').focus(); return; }
  const full = ddi + local;
  const known = knownUsers();
  if(known[full]){ USER={ name:known[full], phone:full }; enter('Entrando…'); }
  else{
    document.getElementById('panelPhone').classList.add('hidden');
    document.getElementById('ddi2').value = ddi;
    document.getElementById('regPhone').value = local;
    document.getElementById('regName').value = '';
    document.getElementById('regWelcome').innerHTML = 'Parece que es tu primera vez. <b>¡Bienvenido!</b> Solo necesitamos tu nombre.';
    document.getElementById('panelRegister').classList.remove('hidden');
    setTimeout(()=>document.getElementById('regName').focus(),200);
  }
}
function loginGoogle(){
  /* Sem backend Google ainda: simula 1ª vez pedindo teléfono+nombre (nombre viría de Google). */
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('ddi2').disabled=false; document.getElementById('ddi2').value='+34';
  document.getElementById('regPhone').value=''; document.getElementById('regPhone').removeAttribute('readonly');
  document.getElementById('regPhone').placeholder='600 000 000';
  document.getElementById('regName').value='';
  document.getElementById('regWelcome').innerHTML='Primera vez con Google. <b>¡Bienvenido!</b> Confirma tu nombre y añade tu teléfono (para los recordatorios por WhatsApp).';
  document.getElementById('panelRegister').classList.remove('hidden');
}
function submitRegister(){
  const name = document.getElementById('regName').value.trim();
  const ddi = document.getElementById('ddi2').value;
  const phone = ddi + normPhone(document.getElementById('regPhone').value.trim());
  if(!name || normPhone(phone).length < 8){ return; }
  USER={ name, phone }; rememberUser(phone,name); enter('Creando tu perfil…');
}
function backToPhone(){
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('regPhone').setAttribute('readonly','');
  document.getElementById('ddi2').disabled=true;
  document.getElementById('panelPhone').classList.remove('hidden');
}
function enter(msg){
  saveUser();
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('lgCheckTxt').textContent = msg;
  document.getElementById('lgChecking').classList.add('on');
  setTimeout(()=>{ document.getElementById('loginGate').style.display='none'; startApp(); }, 1600);
}
function logout(){ localStorage.removeItem('mf_user'); location.reload(); }
window.submitPhone=submitPhone; window.loginGoogle=loginGoogle; window.submitRegister=submitRegister; window.backToPhone=backToPhone;

/* ---------- APP ---------- */
function startApp(){
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');
  document.getElementById('hdrName').textContent = (USER && USER.name) ? USER.name.split(' ')[0] : '—';
  renderAll();
}
function currentActivities(){ return window.CFMS.generateActivities(cursor.getFullYear(), cursor.getMonth()); }

function fmtFecha(iso){ const d=new Date(iso+'T12:00:00'); return { w:d.toLocaleDateString(LANG==='pt'?'pt-BR':'es-ES',{weekday:'short'}), d:d.getDate(), m:d.toLocaleDateString(LANG==='pt'?'pt-BR':'es-ES',{month:'short'}) }; }
function ringClass(rest,cap){ if(rest<=0) return 'cheio'; if(rest<=Math.max(1,Math.floor(cap*0.3))) return 'pouco'; return ''; }
function totalCap(a){ return Object.values(a.roles).reduce((s,c)=>s+c,0); }
function totalLibres(a){ return Object.keys(a.roles).reduce((s,r)=>s+Math.max(0,window.CFMS.vagasRestantes(a,r)),0); }

function actCardHTML(a, opts={}){
  const tipo = tipoDe(a.templateId); const f = fmtFecha(a.data);
  const libres = totalLibres(a); const cap = totalCap(a);
  const mine = INSCR[a.id];
  const ring = mine ? '' : `<div class="vagas"><span class="ring ${ringClass(libres,cap)}">${libres} / ${cap}</span></div>`;
  const roleLabel = mine ? (window.CFMS.ROLES[mine] ? window.CFMS.ROLES[mine].label[LANG] : mine) : '';
  const check = mine ? `<div class="mini-check">✓ ${opts.mios?'Confirmado':'Estás apuntado'} (${roleLabel})</div>` : '';
  const tag = mine ? '' : `<span class="tag">${a.titulo[LANG].split(' ')[0]} · Cadena ${a.cadeia}</span>`;
  return `<div class="act t-${tipo} ${mine?'estado-inscrito':''}" onclick="openWizard('${a.id}')">
    <div class="tipo-bar"></div>
    <div class="fecha"><div class="w">${f.w}</div><div class="d">${f.d}</div><div class="m">${f.m}</div></div>
    <div class="info"><div class="t">${a.titulo[LANG]}</div><div class="sub">${a.hora} · ${a.notes?a.notes[LANG]:''}</div>${check||tag}</div>
    ${ring}</div>`;
}

function renderAll(){ renderInicio(); renderAgenda(); renderMios(); }

function renderInicio(){
  const acts = currentActivities();
  const misIds = Object.keys(INSCR);
  // hero: próxima actividad donde estoy inscrito (o la más próxima con plazas)
  const hoy = new Date();
  const futuras = acts.filter(a=> new Date(a.data+'T'+a.hora) >= hoy || true);
  const minhas = acts.filter(a=>INSCR[a.id]).sort((x,y)=>(x.data+x.hora).localeCompare(y.data+y.hora));
  const hero = minhas[0] || acts.find(a=>totalLibres(a)>0) || acts[0];
  const heroBox = document.getElementById('heroBox');
  if(hero){
    const f = fmtFecha(hero.data); const mine = INSCR[hero.id];
    const dias = Math.max(0, Math.ceil((new Date(hero.data+'T12:00:00') - hoy)/86400000));
    heroBox.innerHTML = `<div class="hero"><span class="eyebrow">${mine?'Tu próxima actividad':'Próxima actividad'}</span>
      <h2>${hero.titulo[LANG]}</h2>
      <div class="meta">${f.w} ${f.d} ${f.m} · ${hero.hora} — Cadena ${hero.cadeia}</div>
      <div class="dots"><span class="ln"></span><span class="dt"></span><span class="ln"></span></div>
      <div class="countdown">En ${dias} día${dias===1?'':'s'}${mine?` · confirmado como <b>${window.CFMS.ROLES[mine]?window.CFMS.ROLES[mine].label[LANG]:mine}</b>`:''}</div>
      <button class="cta" onclick="go('v-agenda')">Ver toda la agenda</button></div>`;
  } else { heroBox.innerHTML=''; }
  // kpis
  document.getElementById('kMios').textContent = minhas.length;
  document.getElementById('kActs').textContent = acts.length;
  document.getElementById('kPlazas').textContent = acts.reduce((s,a)=>s+totalLibres(a),0);
  // lista "necesitan voluntarios" (con plazas y no inscrito)
  const necesitan = acts.filter(a=>totalLibres(a)>0 && !INSCR[a.id]).slice(0,4);
  document.getElementById('inicioList').innerHTML = necesitan.length ? necesitan.map(a=>actCardHTML(a)).join('') : '<div class="empty">Todo cubierto por ahora. ¡Gracias!</div>';
}

function renderAgenda(){
  document.getElementById('mesLabel').textContent = MESES[LANG][cursor.getMonth()] + ' ' + cursor.getFullYear();
  const acts = currentActivities();
  document.getElementById('agendaList').innerHTML = acts.length ? acts.map(a=>actCardHTML(a)).join('') : '<div class="empty">Sin actividades este mes.</div>';
}

function renderMios(){
  const acts = currentActivities().filter(a=>INSCR[a.id]);
  document.getElementById('miosList').innerHTML = acts.length ? acts.map(a=>actCardHTML(a,{mios:true})).join('') : '<div class="empty">Aún no estás apuntado a ninguna actividad este mes.</div>';
}

/* ---------- navegación ---------- */
function go(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id===id));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active', b.dataset.v===id));
  window.scrollTo(0,0);
}
window.go=go;

/* ---------- WIZARD (multi-selección) ----------
   wzState.acts = [activityId,...]  (varias actividades)
   wzState.roles = { activityId: roleId }  (función elegida por actividad) */
function openWizard(actId){
  wzState = { step:1, acts: actId ? [actId] : [], roles:{} };
  // precargar función ya inscrita si la hay
  if(actId && INSCR[actId]) wzState.roles[actId] = INSCR[actId];
  renderWzActs();
  document.getElementById('wizard').classList.add('active');
  document.getElementById('stepper').style.visibility='visible';
  resetFoot(); wzState.step=1; renderStep();
}
function closeWizard(){ document.getElementById('wizard').classList.remove('active'); }

/* PASO 1 — multi-selección de actividades (checkbox) */
function renderWzActs(){
  const acts = currentActivities();
  document.getElementById('wzActs').innerHTML = acts.map(x=>{
    const tipo=tipoDe(x.templateId); const f=fmtFecha(x.data); const libres=totalLibres(x);
    const sel = wzState.acts.includes(x.id) ? 'sel':'';
    const dis = (libres<=0 && !INSCR[x.id] && !wzState.acts.includes(x.id)) ? 'disabled':'';
    return `<div class="opt ${sel} ${dis}" data-act="${x.id}" onclick="wzToggleAct('${x.id}')">
      <div class="oic">${ICON_TIPO[tipo]}</div>
      <div class="otxt"><div class="ot">${x.titulo[LANG]}</div><div class="os">${f.w} ${f.d} ${f.m} · ${x.hora} · Cadena ${x.cadeia}</div></div>
      <div class="ocheck">✓</div></div>`;
  }).join('');
}
function wzToggleAct(id){
  const i = wzState.acts.indexOf(id);
  if(i>=0){ wzState.acts.splice(i,1); delete wzState.roles[id]; }
  else { wzState.acts.push(id); }
  document.querySelector(`#wzActs .opt[data-act="${id}"]`).classList.toggle('sel', wzState.acts.includes(id));
}

/* PASO 2 — función por cada actividad seleccionada (una sección por actividad) */
function buildRoles(){
  const acts = currentActivities();
  const sel = wzState.acts.map(id=>acts.find(a=>a.id===id)).filter(Boolean)
    .sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
  document.getElementById('wzRoleHint').textContent = sel.length>1
    ? `Elige tu función en cada una de las ${sel.length} actividades.`
    : 'Elige tu función.';
  document.getElementById('wzRoles').innerHTML = sel.map(a=>{
    const f=fmtFecha(a.data);
    const opts = Object.keys(a.roles).map(rid=>{
      const rd=window.CFMS.ROLES[rid]; const rest=window.CFMS.vagasRestantes(a,rid);
      const chosen = wzState.roles[a.id]===rid ? 'sel':'';
      const dis = (rest<=0 && wzState.roles[a.id]!==rid) ? 'disabled':'';
      const req = rd&&rd.requiresFurgoneta ? ' · requiere furgoneta' : '';
      return `<div class="opt ${chosen} ${dis}" data-act="${a.id}" data-role="${rid}" onclick="wzPickRole('${a.id}','${rid}')">
        <div class="oic">${ICON_TIPO[tipoDe(a.templateId)]}</div>
        <div class="otxt"><div class="ot">${rd?rd.label[LANG]:rid}</div><div class="os">Quedan ${Math.max(0,rest)} de ${a.roles[rid]}${req}</div></div>
        <div class="ocheck">✓</div></div>`;
    }).join('');
    return `<div class="role-group"><div class="role-group-h"><span class="rg-t">${a.titulo[LANG]}</span><span class="rg-d">${f.w} ${f.d} ${f.m} · ${a.hora}</span></div>${opts}</div>`;
  }).join('');
}
function wzPickRole(actId, rid){
  wzState.roles[actId]=rid;
  document.querySelectorAll(`#wzRoles .opt[data-act="${actId}"]`).forEach(o=>o.classList.toggle('sel', o.dataset.role===rid));
}
window.openWizard=openWizard; window.closeWizard=closeWizard; window.wzToggleAct=wzToggleAct; window.wzPickRole=wzPickRole;

function resetFoot(){ document.getElementById('wzFoot').innerHTML='<button class="back hidden" id="wzBack" onclick="prevStep()">Atrás</button><button class="next" id="wzNext" onclick="nextStep()">Continuar</button>'; }
function renderStep(){
  document.querySelectorAll('.wz-step').forEach(s=>s.classList.remove('active'));
  document.querySelector('.wz-step[data-step="'+wzState.step+'"]').classList.add('active');
  document.querySelectorAll('.stepper .st').forEach(st=>{ const n=+st.dataset.s; st.classList.toggle('done',n<wzState.step); st.classList.toggle('cur',n===wzState.step); });
  document.getElementById('wzBack').classList.toggle('hidden', wzState.step===1);
  document.getElementById('wzNext').textContent = (wzState.step===3)?'Confirmar':'Continuar';
  if(wzState.step===2) buildRoles();
  if(wzState.step===3) fillResumo();
  document.querySelector('.wz-body').scrollTo(0,0);
}
function selectedActsSorted(){
  const acts=currentActivities();
  return wzState.acts.map(id=>acts.find(a=>a.id===id)).filter(Boolean).sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
}
function fillResumo(){
  const sel = selectedActsSorted();
  document.getElementById('wzResumo').innerHTML = sel.map(a=>{
    const f=fmtFecha(a.data); const r=wzState.roles[a.id];
    return `<div class="row"><span class="k">${a.titulo[LANG]}<br><span style="text-transform:none;letter-spacing:0;font-size:12px">${f.w} ${f.d} ${f.m} · ${a.hora}</span></span>
      <span class="v">${window.CFMS.ROLES[r]?window.CFMS.ROLES[r].label[LANG]:'—'} <button class="edit" onclick="gotoStep(2)">Cambiar</button></span></div>`;
  }).join('');
}
function gotoStep(s){ wzState.step=s; renderStep(); } window.gotoStep=gotoStep;
function nextStep(){
  if(wzState.step===1){ if(wzState.acts.length===0) return; wzState.step=2; renderStep(); }
  else if(wzState.step===2){
    // todas las actividades seleccionadas deben tener función
    const faltan = wzState.acts.filter(id=>!wzState.roles[id]);
    if(faltan.length){ return; }
    wzState.step=3; renderStep();
  }
  else { confirmInscr(); }
}
function prevStep(){ if(wzState.step>1){ wzState.step--; renderStep(); } }
window.nextStep=nextStep; window.prevStep=prevStep;

function confirmInscr(){
  const sel = selectedActsSorted();
  sel.forEach(a=>{ INSCR[a.id] = wzState.roles[a.id]; });
  saveInscr();
  document.querySelectorAll('.wz-step').forEach(s=>s.classList.remove('active'));
  document.querySelector('.wz-step[data-step="ok"]').classList.add('active');
  document.getElementById('stepper').style.visibility='hidden';
  document.getElementById('wzOkResumo').innerHTML = sel.map(a=>{
    const f=fmtFecha(a.data); const r=wzState.roles[a.id];
    return `<div class="row"><span class="k">${a.titulo[LANG]}<br><span style="text-transform:none;letter-spacing:0;font-size:12px">${f.w} ${f.d} ${f.m} · ${a.hora}</span></span><span class="v">${window.CFMS.ROLES[r]?window.CFMS.ROLES[r].label[LANG]:r}</span></div>`;
  }).join('');
  const okTitle = document.querySelector('.wz-step[data-step="ok"] h2');
  if(okTitle) okTitle.textContent = sel.length>1 ? '¡Estás apuntado!' : '¡Estás apuntado!';
  document.getElementById('wzFoot').innerHTML='<button class="next" onclick="closeWizard();renderAll();go(\'v-mios\')">Listo</button>';
}

/* ---------- init ---------- */
document.getElementById('ver').textContent = window.CFMS.APP_VERSION;
fillDdi(document.getElementById('ddi1'));
fillDdi(document.getElementById('ddi2'));
document.getElementById('prev').onclick = ()=>{ cursor.setMonth(cursor.getMonth()-1); renderAll(); };
document.getElementById('next').onclick = ()=>{ cursor.setMonth(cursor.getMonth()+1); renderAll(); };
loadState();
if(USER){ document.getElementById('loginGate').style.display='none'; startApp(); }
