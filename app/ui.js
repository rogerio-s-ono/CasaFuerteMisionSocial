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
let INSCR = {};                  // { activityId: roleId }  (mis inscripciones confirmadas, local)
let MI_ESPERA = {};              // { activityId: roleId }  (mis inscripciones en lista de espera)
let wzState = { step:1, activity:null, role:null };

/* =========================================================================
   MODO DEMO — datos de ejemplo (simulan lo que vendrá del backend compartido)
   Perfiles: voluntario / líder de una cadena / admin.
   ========================================================================= */
let DEMO_PROFILE = 'voluntario';   // 'voluntario' | 'lider_A' | 'lider_B' | 'lider_AB' | 'admin'
/* estado de la vista líder */
let LIDER_SCOPE = 'all';           // 'all' | <misionId>  (misión mostrada)
let LIDER_VIEW = 'dia';            // 'dia' | 'fn'  (agrupación)
/* líderes autorizados por el admin, por misionId (en real: allowlist en la planilha) */
const DEMO_LIDERES = {
  mercamadrid: { name:'Rogério Ono', email:'rogerio.s.ono@gmail.com' },
  banco:       { name:'Tânia Ono',   email:'tania.eustaqui@gmail.com' }
};
/* inscripciones de ejemplo de OTROS voluntarios, por templateId+rol.
   En real esto vendrá del backend (todas las inscripciones de todos). */
const DEMO_INSCR = {
  // Cadena A
  A1:{ motorista:['Carlos R.'], ajudante:['Marcos','Alessandra'] },      // retirada sáb (2 mot / 2 ayu) -> falta 1 motorista
  A2:{ preparacao:['Débora M.','Everton','Daniel'] },                     // prep sáb (6) -> faltan 3
  A3:{ preparacao:['Ana L.','Célio','María G.','Sofía','Lucas','Pedro','Marta'] }, // prep dom (10) -> faltan 3
  A4:{ distribuicao:['Carlos R.','Marcos','Ana L.','Daniel'] },          // distri (6) -> faltan 2
  A5:{ limpeza:['Everton','Sofía'] },                                    // limpieza (4) -> faltan 2
  // Cadena B
  B1:{ motorista:['João','Ricardo'], ajudante:['Bruno','Tiago'] },       // retirada (2/2) -> LLENO
  B2:{ preparacao:['Cláudia','Beatriz','Rafael','Inés','Nuria','Hugo','Elena','Diego'] }, // prep (10) -> faltan 2
  B3:{ distribuicao:['Cláudia','Rafael','Hugo'] },                       // distri (6) -> faltan 3
  B4:{ limpeza:['Beatriz','Diego','Inés','Nuria'] }                      // limpieza (4) -> LLENO
};
/* lista de espera de ejemplo, por templateId+rol */
const DEMO_ESPERA = {
  B1:{ motorista:['Andrés'], ajudante:['Paula'] },   // recogida B llena -> hay reservas
  B4:{ limpeza:['Sara'] }
};

/* servidores registrados (para el autocompletar del líder) — en real: del backend */
const DEMO_SERVIDORES = [
  { n:'María González', p:'+34 611 111 111' }, { n:'Marta Ruiz', p:'+34 622 222 222' },
  { n:'Mario Souza', p:'+34 633 333 333' }, { n:'Lucía Pérez', p:'+34 644 444 444' },
  { n:'Sofía Lima', p:'+34 655 555 555' }, { n:'Pedro Alves', p:'+34 666 666 666' },
  { n:'Carlos Ruiz', p:'+34 677 777 777' }, { n:'Elena Torres', p:'+34 688 888 888' }
];
/* adiciones hechas por el líder, por activityId -> roleId -> [{name, temp}] */
let LIDER_ADDS = {};
function loadAdds(){ try{ LIDER_ADDS = JSON.parse(localStorage.getItem('mf_lider_adds')||'{}'); }catch(e){ LIDER_ADDS={}; } }
function saveAdds(){ localStorage.setItem('mf_lider_adds', JSON.stringify(LIDER_ADDS)); }
function addsDe(activityId, roleId){ return (LIDER_ADDS[activityId] && LIDER_ADDS[activityId][roleId]) ? LIDER_ADDS[activityId][roleId] : []; }
function pushAdd(activityId, roleId, name, temp){
  LIDER_ADDS[activityId] = LIDER_ADDS[activityId] || {};
  LIDER_ADDS[activityId][roleId] = LIDER_ADDS[activityId][roleId] || [];
  LIDER_ADDS[activityId][roleId].push({ name, temp:!!temp });
  saveAdds();
}
function removeAdd(activityId, roleId, idx){
  if(LIDER_ADDS[activityId] && LIDER_ADDS[activityId][roleId]){ LIDER_ADDS[activityId][roleId].splice(idx,1); saveAdds(); }
}
function tmplId(activityId){
  // id de ocurrencia = "misionId:TMPL-YYYY-MM-DD" → extrae TMPL
  const afterColon = (activityId||'').split(':').pop();   // "TMPL-YYYY-MM-DD" o "TMPL"
  return afterColon.replace(/-\d{4}-\d{2}-\d{2}$/, '');    // quita la fecha
}
/* permisos reales del servidor (del pull): { admins:[email], lideres:{email:[misionId]} } */
let PERMISOS = null;
let SERVER_VOLS = [];   // voluntarios del servidor (pestaña Voluntarios)
function setPermisos(p){ PERMISOS = p || null; }
function setServerVols(v){ SERVER_VOLS = Array.isArray(v)?v:[]; }
/* busca un voluntario del servidor por email (para reconocer login Google entre dispositivos) */
function volByEmail(email){
  if(!email) return null;
  email = email.toLowerCase();
  var v = SERVER_VOLS.find(function(r){ return String(r.email||'').toLowerCase()===email; });
  return v ? { name:v.nombre, phone:String(v.telefono), email:email } : null;
}
function myEmail(){ return (USER && USER.email) ? USER.email.toLowerCase() : ''; }
/* si estoy logado con email y hay permisos del servidor, mandan ELLOS; si no, cae al modo demo (DEMO_PROFILE) */
function isAdmin(){
  if(myEmail() && PERMISOS){ return (PERMISOS.admins||[]).indexOf(myEmail())>=0; }
  return DEMO_PROFILE==='admin';
}
function isLider(){
  if(myEmail() && PERMISOS){ return !!(PERMISOS.lideres && PERMISOS.lideres[myEmail()] && PERMISOS.lideres[myEmail()].length); }
  return DEMO_PROFILE==='lider_A' || DEMO_PROFILE==='lider_B' || DEMO_PROFILE==='lider_AB';
}
/* misiones de las que la persona es líder */
function liderCadenas(){
  if(myEmail() && PERMISOS && PERMISOS.lideres && PERMISOS.lideres[myEmail()]){ return PERMISOS.lideres[myEmail()].slice(); }
  if(DEMO_PROFILE==='lider_A') return ['mercamadrid'];
  if(DEMO_PROFILE==='lider_B') return ['banco'];
  if(DEMO_PROFILE==='lider_AB') return ['mercamadrid','banco'];
  return [];
}
/* misiones visibles según el scope elegido */
function scopeCadenas(){
  const mias = liderCadenas();
  if(LIDER_SCOPE==='all') return mias;
  return mias.includes(LIDER_SCOPE) ? [LIDER_SCOPE] : mias;
}
/* inscritos (demo + los míos + añadidos por el líder) por actividad/rol */
function inscritosDe(activity, roleId){
  const t = tmplId(activity.id);
  const base = (DEMO_INSCR[t] && DEMO_INSCR[t][roleId]) ? DEMO_INSCR[t][roleId].slice() : [];
  if(INSCR[activity.id]===roleId && USER){ base.push((USER.name||'Yo') + ' (tú)'); }
  addsDe(activity.id, roleId).forEach(a=>base.push(a.name));
  return base;
}
function esperaDe(activity, roleId){
  const t = tmplId(activity.id);
  const base = (DEMO_ESPERA[t] && DEMO_ESPERA[t][roleId]) ? DEMO_ESPERA[t][roleId].slice() : [];
  if(MI_ESPERA[activity.id]===roleId && USER){ base.push((USER.name||'Yo') + ' (tú)'); }
  return base;
}
/* ocupación considerando demo: cuántos inscritos reales hay en un rol */
function ocupados(activity, roleId){ return inscritosDe(activity, roleId).length; }
function libresRol(activity, roleId){ return Math.max(0, (activity.roles[roleId]||0) - ocupados(activity, roleId)); }

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
function loadConfig(){
  try{ const c=JSON.parse(localStorage.getItem('mf_config')||'null'); if(c && c.misiones) window.CFMS.setConfig(c); }catch(e){}
}
function saveConfig(){
  localStorage.setItem('mf_config', JSON.stringify(window.CFMS.getConfig()));
  if(window.MFSync && window.MFSync.enabled){ window.MFSync.pushConfig(window.CFMS.getConfig()); }
}
function loadState(){
  try{ USER = JSON.parse(localStorage.getItem('mf_user')||'null'); }catch(e){ USER=null; }
  try{ INSCR = JSON.parse(localStorage.getItem('mf_inscr')||'{}'); }catch(e){ INSCR={}; }
  try{ MI_ESPERA = JSON.parse(localStorage.getItem('mf_espera')||'{}'); }catch(e){ MI_ESPERA={}; }
}
function saveUser(){ localStorage.setItem('mf_user', JSON.stringify(USER)); }
function saveInscr(){ localStorage.setItem('mf_inscr', JSON.stringify(INSCR)); }
function saveEspera(){ localStorage.setItem('mf_espera', JSON.stringify(MI_ESPERA)); }
function normPhone(v){ return (v||'').replace(/[\s\-()]/g,''); }
function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function toast(msg){
  let t=document.getElementById('mfToast');
  if(!t){ t=document.createElement('div'); t.id='mfToast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='on';
  clearTimeout(window._toastT); window._toastT=setTimeout(()=>{ t.className=''; }, 2200);
}
window.toast=toast;

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
  var cid = (window.CFMS_CONFIG && window.CFMS_CONFIG.GOOGLE_CLIENT_ID) || '';
  var gisReady = window.google && google.accounts && google.accounts.id && cid && cid.indexOf('XXXX') === -1;
  if(!gisReady){
    // Fallback: GIS no cargó o falta Client ID → usa el flujo de teléfono (1ª vez pide tel+nombre)
    toast && toast('Login Google no disponible — usa tu teléfono');
    _googleFirstTime('', '');
    return;
  }
  google.accounts.id.initialize({ client_id: cid, callback: _onGoogleCredential });
  google.accounts.id.prompt(); // muestra el selector de cuenta de Google
}
/* callback del GIS: recibe la credential (JWT idToken) */
function _onGoogleCredential(resp){
  var jwt = resp && resp.credential; if(!jwt){ return; }
  try{ sessionStorage.setItem('mf_idtoken', jwt); }catch(e){}
  var claims = _decodeJwt(jwt) || {};
  var email = (claims.email||'').toLowerCase();
  var nombre = claims.name || claims.given_name || '';
  // 1) ¿ya está en el SERVIDOR (pestaña Voluntarios) por este email? → entra en cualquier dispositivo
  var srv = volByEmail(email);
  if(srv && srv.phone){ USER={ name:srv.name||nombre, phone:srv.phone, email:email }; enter('Entrando…'); return; }
  // 2) ¿vínculo local (este dispositivo)?
  var vinc = _emailPhone(email);
  if(vinc){ USER={ name:vinc.name||nombre, phone:vinc.phone, email:email }; enter('Entrando…'); return; }
  // 3) por si el pull inicial aún no trajo voluntarios: pull fresco y reintenta
  if(window.MFSync && window.MFSync.enabled){
    document.getElementById('lgCheckTxt') && (document.getElementById('lgCheckTxt').textContent='Comprobando…');
    document.getElementById('lgChecking').classList.add('on');
    window.MFSync.pull().then(function(res){
      document.getElementById('lgChecking').classList.remove('on');
      if(res && res.data && res.data.voluntarios){ setServerVols(res.data.voluntarios); if(res.data.permisos) setPermisos(res.data.permisos); }
      var s2 = volByEmail(email);
      if(s2 && s2.phone){ USER={ name:s2.name||nombre, phone:s2.phone, email:email }; enter('Entrando…'); }
      else { _googleFirstTime(nombre, email); }
    });
    return;
  }
  // 4) sin servidor → pide teléfono (1ª vez)
  _googleFirstTime(nombre, email);
}
function _googleFirstTime(nombre, email){
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('ddi2').disabled=false; document.getElementById('ddi2').value='+34';
  document.getElementById('regPhone').value=''; document.getElementById('regPhone').removeAttribute('readonly');
  document.getElementById('regPhone').placeholder='600 000 000';
  document.getElementById('regName').value=nombre||'';
  document.getElementById('regWelcome').innerHTML= email
    ? 'Primera vez con Google. <b>¡Bienvenido!</b> Confirma tu nombre y añade tu teléfono (para los recordatorios por WhatsApp).'
    : 'Primera vez. <b>¡Bienvenido!</b> Solo necesitamos tu nombre y teléfono.';
  document.getElementById('panelRegister').classList.remove('hidden');
  window._googleEmail = email || '';
}
function _decodeJwt(jwt){ try{ var p=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(decodeURIComponent(escape(atob(p)))); }catch(e){ return null; } }
/* vínculo email↔teléfono guardado localmente: { email: {phone,name} } */
function _emailMap(){ try{ return JSON.parse(localStorage.getItem('mf_email_phone')||'{}'); }catch(e){ return {}; } }
function _emailPhone(email){ return email ? _emailMap()[email] : null; }
function _rememberEmailPhone(email, phone, name){ if(!email) return; var m=_emailMap(); m[email]={phone:phone,name:name}; localStorage.setItem('mf_email_phone', JSON.stringify(m)); }
function submitRegister(){
  const name = document.getElementById('regName').value.trim();
  const ddi = document.getElementById('ddi2').value;
  const phone = ddi + normPhone(document.getElementById('regPhone').value.trim());
  if(!name || normPhone(phone).length < 8){ return; }
  const email = window._googleEmail || '';
  USER={ name, phone, email:email };
  rememberUser(phone,name);
  if(email) _rememberEmailPhone(email, phone, name);
  window._googleEmail='';
  enter('Creando tu perfil…');
}
function backToPhone(){
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('regPhone').setAttribute('readonly','');
  document.getElementById('ddi2').disabled=true;
  document.getElementById('panelPhone').classList.remove('hidden');
}
function enter(msg){
  saveUser();
  // registrar/actualizar el voluntario en el servidor (cola offline-first)
  if(USER && USER.phone && window.MFSync && window.MFSync.enabled){
    window.MFSync.queue('upsertVoluntario', { voluntario:{ telefono:USER.phone, nombre:USER.name, email:USER.email||'', idioma:LANG } });
  }
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('lgCheckTxt').textContent = msg;
  document.getElementById('lgChecking').classList.add('on');
  setTimeout(()=>{ document.getElementById('loginGate').style.display='none'; startApp(); }, 1600);
}
function logout(){ localStorage.removeItem('mf_user'); location.reload(); }
function goLogin(){
  // volver a la pantalla de login (cierra sesión)
  USER = null; localStorage.removeItem('mf_user');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('bottomNav').classList.add('hidden');
  const gate = document.getElementById('loginGate');
  gate.style.display=''; 
  // resetear paneles del login
  document.getElementById('panelPhone').classList.remove('hidden');
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('lgChecking').classList.remove('on');
  window.scrollTo(0,0);
}
window.goLogin=goLogin;
window.submitPhone=submitPhone; window.loginGoogle=loginGoogle; window.submitRegister=submitRegister; window.backToPhone=backToPhone;

/* ---------- APP ---------- */
function startApp(){
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');
  document.getElementById('hdrName').textContent = (USER && USER.name) ? USER.name.split(' ')[0] : '—';
  renderDemoBar();
  renderAll();
}

/* ---------- MODO DEMO: selector de perfil ---------- */
function renderDemoBar(){
  const bar = document.getElementById('demoBar');
  // Si el usuario entró con Google (email real) y hay permisos del servidor, NO se muestra
  // el selector demo: el rol viene de la allowlist real.
  if(myEmail() && PERMISOS){
    var rol = isAdmin()?'Admin' : isLider()?'Líder' : 'Voluntario';
    bar.innerHTML = '<b>'+rol+'</b> · '+myEmail();
    applyProfile();
    return;
  }
  bar.innerHTML = `<b>Demo · perfil:</b>
    <select id="demoSel" onchange="setProfile(this.value)">
      <option value="voluntario">Voluntario</option>
      <option value="lider_A">Líder · MercaMadrid</option>
      <option value="lider_B">Líder · Banco de Alimentos</option>
      <option value="lider_AB">Líder · Ambas misiones</option>
      <option value="admin">Admin</option>
    </select>`;
  document.getElementById('demoSel').value = DEMO_PROFILE;
  applyProfile();
}
function setProfile(p){ DEMO_PROFILE=p; LIDER_SCOPE='all'; LIDER_VIEW='dia'; ADMIN_NAV={screen:'list',misionId:null}; applyProfile(); renderAll();
  // si dejo de ser líder/admin y estoy en su vista, vuelvo a inicio
  if(!isLider() && document.getElementById('v-lider').classList.contains('active')) go('v-inicio');
  if(!isAdmin() && document.getElementById('v-admin').classList.contains('active')) go('v-inicio');
}
window.setProfile=setProfile;
function applyProfile(){
  const nav = document.getElementById('navLider');
  nav.style.display = isLider() ? 'flex' : 'none';
  const navA = document.getElementById('navAdmin');
  if(navA) navA.style.display = isAdmin() ? 'flex' : 'none';
}

/* ---------- VISTA LÍDER ---------- */
/* helpers de HTML reutilizables */
function chipsRol(a, r){
  const t = tmplId(a.id);
  const demo = (DEMO_INSCR[t] && DEMO_INSCR[t][r]) ? DEMO_INSCR[t][r].slice() : [];
  if(INSCR[a.id]===r && USER) demo.push((USER.name||'Yo') + ' (tú)');
  const adds = addsDe(a.id, r);
  const cap = a.roles[r];
  const ocup = demo.length + adds.length;
  const falta = Math.max(0, cap - ocup);
  let html = demo.map(n=>`<span class="chip">${n}</span>`).join('');
  html += adds.map((ad,i)=> ad.temp
      ? `<span class="chip temp">${ad.name} <span class="tg">· Temp</span> <span class="x" onclick="delAdd('${a.id}','${r}',${i})">×</span></span>`
      : `<span class="chip">${ad.name} <span class="x" onclick="delAdd('${a.id}','${r}',${i})">×</span></span>`
    ).join('');
  html += Array.from({length:falta}).map(()=>`<span class="chip vac">vacante</span>`).join('');
  if(falta>0){ html += `<button class="add-btn" onclick="openAddSheet('${a.id}','${r}')">+ Añadir servidor</button>`; }
  return html || '<span class="chip vac">sin inscritos</span>';
}
function esperaHtml(a, r){
  const esp = esperaDe(a,r);
  return esp.length ? `<div class="lc-esp"><div class="et">⏳ Lista de espera</div><div class="people">${esp.map(n=>`<span class="chip esp">${n}</span>`).join('')}</div></div>` : '';
}
function actCardLider(a){
  const f=fmtFecha(a.data); const roleIds=Object.keys(a.roles);
  const faltaAct = roleIds.reduce((s,r)=>s+libresRol(a,r),0);
  const roles = roleIds.map(r=>{
    const cap=a.roles[r]; const gente=inscritosDe(a,r); const falta=Math.max(0,cap-gente.length);
    const rd=window.CFMS.ROLES[r];
    return `<div class="lc-role">
      <div class="lr-h"><span class="lr-name">${rd?rd.label[LANG]:r}</span><span class="lr-count ${falta>0?'miss':'full'}">${gente.length}/${cap}${falta>0?` · faltan ${falta}`:' · completo'}</span></div>
      <div class="people">${chipsRol(a,r)}</div>
      ${esperaHtml(a,r)}</div>`;
  }).join('');
  const badge = faltaAct>0 ? `<span class="lc-badge falta">Faltan ${faltaAct}</span>` : `<span class="lc-badge ok">Completa</span>`;
  return `<div class="lcard ${faltaAct>0?'falta':'completa'}">
    <div class="lc-h"><div><span class="lc-t">${a.titulo[LANG]}</span> <span class="lc-time">${hhrs(a)}</span></div>${badge}</div>
    ${roles}
    <div class="lc-foot"><button class="chk-btn" onclick="openChecklist('${a.id}')">☑ Checklist${chkCount(a)}</button></div></div>`;
}
function covOf(acts){
  let plazas=0, cub=0, esp=0;
  acts.forEach(a=>Object.keys(a.roles).forEach(r=>{ plazas+=a.roles[r]; cub+=Math.min(a.roles[r],ocupados(a,r)); esp+=esperaDe(a,r).length; }));
  return { plazas, cub, falta:Math.max(0,plazas-cub), esp, pct: plazas?Math.round(cub/plazas*100):100 };
}
function covBarClass(pct){ return pct>=100?'':pct>=60?'mid':'low'; }

function setLiderScope(s){ LIDER_SCOPE=s; renderLider(); }
function setLiderView(v){ LIDER_VIEW=v; renderLider(); }
window.setLiderScope=setLiderScope; window.setLiderView=setLiderView;

function renderLider(){
  const head=document.getElementById('liderHead'), list=document.getElementById('liderList');
  const ctrl=document.getElementById('liderCtrl');
  if(!isLider()){ head.innerHTML=''; list.innerHTML=''; if(ctrl) ctrl.innerHTML=''; return; }
  document.getElementById('mesLabelL').textContent = MESES[LANG][cursor.getMonth()] + ' ' + cursor.getFullYear();

  const mias = liderCadenas();
  // asegurar scope válido
  if(LIDER_SCOPE!=='all' && !mias.includes(LIDER_SCOPE)) LIDER_SCOPE='all';
  const cadenas = scopeCadenas();
  const acts = currentActivities().filter(a=>cadenas.includes(a.cadeia));

  // ---- resumen general ----
  const cov = covOf(acts);
  const scopeTitle = (LIDER_SCOPE==='all' && mias.length>1) ? 'Todas las misiones' : window.CFMS.cadenaLabel(cadenas[0]);
  const liderNombre = mias.map(c=>DEMO_LIDERES[c].name).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
  head.innerHTML = `<div class="lider-head">
    <div class="lh-cad">${scopeTitle}</div>
    <div class="lh-sub">Líder: ${liderNombre} · ${acts.length} actividades este mes</div>
    <div class="lh-kpi">
      <div><b>${cov.cub}/${cov.plazas}</b>Plazas cubiertas</div>
      <div class="falta"><b>${cov.falta}</b>Faltan</div>
      <div><b>${cov.esp}</b>En espera</div>
    </div></div>`;

  // ---- controles: selector de cadena (si es líder de >1) + toggle de vista ----
  let ctrlHtml = '';
  if(mias.length>1){
    ctrlHtml += `<div class="scope-sel"><label>Misión</label>
      <select onchange="setLiderScope(this.value)">
        <option value="all">Todas las misiones</option>
        ${mias.map(c=>`<option value="${c}">${window.CFMS.cadenaLabel(c)}</option>`).join('')}
      </select></div>`;
  }
  ctrlHtml += `<div class="switch">
      <button class="${LIDER_VIEW==='dia'?'on':''}" onclick="setLiderView('dia')">Por día</button>
      <button class="${LIDER_VIEW==='fn'?'on':''}" onclick="setLiderView('fn')">Por función</button>
    </div>`;
  ctrl.innerHTML = ctrlHtml;
  // reflejar scope en el select
  const sel = ctrl.querySelector('.scope-sel select'); if(sel) sel.value = LIDER_SCOPE;

  // ---- cuerpo ----
  list.innerHTML = cadenas.map(cad=>{
    const actsCad = acts.filter(a=>a.cadeia===cad);
    const cadHeader = (LIDER_SCOPE==='all' && mias.length>1)
      ? (()=>{ const c=covOf(actsCad); return `<div class="cad-sep"><span class="cad-name">${window.CFMS.cadenaLabel(cad)}</span><span class="cad-cov ${c.falta>0?'falta':'ok'}">${c.cub}/${c.plazas}${c.falta>0?` · faltan ${c.falta}`:' · completo'}</span></div>`; })()
      : '';
    return cadHeader + (LIDER_VIEW==='dia' ? renderPorDia(actsCad) : renderPorFuncion(actsCad));
  }).join('');
}

/* ---- A: agrupado por DÍA ---- */
function renderPorDia(acts){
  // agrupar por fecha
  const byDay = {};
  acts.forEach(a=>{ (byDay[a.data]=byDay[a.data]||[]).push(a); });
  const dias = Object.keys(byDay).sort();
  return dias.map(iso=>{
    const dayActs = byDay[iso].sort((x,y)=>x.hora.localeCompare(y.hora));
    const f=fmtFecha(iso); const c=covOf(dayActs);
    const tipos = dayActs.map(a=>a.titulo[LANG].split(' ')[0]).filter((v,i,a)=>a.indexOf(v)===i).join(' + ');
    return `<div class="day">
      <div class="day-h">
        <div class="day-badge"><div class="dd">${f.d}</div><div class="dw">${f.w}</div></div>
        <div class="day-info">
          <div class="dt">${f.w} ${f.d} ${f.m}</div>
          <div class="dcov">${tipos} · ${c.cub} de ${c.plazas} plazas</div>
          <div class="cov-bar ${covBarClass(c.pct)}"><i style="width:${c.pct}%"></i></div>
        </div>
        <span class="day-pill ${c.falta>0?'falta':'ok'}">${c.falta>0?`Faltan ${c.falta}`:'Completa'}</span>
      </div>
      ${dayActs.map(a=>actCardLider(a)).join('')}
    </div>`;
  }).join('');
}

/* ---- B: agrupado por FUNCIÓN ---- */
function renderPorFuncion(acts){
  const TIPO_ORDER=['retirada','prep','distri','limpieza'];
  const TIPO_COLOR={ retirada:'#f2711c', prep:'#e8a300', distri:'#7cb518', limpieza:'#4f9d69' };
  const TIPO_LABEL={ retirada:'Recogida', prep:'Preparación', distri:'Distribución', limpieza:'Limpieza' };
  // recopilar (actividad, rol) por tipo
  const byTipo={};
  acts.forEach(a=>{ const t=tipoDe(a.templateId); (byTipo[t]=byTipo[t]||[]).push(a); });
  return TIPO_ORDER.filter(t=>byTipo[t]).map(t=>{
    const occ = byTipo[t].sort((x,y)=>(x.data+x.hora).localeCompare(y.data+y.hora)).map(a=>{
      const f=fmtFecha(a.data);
      return Object.keys(a.roles).map(r=>{
        const cap=a.roles[r]; const gente=inscritosDe(a,r); const falta=Math.max(0,cap-gente.length);
        const rd=window.CFMS.ROLES[r];
        const extra = Object.keys(a.roles).length>1 ? ` · ${rd?rd.label[LANG]:r}` : '';
        return `<div class="fn-occ">
          <div class="oc-h"><span class="oc-when"><b>${f.w} ${f.d}</b> · ${a.hora}${extra}</span><span class="oc-c ${falta>0?'miss':'full'}">${gente.length}/${cap}${falta>0?` · faltan ${falta}`:' · completo'}</span></div>
          <div class="people">${chipsRol(a,r)}</div></div>`;
      }).join('');
    }).join('');
    return `<div class="fn-group"><div class="fn-h"><span class="fn-dot" style="background:${TIPO_COLOR[t]}"></span><span class="fn-t">${TIPO_LABEL[t]}</span></div>${occ}</div>`;
  }).join('');
}

/* ---------- SHEET: AÑADIR SERVIDOR (líder) ---------- */
let addCtx = { activityId:null, roleId:null };
function openAddSheet(activityId, roleId){
  addCtx = { activityId, roleId };
  const a = currentActivities().find(x=>x.id===activityId);
  const rd = window.CFMS.ROLES[roleId];
  document.getElementById('addTitle').textContent = 'Añadir a ' + (a?a.titulo[LANG]:'');
  const f = a?fmtFecha(a.data):null;
  document.getElementById('addSub').textContent = (f?`${f.w} ${f.d} ${f.m} · ${hhrs(a)} · `:'') + (rd?rd.label[LANG]:roleId);
  acBackSearch();
  document.getElementById('addBackdrop').classList.add('on');
  document.getElementById('addSheet').classList.add('on');
  setTimeout(()=>document.getElementById('acInput').focus(),250);
}
function closeAddSheet(){ document.getElementById('addBackdrop').classList.remove('on'); document.getElementById('addSheet').classList.remove('on'); }
function acBackSearch(){
  document.getElementById('addStSearch').style.display='block';
  document.getElementById('addStTemp').style.display='none';
  document.getElementById('acInput').value=''; document.getElementById('acList').style.display='none';
}
function acType(v){
  const list=document.getElementById('acList'); const q=norm((v||'').trim());
  if(!q){ list.style.display='none'; return; }
  const hits = DEMO_SERVIDORES.filter(s=>norm(s.n).includes(q)).slice(0,5);
  const ini = n => n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  let html = hits.map(s=>`<div class="ac-item" onclick="acPick('${s.n.replace(/'/g,"\\'")}')">
      <div class="av">${ini(s.n)}</div>
      <div class="nm"><div class="n1">${s.n}</div><div class="n2">${s.p}</div></div>
      <span class="tag-reg">registrado</span></div>`).join('');
  html += `<div class="ac-create" onclick="acGoTemp('${(v||'').replace(/'/g,"\\'")}')">
      <div class="plus">+</div>
      <div class="ct"><b>Añadir "${v}"</b><div class="sub">como servidor temporal (solo hoy)</div></div></div>`;
  list.innerHTML = html; list.style.display='block';
}
function acPick(name){ pushAdd(addCtx.activityId, addCtx.roleId, name, false); closeAddSheet(); renderLider(); }
function acGoTemp(name){
  document.getElementById('addStSearch').style.display='none';
  document.getElementById('addStTemp').style.display='block';
  document.getElementById('tNameLbl').textContent = name || '—';
  document.getElementById('tNameInput').value = name || '';
}
function addTemp(){
  const name = document.getElementById('tNameInput').value.trim() || 'Temporal';
  pushAdd(addCtx.activityId, addCtx.roleId, name, true);
  closeAddSheet(); renderLider();
}
function delAdd(activityId, roleId, idx){ removeAdd(activityId, roleId, idx); renderLider(); }
window.openAddSheet=openAddSheet; window.closeAddSheet=closeAddSheet; window.acType=acType; window.acBackSearch=acBackSearch;
window.acPick=acPick; window.acGoTemp=acGoTemp; window.addTemp=addTemp; window.delAdd=delAdd;

/* ---------- ADMIN (configuración de misiones/roles) ---------- */
let ADMIN_NAV = { screen:'list', misionId:null };   // list | mision | roles
const WD = { es:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'], pt:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] };
function recLabel(rec){
  if(!rec) return '—';
  const wd = WD[LANG];
  if(rec.tipo==='semanal') return `Semanal · ${wd[rec.weekday]}`;
  if(rec.tipo==='mensal_posicao') return `Mensual · ${rec.ordinal}º ${wd[rec.weekday]}`;
  if(rec.tipo==='mensal_dia') return `Mensual · día ${rec.day}`;
  if(rec.tipo==='avulso') return `Fechas sueltas (${(rec.fechas||[]).length})`;
  return '—';
}
function durLabel(min){ if(!min) return '—'; const h=Math.floor(min/60), m=min%60; return (h?h+'h':'')+(m?(' '+m+'min'):''); }
function adminGo(screen, misionId){ ADMIN_NAV={ screen, misionId:misionId||null }; renderAdmin(); window.scrollTo(0,0); }
window.adminGo=adminGo;
function toggleAcc(h){ if(h && h.parentNode) h.parentNode.classList.toggle('open'); }
window.toggleAcc=toggleAcc;

function renderAdmin(){
  const box=document.getElementById('adminBody');
  if(!isAdmin()){ box.innerHTML=''; return; }
  const cfg=window.CFMS.getConfig();
  if(ADMIN_NAV.screen==='roles') return renderAdminRoles(box, cfg);
  if(ADMIN_NAV.screen==='accesos') return renderAdminAccesos(box, cfg);
  if(ADMIN_NAV.screen==='mision') return renderAdminMision(box, cfg);
  return renderAdminList(box, cfg);
}

function renderAdminList(box, cfg){
  const mis = cfg.misiones.map(m=>{
    const nAct=m.actividades.length, nLid=(m.lideres||[]).length;
    return `<div class="card"><div class="row" onclick="adminGo('mision','${m.id}')">
      <span class="dot" style="background:${m.color}"></span>
      <div class="rt"><div class="n">${m.nombre}</div><div class="s">${nAct} actividades · ${nLid} líder${nLid===1?'':'es'}</div></div>
      <span class="pill ${m.activo!==false?'on':'off'}">${m.activo!==false?'Activa':'Inactiva'}</span><span class="chev">›</span></div></div>`;
  }).join('');
  box.innerHTML = `
    <div class="adm-head"><div class="ah-t">Configuración</div><div class="ah-s">Admin · misiones y roles</div></div>
    <div class="sec-t">Misiones</div>${mis}
    <button class="btn primary" onclick="adminNewMision()">+ Nueva misión</button>
    <div class="sec-t">Catálogo</div>
    <div class="card"><div class="row" onclick="adminGo('roles')"><span class="dot" style="background:#7c5cbf"></span><div class="rt"><div class="n">Roles</div><div class="s">${cfg.roles.length} roles definidos</div></div><span class="chev">›</span></div></div>
    <div class="card"><div class="row" onclick="adminGo('accesos')"><span class="dot" style="background:#4f9d69"></span><div class="rt"><div class="n">Accesos y usuarios</div><div class="s">Admins, líderes y voluntarios</div></div><span class="chev">›</span></div></div>
    <div class="admnote">El Admin configura la estructura. Los líderes operan el día a día.</div>`;
}

function adminNewMision(){
  const cfg=window.CFMS.getConfig();
  const id='m'+Date.now();
  cfg.misiones.push({ id, nombre:'Nueva misión', color:'#7cb518', activo:true, descripcion:{es:'',pt:''}, lideres:[], actividades:[] });
  saveConfig(); adminGo('mision', id);
}
window.adminNewMision=adminNewMision;

function renderAdminMision(box, cfg){
  const m=cfg.misiones.find(x=>x.id===ADMIN_NAV.misionId);
  if(!m){ adminGo('list'); return; }
  const colores=['#f2711c','#3a5a78','#7cb518','#e8a300','#7c5cbf','#4f9d69'];
  const dots=colores.map(c=>`<i class="${c===m.color?'sel':''}" style="background:${c}" onclick="adminSetColor('${m.id}','${c}')"></i>`).join('');
  const lideres=(m.lideres||[]).map((e,i)=>`<span class="chip">${e} <span class="x" onclick="adminDelLider('${m.id}',${i})">×</span></span>`).join('')
    + `<span class="chip add" onclick="adminShowLiderInput('${m.id}')">+ Añadir líder</span>`;
  const acts=m.actividades.map(a=>{
    const plz=(a.plazas||[]).map((p,pi)=>`<div class="slot"><span class="sn">${window.CFMS.rolLabel(p.rolId,LANG)}</span>
        <span class="cap"><input type="number" min="0" value="${p.cap}" onchange="adminSetCap('${m.id}','${a.id}',${pi},this.value)" /><span class="lbl">plazas</span>
        <span class="x" style="opacity:.4;cursor:pointer" onclick="adminDelPlaza('${m.id}','${a.id}',${pi})">×</span></span></div>`).join('');
    return `<div class="acc" id="acc-${a.id}">
      <div class="acc-h" onclick="toggleAcc(this)"><div class="at"><div class="n">${a.nombre[LANG]}</div>
        <div class="s">${recLabel(a.recurrencia)} · ${a.horaInicio}${a.duracionMin?('–'+window.CFMS.calcFin(a.horaInicio,a.duracionMin)):''} · ${(a.plazas||[]).reduce((s,p)=>s+p.cap,0)} plazas</div></div><span class="caret">▾</span></div>
      <div class="acc-body">
        <div class="fld"><label>Nombre (ES)</label><input value="${a.nombre.es||''}" onchange="adminSetAct('${m.id}','${a.id}','nombre_es',this.value)" /></div>
        <div class="two">
          <div class="fld"><label>Hora inicio</label><input type="time" value="${a.horaInicio}" onchange="adminSetAct('${m.id}','${a.id}','horaInicio',this.value)" /></div>
          <div class="fld"><label>Duración (min)</label><input type="number" min="0" step="15" value="${a.duracionMin||''}" onchange="adminSetAct('${m.id}','${a.id}','duracionMin',this.value)" /></div>
        </div>
        <div class="fld"><label>Recurrencia</label>${recEditor(m.id,a)}</div>
        <div class="sec-t" style="margin-top:6px">Plazas por rol</div>${plz||'<div class="admnote" style="text-align:left;padding:4px 0">Sin plazas.</div>'}
        <div class="rolerow"><select id="newrol-${a.id}">${cfg.roles.map(r=>`<option value="${r.id}">${r.nombre[LANG]}</option>`).join('')}</select><button class="miniadd" onclick="adminAddPlaza('${m.id}','${a.id}')">+ Añadir plaza</button></div>
        <div class="acc-actions"><label class="tgl"><input type="checkbox" ${a.activo!==false?'checked':''} onchange="adminSetAct('${m.id}','${a.id}','activo',this.checked)" /> Activa</label><button class="del" onclick="adminDelAct('${m.id}','${a.id}')">Eliminar actividad</button></div>
      </div></div>`;
  }).join('');
  box.innerHTML = `
    <div class="adm-head"><button class="back" onclick="adminGo('list')">‹</button><div><div class="ah-t">Editar misión</div><div class="ah-s">${m.nombre}</div></div></div>
    <div class="fld"><label>Nombre</label><input value="${m.nombre}" onchange="adminSetMision('${m.id}','nombre',this.value)" /></div>
    <div class="two">
      <div class="fld"><label>Color</label><div class="colordots">${dots}</div></div>
      <div class="fld"><label>Estado</label><select onchange="adminSetMision('${m.id}','activo',this.value==='Activa')"><option ${m.activo!==false?'selected':''}>Activa</option><option ${m.activo===false?'selected':''}>Inactiva</option></select></div>
    </div>
    <div class="fld"><label>Líderes (entran con Google)</label><div class="chips">${lideres}</div>
      <div id="liderInput" style="display:none;margin-top:8px" class="rolerow"><input type="email" id="newLiderEmail" placeholder="email@gmail.com" /><button class="miniadd" onclick="adminAddLider('${m.id}')">Añadir</button></div>
      <div class="admhint">Autorizados por el Admin. Gestionan escala y checklist de esta misión.</div></div>
    <div class="sec-t">Actividades</div>${acts}
    <button class="btn primary" onclick="adminAddAct('${m.id}')">+ Añadir actividad</button>
    <div class="acc-actions" style="margin-top:16px"><button class="del" onclick="adminDelMision('${m.id}')">Eliminar misión</button><button class="btn primary sm" onclick="adminGo('list')">Hecho</button></div>`;
}
function recEditor(mid, a){
  const wd=WD[LANG]; const rec=a.recurrencia||{tipo:'mensal_posicao',weekday:6,ordinal:1};
  const tipos=[['semanal','Semanal'],['mensal_posicao','Mensual · posición'],['mensal_dia','Mensual · día'],['avulso','Fechas sueltas']];
  let extra='';
  if(rec.tipo==='semanal'||rec.tipo==='mensal_posicao'){
    extra=`<select onchange="adminSetRec('${mid}','${a.id}','weekday',this.value)">${wd.map((d,i)=>`<option value="${i}" ${rec.weekday===i?'selected':''}>${d}</option>`).join('')}</select>`;
    if(rec.tipo==='mensal_posicao') extra+=`<select onchange="adminSetRec('${mid}','${a.id}','ordinal',this.value)">${[1,2,3,4,5].map(o=>`<option value="${o}" ${rec.ordinal===o?'selected':''}>${o}º</option>`).join('')}</select>`;
  } else if(rec.tipo==='mensal_dia'){
    extra=`<input type="number" min="1" max="31" value="${rec.day||1}" onchange="adminSetRec('${mid}','${a.id}','day',this.value)" style="width:70px" />`;
  }
  return `<div class="recedit"><select onchange="adminSetRec('${mid}','${a.id}','tipo',this.value)">${tipos.map(t=>`<option value="${t[0]}" ${rec.tipo===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select>${extra}</div>`;
}

/* ---- mutaciones admin (todas guardan + re-render) ---- */
function _mis(id){ return window.CFMS.getConfig().misiones.find(m=>m.id===id); }
function _act(mid,aid){ const m=_mis(mid); return m&&m.actividades.find(a=>a.id===aid); }
function adminSetMision(id,campo,val){ const m=_mis(id); if(!m)return; m[campo]=val; saveConfig(); if(campo==='activo'||campo==='nombre'){} }
function adminSetColor(id,c){ const m=_mis(id); if(m){ m.color=c; saveConfig(); renderAdmin(); } }
function adminShowLiderInput(id){ const el=document.getElementById('liderInput'); if(el){ el.style.display='flex'; document.getElementById('newLiderEmail').focus(); } }
function adminAddLider(id){ const inp=document.getElementById('newLiderEmail'); const e=(inp&&inp.value||'').trim(); if(!e){ if(inp)inp.focus(); return; } const m=_mis(id); m.lideres=m.lideres||[]; m.lideres.push(e); saveConfig(); renderAdmin(); }
function adminDelLider(id,i){ const m=_mis(id); m.lideres.splice(i,1); saveConfig(); renderAdmin(); }
function adminSetAct(mid,aid,campo,val){ const a=_act(mid,aid); if(!a)return;
  if(campo==='nombre_es'){ a.nombre.es=val; } else if(campo==='duracionMin'){ a.duracionMin=val?parseInt(val,10):null; }
  else if(campo==='activo'){ a.activo=val; } else { a[campo]=val; }
  saveConfig(); if(campo==='horaInicio'||campo==='duracionMin'||campo==='activo'||campo==='nombre_es') renderAdmin(); }
function adminSetRec(mid,aid,campo,val){ const a=_act(mid,aid); if(!a)return; a.recurrencia=a.recurrencia||{};
  if(campo==='tipo'){ a.recurrencia={ tipo:val, weekday:6, ordinal:1, day:1, fechas:[] }; }
  else if(campo==='weekday'||campo==='ordinal'||campo==='day'){ a.recurrencia[campo]=parseInt(val,10); }
  saveConfig(); renderAdmin(); }
function adminSetCap(mid,aid,pi,val){ const a=_act(mid,aid); if(a&&a.plazas[pi]){ a.plazas[pi].cap=parseInt(val,10)||0; saveConfig(); } }
function adminAddPlaza(mid,aid){ const a=_act(mid,aid); const sel=document.getElementById('newrol-'+aid); const rolId=sel?sel.value:null;
  if(a&&rolId){ a.plazas=a.plazas||[]; if(!a.plazas.find(p=>p.rolId===rolId)) a.plazas.push({rolId,cap:1}); saveConfig(); renderAdmin(); } }
function adminDelPlaza(mid,aid,pi){ const a=_act(mid,aid); a.plazas.splice(pi,1); saveConfig(); renderAdmin(); }
function adminAddAct(mid){ const m=_mis(mid); const id='a'+Date.now();
  m.actividades.push({ id, nombre:{es:'Nueva actividad',pt:'Nova atividade'}, horaInicio:'10:00', duracionMin:120, activo:true, recurrencia:{tipo:'mensal_posicao',weekday:6,ordinal:1}, plazas:[], checklistTemplate:[] });
  saveConfig(); renderAdmin(); }
function adminDelAct(mid,aid){ const m=_mis(mid); m.actividades=m.actividades.filter(a=>a.id!==aid); saveConfig(); renderAdmin(); toast('Actividad eliminada'); }
function adminDelMision(id){ const cfg=window.CFMS.getConfig(); cfg.misiones=cfg.misiones.filter(m=>m.id!==id); saveConfig(); adminGo('list'); toast('Misión eliminada'); }
window.adminSetMision=adminSetMision; window.adminSetColor=adminSetColor; window.adminAddLider=adminAddLider; window.adminDelLider=adminDelLider; window.adminShowLiderInput=adminShowLiderInput;
window.adminSetAct=adminSetAct; window.adminSetRec=adminSetRec; window.adminSetCap=adminSetCap; window.adminAddPlaza=adminAddPlaza; window.adminDelPlaza=adminDelPlaza;
window.adminAddAct=adminAddAct; window.adminDelAct=adminDelAct; window.adminDelMision=adminDelMision;

/* ---------- ADMIN · ACCESOS Y USUARIOS ---------- */
let ACC_SEARCH = '';
let ACC_EXPANDED = null;   // telefono expandido
function renderAdminAccesos(box, cfg){
  const perm = PERMISOS || { admins:[], lideres:{} };
  const misOpts = cfg.misiones.map(m=>`<option value="${m.id}">${m.nombre}</option>`).join('');
  // ADMINS
  const admins = (perm.admins||[]).map(e=>`<span class="chip">${e} <span class="x" onclick="accDel('${e}','admin','')">×</span></span>`).join('') || '<span class="admnote" style="padding:0">Sin admins (fallback).</span>';
  // LÍDERES (email → [misiones])
  let lideresHtml='';
  Object.keys(perm.lideres||{}).forEach(e=>{
    (perm.lideres[e]||[]).forEach(mid=>{
      lideresHtml += `<span class="chip">${e} · ${window.CFMS.misionLabel(mid)} <span class="x" onclick="accDel('${e}','lider','${mid}')">×</span></span>`;
    });
  });
  if(!lideresHtml) lideresHtml='<span class="admnote" style="padding:0">Sin líderes.</span>';
  // VOLUNTARIOS con búsqueda
  const q = norm(ACC_SEARCH.trim());
  const vols = SERVER_VOLS.filter(v=>{
    if(!q) return true;
    return norm(String(v.nombre||'')).includes(q) || String(v.telefono||'').includes(ACC_SEARCH.trim());
  });
  const volCards = vols.map(v=>{
    const tel=String(v.telefono||''); const exp = ACC_EXPANDED===tel;
    const em = String(v.email||'');
    const esAdmin = em && (perm.admins||[]).indexOf(em.toLowerCase())>=0;
    const esLider = em && perm.lideres && perm.lideres[em.toLowerCase()] && perm.lideres[em.toLowerCase()].length;
    const badge = esAdmin?'<span class="acc-role admin">Admin</span>':esLider?'<span class="acc-role lider">Líder</span>':'';
    const acciones = exp ? `<div class="acc-exp">
        ${em?`<div class="acc-email">${em}</div>`:'<div class="acc-email muted">sin email Google — no puede ser admin/líder aún</div>'}
        ${em?`<div class="acc-btns">
          <button class="miniadd" onclick="accSet('${em}','admin','')">+ Admin</button>
          <span class="acc-lider-add"><select id="accMis-${tel}">${misOpts}</select><button class="miniadd" onclick="accSetLider('${em}','${tel}')">+ Líder</button></span>
        </div>`:''}
      </div>` : '';
    return `<div class="acc-card ${exp?'open':''}">
      <div class="acc-h" onclick="accToggle('${tel}')">
        <div class="acc-nm"><div class="n">${v.nombre||'(sin nombre)'}</div><div class="s">${tel}</div></div>
        ${badge}<span class="caret">▾</span>
      </div>${acciones}</div>`;
  }).join('');

  box.innerHTML = `
    <div class="adm-head"><button class="back" onclick="adminGo('list')">‹</button><div><div class="ah-t">Accesos y usuarios</div><div class="ah-s">Permisos + voluntarios</div></div></div>
    <div class="sec-t">Administradores</div>
    <div class="chips">${admins}</div>
    <div class="acc-add"><input type="email" id="accAdminEmail" placeholder="email@gmail.com" /><button class="miniadd" onclick="accAddAdmin()">+ Admin</button></div>
    <div class="sec-t">Líderes</div>
    <div class="chips">${lideresHtml}</div>
    <div class="acc-add"><input type="email" id="accLiderEmail" placeholder="email@gmail.com" /><select id="accLiderMis">${misOpts}</select><button class="miniadd" onclick="accAddLider()">+ Líder</button></div>
    <div class="sec-t">Voluntarios registrados (${SERVER_VOLS.length})</div>
    <div class="acc-search"><input type="search" id="accSearch" placeholder="Buscar nombre o teléfono…" value="${ACC_SEARCH.replace(/"/g,'&quot;')}" oninput="accSearchInput(this.value)" /></div>
    ${volCards || '<div class="admnote">Sin voluntarios que coincidan.</div>'}
    <div class="admnote">Los permisos se guardan en el servidor (pestaña Admin) y valen para todos.</div>`;
  // mantener foco en la búsqueda tras re-render
  var si=document.getElementById('accSearch'); if(si && ACC_SEARCH){ si.focus(); si.setSelectionRange(si.value.length,si.value.length); }
}
let _accSearchT=null;
function accSearchInput(v){ ACC_SEARCH=v; clearTimeout(_accSearchT); _accSearchT=setTimeout(renderAdmin, 220); } // debounce
function accToggle(tel){ ACC_EXPANDED = (ACC_EXPANDED===tel)?null:tel; renderAdmin(); }
/* llamadas al backend (solo admin) vía cola */
function _accPerm(action, email, papel, mision){
  if(!window.MFSync || !window.MFSync.enabled){ toast('Necesita backend configurado'); return; }
  window.MFSync.queue(action, { email:email, papel:papel, mision:mision||'' }).then(function(){
    // refrescar permisos tras aplicar
    window.MFSync.pull().then(function(res){ if(res&&res.data&&res.data.permisos){ setPermisos(res.data.permisos); if(res.data.voluntarios) setServerVols(res.data.voluntarios); renderAdmin(); } });
  });
  toast('Guardando…');
}
function accAddAdmin(){ var e=(document.getElementById('accAdminEmail').value||'').trim().toLowerCase(); if(!e)return; _accPerm('setPermiso',e,'admin',''); }
function accAddLider(){ var e=(document.getElementById('accLiderEmail').value||'').trim().toLowerCase(); var m=document.getElementById('accLiderMis').value; if(!e)return; _accPerm('setPermiso',e,'lider',m); }
function accSet(email,papel,mis){ _accPerm('setPermiso',email,papel,mis); }
function accSetLider(email,tel){ var m=document.getElementById('accMis-'+tel).value; _accPerm('setPermiso',email,'lider',m); }
function accDel(email,papel,mis){ _accPerm('delPermiso',email,papel,mis); }
window.accSearchInput=accSearchInput; window.accToggle=accToggle; window.accAddAdmin=accAddAdmin; window.accAddLider=accAddLider; window.accSet=accSet; window.accSetLider=accSetLider; window.accDel=accDel;

function renderAdminRoles(box, cfg){
  const roles=cfg.roles.map((r,i)=>`<div class="card"><div class="row">
    <div class="rt"><div class="n">${r.nombre[LANG]}</div><div class="s">${r.requisito?('Requisito: '+(r.requisito[LANG]||r.requisito.es)):'Sin requisito'}</div></div>
    <span class="x" style="opacity:.4;cursor:pointer;font-size:18px" onclick="adminDelRol(${i})">×</span></div></div>`).join('');
  box.innerHTML = `
    <div class="adm-head"><button class="back" onclick="adminGo('list')">‹</button><div><div class="ah-t">Roles</div><div class="ah-s">Catálogo global · reutilizable</div></div></div>
    ${roles}
    <div class="sec-t">Nuevo rol</div>
    <div class="card" style="padding:14px 15px">
      <div class="fld"><label>Nombre (ES)</label><input id="newRolName" placeholder="Ej. Cocina" /></div>
      <div class="fld"><label>Requisito (opcional)</label><input id="newRolReq" placeholder="Ej. carné manipulador" /></div>
      <button class="btn primary" onclick="adminNewRol()">Añadir rol</button>
    </div>
    <div class="admnote">Los roles se reutilizan entre misiones. Editar un rol lo actualiza en todas.</div>`;
}
function adminNewRol(){
  const nombre=(document.getElementById('newRolName').value||'').trim(); if(!nombre) { document.getElementById('newRolName').focus(); return; }
  const req=(document.getElementById('newRolReq').value||'').trim();
  const cfg=window.CFMS.getConfig(); const id='r'+Date.now();
  cfg.roles.push({ id, nombre:{es:nombre,pt:nombre}, requisito: req?{es:req,pt:req}:undefined, activo:true }); saveConfig(); renderAdmin();
}
function adminDelRol(i){ const cfg=window.CFMS.getConfig(); const r=cfg.roles[i];
  const enUso=cfg.misiones.some(m=>m.actividades.some(a=>(a.plazas||[]).some(p=>p.rolId===r.id)));
  if(enUso){ toast('No se puede eliminar: el rol está en uso.'); return; }
  cfg.roles.splice(i,1); saveConfig(); renderAdmin();
}
window.adminNewRol=adminNewRol; window.adminDelRol=adminDelRol;

/* ---------- CHECKLIST DEL LÍDER ----------
   Plantilla: vive en CONFIG (act.checklistTemplate) — se guarda con saveConfig.
   Instancia: estado por ocurrencia en localStorage 'mf_chk' = { activityId: { items:[{id,texto,done,doneBy,asignado,suelto}] } } */
let CHK = {};
function loadChk(){ try{ CHK=JSON.parse(localStorage.getItem('mf_chk')||'{}'); }catch(e){ CHK={}; } }
function saveChk(){ localStorage.setItem('mf_chk', JSON.stringify(CHK)); }
let chkCtx = { activityId:null, view:'inst' };

/* materializa la instancia: fusiona plantilla (de CONFIG) + estado guardado + sueltos */
function chkInstance(activity){
  const tpl = activity.checklistTemplate || [];
  const saved = (CHK[activity.id] && CHK[activity.id].items) ? CHK[activity.id].items : [];
  const byId = {}; saved.forEach(it=>{ byId[it.id]=it; });
  const items = [];
  // items de plantilla (heredan estado guardado si existe)
  tpl.slice().sort((a,b)=>(a.orden||0)-(b.orden||0)).forEach(t=>{
    const s = byId[t.id] || {};
    items.push({ id:t.id, texto:(t.texto[LANG]||t.texto.es), done:!!s.done, doneBy:s.doneBy||null, asignado:s.asignado||null, suelto:false });
  });
  // items sueltos (guardados que no vienen de plantilla)
  saved.filter(it=>it.suelto).forEach(it=>items.push({ id:it.id, texto:it.texto, done:!!it.done, doneBy:it.doneBy||null, asignado:it.asignado||null, suelto:true }));
  return items;
}
function chkCount(activity){
  const items=chkInstance(activity); if(!items.length) return '';
  const done=items.filter(i=>i.done).length; return ` <span class="chk-n">${done}/${items.length}</span>`;
}
function chkPersistItem(activityId, item){
  CHK[activityId]=CHK[activityId]||{ items:[] };
  const arr=CHK[activityId].items; const i=arr.findIndex(x=>x.id===item.id);
  if(i>=0) arr[i]=item; else arr.push(item);
  saveChk();
}

function openChecklist(activityId){
  chkCtx={ activityId, view:'inst' };
  document.getElementById('chkOverlay').classList.add('active');
  renderChecklist();
}
function closeChecklist(){ document.getElementById('chkOverlay').classList.remove('active'); renderLider(); }
function chkSetView(v){ chkCtx.view=v; document.getElementById('chkBInst').classList.toggle('on',v==='inst'); document.getElementById('chkBTpl').classList.toggle('on',v==='tpl'); renderChecklist(); }
window.openChecklist=openChecklist; window.closeChecklist=closeChecklist; window.chkSetView=chkSetView;

function chkActivity(){ return currentActivities().find(a=>a.id===chkCtx.activityId); }
function renderChecklist(){
  const a=chkActivity(); if(!a){ closeChecklist(); return; }
  const f=fmtFecha(a.data);
  document.getElementById('chkTitle').textContent = a.titulo[LANG];
  const body=document.getElementById('chkBody');
  if(chkCtx.view==='tpl'){ body.innerHTML=renderChkTpl(a); return; }
  // instancia
  const items=chkInstance(a); const done=items.filter(i=>i.done).length;
  const rows=items.map(it=>{
    const asg = it.asignado
      ? (it.asignado.temp ? `<span class="assign temp" onclick="chkAssign('${it.id}')">${it.asignado.name} <span style="font-size:9px">· Temp</span></span>`
                          : `<span class="assign serv" onclick="chkAssign('${it.id}')">${it.asignado.name}</span>`)
      : `<span class="assign none" onclick="chkAssign('${it.id}')">+ Asignar</span>`;
    const suelto = it.suelto ? '<span class="tagsuelto">suelto</span>' : '';
    const delx = it.suelto ? `<span class="x" style="opacity:.4;cursor:pointer;margin-left:auto" onclick="chkDelSuelto('${it.id}')">×</span>` : '';
    return `<div class="item ${it.done?'done':''}">
      <div class="box" onclick="chkToggle('${it.id}')">${it.done?'✓':''}</div>
      <div class="body"><div class="txt">${it.texto}</div><div class="meta">${asg} ${suelto} ${it.done&&it.doneBy?`<span class="doneby">· hecho por ${it.doneBy}</span>`:''}${delx}</div></div></div>`;
  }).join('');
  body.innerHTML = `
    <div class="chk-ctx">${f.w} ${f.d} ${f.m} · ${hhrs(a)} · ${window.CFMS.misionLabel(a.misionId)}</div>
    <div class="prog"><div class="bar"><i style="width:${items.length?Math.round(done/items.length*100):0}%"></i></div><div class="txt">${done} / ${items.length}</div></div>
    ${rows || '<div class="empty">Sin ítems. Añade uno abajo o crea la plantilla.</div>'}
    <div class="addrow"><input id="chkNew" placeholder="Añadir ítem para hoy…" /><button onclick="chkAddSuelto()">+</button></div>
    <div class="note">Los ítems sueltos son solo de hoy · no cambian la plantilla.</div>`;
}
function renderChkTpl(a){
  const mis=window.CFMS.getMision(a.misionId); const act=mis&&mis.actividades.find(x=>x.id===a.templateId);
  const tpl=(act&&act.checklistTemplate)?act.checklistTemplate.slice().sort((x,y)=>(x.orden||0)-(y.orden||0)):[];
  const cfg=window.CFMS.getConfig();
  const rows=tpl.map(t=>`<div class="item"><div class="body"><div class="txt">${t.texto[LANG]||t.texto.es}</div>${t.rolSugerido?`<div class="meta"><span class="assign serv">Rol sugerido: ${window.CFMS.rolLabel(t.rolSugerido,LANG)}</span></div>`:''}</div><span class="x" style="opacity:.4;cursor:pointer;align-self:center" onclick="chkTplDel('${t.id}')">×</span></div>`).join('');
  const rolOpts = `<option value="">Sin rol sugerido</option>` + cfg.roles.map(r=>`<option value="${r.id}">${r.nombre[LANG]}</option>`).join('');
  return `<div class="tpl-note">Editas la <b>plantilla</b> de esta actividad. Se aplica a <b>cada ocurrencia futura</b> de la misión.</div>
    ${rows || '<div class="empty">Plantilla vacía.</div>'}
    <div class="sec-t" style="margin:16px 2px 8px">Añadir ítem</div>
    <div class="fld" style="margin-bottom:8px"><input id="chkTplNew" placeholder="Texto de la tarea…" style="width:100%;padding:13px;border:1px solid var(--linea);border-radius:var(--raio);font-size:15px;font-family:'Jost',sans-serif" /></div>
    <div class="rolerow"><select id="chkTplRol" style="flex:1;padding:11px;border:1px solid var(--linea);border-radius:var(--raio);font-family:'Jost',sans-serif">${rolOpts}</select><button class="miniadd" onclick="chkTplAdd()">+ Añadir</button></div>`;
}

function chkToggle(itemId){
  const a=chkActivity(); const items=chkInstance(a); const it=items.find(x=>x.id===itemId); if(!it)return;
  it.done=!it.done; it.doneBy = it.done ? (USER?USER.name.split(' ')[0]:'—') : null;
  chkPersistItem(a.id, it); renderChecklist();
}
function chkAddSuelto(){
  const a=chkActivity(); const inp=document.getElementById('chkNew'); const txt=(inp.value||'').trim(); if(!txt)return;
  chkPersistItem(a.id, { id:'x'+Date.now(), texto:txt, done:false, asignado:null, suelto:true }); renderChecklist();
}
function chkDelSuelto(itemId){
  const a=chkActivity(); CHK[a.id].items=(CHK[a.id].items||[]).filter(x=>x.id!==itemId); saveChk(); renderChecklist();
}
window.chkToggle=chkToggle; window.chkAddSuelto=chkAddSuelto; window.chkDelSuelto=chkDelSuelto;

/* asignación de tarea (reusa servidores inscritos + temporal) */
let asgItemId=null;
function chkAssign(itemId){
  asgItemId=itemId; const a=chkActivity();
  // candidatos: inscritos demo/adds de esta actividad + temporal + sin asignar
  const cand=[];
  Object.keys(a.roles).forEach(r=>{ inscritosDe(a,r).forEach(n=>{ if(!cand.find(c=>c.name===n)) cand.push({name:n.replace(' (tú)',''), temp:false}); }); });
  const ini=n=>n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  let html=cand.map(c=>`<div class="opt" onclick="chkDoAssign('${c.name.replace(/'/g,"")}',false)"><div class="av">${ini(c.name)}</div><div>${c.name}<div style="font-size:11px;color:var(--gris)">servidor inscrito</div></div></div>`).join('');
  html+=`<div class="opt" onclick="chkAssignTemp()"><div class="av t">+</div><div>Añadir temporal…</div></div>`;
  html+=`<div class="opt" onclick="chkDoAssign(null,false)"><div class="av n">—</div><div>Sin asignar</div></div>`;
  document.getElementById('asgList').innerHTML=html;
  document.getElementById('asgBackdrop').classList.add('on'); document.getElementById('asgSheet').classList.add('on');
}
function chkAssignTemp(){
  document.getElementById('asgList').innerHTML =
    `<div class="fld" style="margin:0"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gris);display:block;margin-bottom:6px">Nombre del temporal</label>
     <div class="rolerow"><input id="asgTempName" placeholder="Ej. Vecino Juan" style="flex:1;padding:13px;border:1px solid var(--linea);border-radius:6px;font-family:'Jost',sans-serif;font-size:15px" />
     <button class="miniadd" onclick="chkAddTempAssign()">Añadir</button></div></div>`;
  setTimeout(()=>{ const el=document.getElementById('asgTempName'); if(el) el.focus(); },150);
}
function chkAddTempAssign(){ const n=(document.getElementById('asgTempName').value||'').trim(); if(!n){ document.getElementById('asgTempName').focus(); return; } chkDoAssign(n, true); }
window.chkAddTempAssign=chkAddTempAssign;
function chkDoAssign(name, temp){
  const a=chkActivity(); const items=chkInstance(a); const it=items.find(x=>x.id===asgItemId); if(!it){ closeAsg(); return; }
  it.asignado = name ? { name, temp:!!temp } : null;
  chkPersistItem(a.id, it); closeAsg(); renderChecklist();
}
function closeAsg(){ document.getElementById('asgBackdrop').classList.remove('on'); document.getElementById('asgSheet').classList.remove('on'); }
window.chkAssign=chkAssign; window.chkAssignTemp=chkAssignTemp; window.chkDoAssign=chkDoAssign; window.closeAsg=closeAsg;

/* editar plantilla (guarda en CONFIG) */
function chkTplAdd(){
  const a=chkActivity(); const inp=document.getElementById('chkTplNew'); const txt=(inp.value||'').trim(); if(!txt){ if(inp)inp.focus(); return; }
  const rolSel=document.getElementById('chkTplRol'); const rol=rolSel?rolSel.value:'';
  const mis=window.CFMS.getMision(a.misionId); const act=mis.actividades.find(x=>x.id===a.templateId);
  act.checklistTemplate=act.checklistTemplate||[];
  const item={ id:'c'+Date.now(), texto:{es:txt,pt:txt}, orden:(act.checklistTemplate.length+1) };
  if(rol) item.rolSugerido=rol;
  act.checklistTemplate.push(item);
  saveConfig(); renderChecklist();
}
function chkTplDel(itemId){
  const a=chkActivity(); const mis=window.CFMS.getMision(a.misionId); const act=mis.actividades.find(x=>x.id===a.templateId);
  act.checklistTemplate=(act.checklistTemplate||[]).filter(t=>t.id!==itemId); saveConfig(); renderChecklist();
}
window.chkTplAdd=chkTplAdd; window.chkTplDel=chkTplDel;

function currentActivities(){ return window.CFMS.generateActivities(cursor.getFullYear(), cursor.getMonth()); }

function fmtFecha(iso){ const d=new Date(iso+'T12:00:00'); return { w:d.toLocaleDateString(LANG==='pt'?'pt-BR':'es-ES',{weekday:'short'}), d:d.getDate(), m:d.toLocaleDateString(LANG==='pt'?'pt-BR':'es-ES',{month:'short'}) }; }
function hhrs(a){ return a && a.horaFin ? (a.hora+'–'+a.horaFin) : (a?a.hora:''); }
function ringClass(rest,cap){ if(rest<=0) return 'cheio'; if(rest<=Math.max(1,Math.floor(cap*0.3))) return 'pouco'; return ''; }
function totalCap(a){ return Object.values(a.roles).reduce((s,c)=>s+c,0); }
function totalLibres(a){ return Object.keys(a.roles).reduce((s,r)=>s+libresRol(a,r),0); }

function actCardHTML(a, opts={}){
  const tipo = tipoDe(a.templateId); const f = fmtFecha(a.data);
  const libres = totalLibres(a); const cap = totalCap(a);
  const mine = INSCR[a.id];
  const enEspera = opts.espera && MI_ESPERA[a.id];
  const roleId = mine || MI_ESPERA[a.id];
  const roleLabel = roleId ? (window.CFMS.ROLES[roleId] ? window.CFMS.ROLES[roleId].label[LANG] : roleId) : '';
  let right = '', check = '', tag = '';
  if(enEspera){
    check = `<div class="mini-check" style="color:var(--warn)">⏳ En lista de espera (${roleLabel})</div>`;
  } else if(mine){
    check = `<div class="mini-check">✓ ${opts.mios?'Confirmado':'Estás apuntado'} (${roleLabel})</div>`;
  } else {
    tag = `<span class="tag">${a.titulo[LANG].split(" ")[0]} · ${window.CFMS.cadenaLabel(a.cadeia)}</span>`;
    right = `<div class="vagas"><span class="ring ${ringClass(libres,cap)}">${libres} / ${cap}</span></div>`;
  }
  return `<div class="act t-${tipo} ${mine?'estado-inscrito':''} ${enEspera?'estado-espera':''}" onclick="openWizard('${a.id}')">
    <div class="tipo-bar"></div>
    <div class="fecha"><div class="w">${f.w}</div><div class="d">${f.d}</div><div class="m">${f.m}</div></div>
    <div class="info"><div class="t">${a.titulo[LANG]}</div><div class="sub">${hhrs(a)} · ${a.notes?a.notes[LANG]:''}</div>${check||tag}</div>
    ${right}</div>`;
}

function renderAll(){ renderInicio(); renderAgenda(); renderMios(); renderLider(); renderAdmin(); }

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
      <div class="meta">${f.w} ${f.d} ${f.m} · ${hhrs(hero)} — ${window.CFMS.cadenaLabel(hero.cadeia)}</div>
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
  const acts = currentActivities();
  const confirmadas = acts.filter(a=>INSCR[a.id]);
  const espera = acts.filter(a=>MI_ESPERA[a.id]);
  let html = '';
  if(confirmadas.length) html += confirmadas.map(a=>actCardHTML(a,{mios:true})).join('');
  if(espera.length){
    html += '<div class="section-title" style="margin-top:18px">En lista de espera</div>';
    html += espera.map(a=>actCardHTML(a,{mios:true, espera:true})).join('');
  }
  document.getElementById('miosList').innerHTML = html || '<div class="empty">Aún no estás apuntado a ninguna actividad este mes.</div>';
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
  if(actId){
    const a = currentActivities().find(x=>x.id===actId);
    const roleIds = a ? Object.keys(a.roles) : [];
    if(INSCR[actId]) wzState.roles[actId] = INSCR[actId];      // función ya inscrita
    else if(roleIds.length===1) wzState.roles[actId] = roleIds[0]; // función única -> auto
  }
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
    const lleno = libres<=0;
    const estado = lleno ? '<span style="color:var(--warn)">Completo · lista de espera</span>'
                         : `${f.w} ${f.d} ${f.m} · ${hhrs(x)} · ${window.CFMS.cadenaLabel(x.cadeia)}`;
    return `<div class="opt ${sel} ${lleno?'espera':''}" data-act="${x.id}" onclick="wzToggleAct('${x.id}')">
      <div class="oic">${lleno?'⏳':ICON_TIPO[tipo]}</div>
      <div class="otxt"><div class="ot">${x.titulo[LANG]}</div><div class="os">${estado}</div></div>
      <div class="ocheck">✓</div></div>`;
  }).join('');
}
function wzToggleAct(id){
  const i = wzState.acts.indexOf(id);
  if(i>=0){ wzState.acts.splice(i,1); delete wzState.roles[id]; }
  else {
    wzState.acts.push(id);
    // si la actividad tiene UNA sola función, se asigna automáticamente
    const a = currentActivities().find(x=>x.id===id);
    const roleIds = a ? Object.keys(a.roles) : [];
    if(roleIds.length===1) wzState.roles[id] = roleIds[0];
  }
  document.querySelector(`#wzActs .opt[data-act="${id}"]`).classList.toggle('sel', wzState.acts.includes(id));
}

/* actividades seleccionadas que requieren ELECCIÓN de función (más de 1 rol) */
function actsNeedingRole(){
  const acts = currentActivities();
  return wzState.acts.map(id=>acts.find(a=>a.id===id)).filter(a=>a && Object.keys(a.roles).length>1);
}

/* PASO 2 — función por cada actividad seleccionada (una sección por actividad) */
function buildRoles(){
  const sel = actsNeedingRole().sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
  document.getElementById('wzRoleHint').textContent = sel.length>1
    ? `Estas actividades tienen varias funciones. Elige la tuya en cada una.`
    : 'Esta actividad tiene varias funciones. Elige la tuya.';
  document.getElementById('wzRoles').innerHTML = sel.map(a=>{
    const f=fmtFecha(a.data);
    const opts = Object.keys(a.roles).map(rid=>{
      const rd=window.CFMS.ROLES[rid]; const rest=libresRol(a,rid);
      const chosen = wzState.roles[a.id]===rid ? 'sel':'';
      const req = rd&&rd.requiresFurgoneta ? ' · requiere furgoneta' : '';
      const lleno = rest<=0;
      const estado = lleno
        ? `<span style="color:var(--warn)">Completo · entrarás en lista de espera</span>`
        : `Quedan ${rest} de ${a.roles[rid]}${req}`;
      return `<div class="opt ${chosen} ${lleno?'espera':''}" data-act="${a.id}" data-role="${rid}" onclick="wzPickRole('${a.id}','${rid}')">
        <div class="oic">${lleno?'⏳':ICON_TIPO[tipoDe(a.templateId)]}</div>
        <div class="otxt"><div class="ot">${rd?rd.label[LANG]:rid}</div><div class="os">${estado}</div></div>
        <div class="ocheck">✓</div></div>`;
    }).join('');
    return `<div class="role-group"><div class="role-group-h"><span class="rg-t">${a.titulo[LANG]}</span><span class="rg-d">${f.w} ${f.d} ${f.m} · ${hhrs(a)}</span></div>${opts}</div>`;
  }).join('');
}
function wzPickRole(actId, rid){
  wzState.roles[actId]=rid;
  document.querySelectorAll(`#wzRoles .opt[data-act="${actId}"]`).forEach(o=>o.classList.toggle('sel', o.dataset.role===rid));
}
window.openWizard=openWizard; window.closeWizard=closeWizard; window.wzToggleAct=wzToggleAct; window.wzPickRole=wzPickRole;

function resetFoot(){ document.getElementById('wzFoot').innerHTML='<button class="back hidden" id="wzBack" onclick="prevStep()">Atrás</button><button class="next" id="wzNext" onclick="nextStep()">Continuar</button>'; }
function needsRoleStep(){ return actsNeedingRole().length > 0; }
function renderStep(){
  document.querySelectorAll('.wz-step').forEach(s=>s.classList.remove('active'));
  document.querySelector('.wz-step[data-step="'+wzState.step+'"]').classList.add('active');
  // stepper: ocultar el paso "Función" si no hace falta elegir
  const showRole = needsRoleStep();
  const stFuncion = document.querySelector('.stepper .st[data-s="2"]');
  if(stFuncion) stFuncion.style.display = showRole ? '' : 'none';
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
      <span class="v">${window.CFMS.ROLES[r]?window.CFMS.ROLES[r].label[LANG]:'—'}${actsNeedingRole().some(x=>x.id===a.id)?` <button class="edit" onclick="gotoStep(2)">Cambiar</button>`:''}</span></div>`;
  }).join('');
}
function gotoStep(s){ wzState.step=s; renderStep(); } window.gotoStep=gotoStep;
function nextStep(){
  if(wzState.step===1){
    if(wzState.acts.length===0) return;
    wzState.step = needsRoleStep() ? 2 : 3;   // salta Función si no hace falta
    renderStep();
  }
  else if(wzState.step===2){
    const faltan = actsNeedingRole().filter(a=>!wzState.roles[a.id]);
    if(faltan.length){ return; }
    wzState.step=3; renderStep();
  }
  else { confirmInscr(); }
}
function prevStep(){
  if(wzState.step===3){ wzState.step = needsRoleStep() ? 2 : 1; renderStep(); }
  else if(wzState.step>1){ wzState.step--; renderStep(); }
}
window.nextStep=nextStep; window.prevStep=prevStep;

function confirmInscr(){
  const sel = selectedActsSorted();
  sel.forEach(a=>{
    const r = wzState.roles[a.id];
    if(libresRol(a,r) > 0){ INSCR[a.id]=r; delete MI_ESPERA[a.id]; }   // hay plaza -> confirmado
    else { MI_ESPERA[a.id]=r; delete INSCR[a.id]; }                    // lleno -> lista de espera
  });
  saveInscr(); saveEspera();
  document.querySelectorAll('.wz-step').forEach(s=>s.classList.remove('active'));
  document.querySelector('.wz-step[data-step="ok"]').classList.add('active');
  document.getElementById('stepper').style.visibility='hidden';
  document.getElementById('wzOkResumo').innerHTML = sel.map(a=>{
    const f=fmtFecha(a.data); const r=wzState.roles[a.id]; const espera = !!MI_ESPERA[a.id];
    return `<div class="row"><span class="k">${a.titulo[LANG]}<br><span style="text-transform:none;letter-spacing:0;font-size:12px">${f.w} ${f.d} ${f.m} · ${a.hora}</span></span><span class="v">${window.CFMS.ROLES[r]?window.CFMS.ROLES[r].label[LANG]:r}${espera?' <span style="color:var(--warn);font-size:11px">· en espera</span>':''}</span></div>`;
  }).join('');
  const anyEspera = sel.some(a=>MI_ESPERA[a.id]);
  const okTitle = document.querySelector('.wz-step[data-step="ok"] h2');
  if(okTitle) okTitle.textContent = anyEspera ? '¡Estás en la lista!' : '¡Estás apuntado!';
  document.getElementById('wzFoot').innerHTML='<button class="next" onclick="closeWizard();renderAll();go(\'v-mios\')">Listo</button>';
}

/* ---------- ACTUALIZACIÓN DE VERSIÓN (patrón Gideão) ---------- */
var newVersionAvail = null, bannerShown = false, updating = false;
function applyUpdate(btn){
  if(updating) return; updating = true;
  if(btn){ btn.disabled = true; btn.textContent = 'Actualizando…'; }
  (async function(){
    try{
      if('caches' in window){ var keys = await caches.keys(); await Promise.all(keys.map(function(k){ return caches.delete(k); })); }
      if('serviceWorker' in navigator){ var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function(r){ return r.update().catch(function(){}); })); }
    }catch(e){}
    setTimeout(function(){ location.reload(); }, 300);
  })();
}
function dismissUpdate(){
  var b=document.getElementById('updateBanner'); if(b) b.style.display='none'; bannerShown=false;
  try{ if(newVersionAvail) sessionStorage.setItem('mf_dismissedVer', newVersionAvail); }catch(e){}
}
window.applyUpdate=applyUpdate; window.dismissUpdate=dismissUpdate;
function showUpdateBanner(ver){
  if(bannerShown) return;
  try{ if(ver && sessionStorage.getItem('mf_dismissedVer')===ver) return; }catch(e){}
  bannerShown = true;
  document.getElementById('updateMsg').textContent = 'Nueva versión disponible' + (ver?(' ('+ver+')'):'');
  document.getElementById('updateBanner').style.display = 'flex';
  // en la pantalla de login también mostramos el aviso
  var nv=document.getElementById('loginNewVer'); if(nv){ nv.textContent = 'Nueva versión disponible — toca para actualizar'; nv.onclick=function(){ applyUpdate(); }; }
}
function checkVersion(){
  fetch('version.json?ts=' + Date.now(), { cache:'no-store' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if(d && d.version && d.version !== window.CFMS.APP_VERSION){ newVersionAvail = d.version; showUpdateBanner(d.version); } })
    .catch(function(){ /* offline: ignora */ });
}

/* ---------- init ---------- */
document.getElementById('ver').textContent = window.CFMS.APP_VERSION;
var lv=document.getElementById('loginVer'); if(lv) lv.textContent = 'v' + window.CFMS.APP_VERSION;
checkVersion();
document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkVersion(); });
setInterval(checkVersion, 30*60*1000);
fillDdi(document.getElementById('ddi1'));
fillDdi(document.getElementById('ddi2'));
fillDdi(document.getElementById('tDdi'));
document.getElementById('prev').onclick = ()=>{ cursor.setMonth(cursor.getMonth()-1); renderAll(); };
document.getElementById('next').onclick = ()=>{ cursor.setMonth(cursor.getMonth()+1); renderAll(); };
document.getElementById('prevL').onclick = ()=>{ cursor.setMonth(cursor.getMonth()-1); renderAll(); };
document.getElementById('nextL').onclick = ()=>{ cursor.setMonth(cursor.getMonth()+1); renderAll(); };
loadConfig();
loadState();
loadAdds();
loadChk();
if(USER){ document.getElementById('loginGate').style.display='none'; startApp(); }

/* ---------- SYNC con backend (si está configurado) ---------- */
function renderSyncBadge(s){
  var el=document.getElementById('syncBadge'); if(!el) return;
  var map={ ok:['✓','sincronizado','#4f9d69'], pending:['⏳','pendiente','#d9a90a'], syncing:['↻','sincronizando…','#d9a90a'],
            offline:['⚡','sin conexión','#c2560c'], error:['⚠','error de sync','#c2560c'], off:['','',''] };
  var m=map[s]||map.off;
  el.style.display = m[0] ? 'inline-flex' : 'none';
  el.style.color = m[2]; el.innerHTML = m[0] ? (m[0]+' <span>'+m[1]+'</span>') : '';
}
if(window.MFSync){
  window.MFSync.onStatus(renderSyncBadge);
  window.MFSync.init().then(function(res){
    if(res && res.data){
      if(res.data.permisos) setPermisos(res.data.permisos);
      if(res.data.voluntarios) setServerVols(res.data.voluntarios);
      if(res.data.config && res.data.config.misiones){
        window.CFMS.setConfig(res.data.config);
        localStorage.setItem('mf_config', JSON.stringify(res.data.config));
      }
      if(USER){ renderDemoBar(); renderAll(); }
    }
  });
}
