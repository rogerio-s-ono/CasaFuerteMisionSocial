/* Manos Fuertes — ui.js
   Camada de UI: login (teléfono/Google), dashboard, agenda (via CFMS.generateActivities),
   wizard de inscrição. Persistência LOCAL (localStorage) neste piloto — backend (Google
   Sheets) entra depois. Design aprovado v6 (login) + tons por tipo.  */
'use strict';

/* ---------- estado ---------- */
let LANG = (function(){
  try{ var saved = localStorage.getItem('mf_lang'); if(saved==='es'||saved==='pt') return saved; }catch(e){}
  return (window.CFMS_CONFIG && window.CFMS_CONFIG.DEFAULT_LANG) || 'es';
})();
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
/* (datos demo de inscripciones/espera/servidores removidos en v0.16.0 — usa solo datos reales del backend) */
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
let SERVER_INSCR = [];  // inscripciones del servidor (pestaña Inscripciones)
var LIVE = !!(window.MFSync && window.MFSync.enabled);  // backend activo → usar solo datos reales
function setPermisos(p){ PERMISOS = p || null; }
function setServerInscr(v){ SERVER_INSCR = Array.isArray(v)?v:[]; }
function setServerVols(v){
  var arr = Array.isArray(v) ? v : [];
  // deduplicar por teléfono (solo dígitos) — nos quedamos con el más reciente (último)
  var byTel = {};
  arr.forEach(function(r){ var k=String(r.telefono==null?'':r.telefono).replace(/[^0-9]/g,''); if(k) byTel[k]=r; });
  SERVER_VOLS = Object.keys(byTel).map(function(k){ return byTel[k]; });
}
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
/* inscritos (reales del servidor) por actividad/rol — nombres para mostrar */
function inscritosDe(activity, roleId){
  return SERVER_INSCR.filter(function(r){ return r.activityId===activity.id && r.rol===roleId && r.estado==='confirmado'; })
                     .map(function(r){ return r.temp ? (r.nombre||'Temporal') : _volName(r.voluntario); });
}
/* nombre del voluntario por su teléfono (para mostrar en vez del número) */
function _volName(tel){ var k=String(tel).replace(/[^0-9]/g,''); var v=SERVER_VOLS.find(function(x){ return String(x.telefono).replace(/[^0-9]/g,'')===k; }); return v?v.nombre:String(tel); }
/* inscritos REALES del servidor (solo LIVE) con datos completos, para el modal de detalle/quitar del líder */
function inscritosDetalle(activity, roleId){
  if(!LIVE) return [];
  return SERVER_INSCR.filter(function(r){ return r.activityId===activity.id && r.rol===roleId && r.estado==='confirmado'; })
    .map(function(r){
      var temp = (r.temp===true || String(r.temp).toLowerCase()==='true');
      return { id:r.id, tel:String(r.voluntario), name: temp ? (r.nombre||'Temporal') : _volName(r.voluntario), temp:temp, estado:r.estado };
    });
}
function esperaDe(activity, roleId){
  return SERVER_INSCR.filter(function(r){ return r.activityId===activity.id && r.rol===roleId && r.estado==='espera'; })
                     .map(function(r){ return r.temp ? (r.nombre||'Temporal') : _volName(r.voluntario); });
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

/* busca un voluntario del servidor por teléfono (para reconocer usuarios creados por el Admin) */
function volByTelServer(full){
  var k=normPhone(full);
  var v=(SERVER_VOLS||[]).find(function(r){ return String(r.telefono).replace(/[^0-9]/g,'')===k; });
  return v ? { name:v.nombre, phone:String(v.telefono), email:String(v.email||'') } : null;
}
function submitPhone(){
  const ddi = document.getElementById('ddi1').value;
  const local = normPhone(document.getElementById('inPhone').value.trim());
  if(local.length < 6){ document.getElementById('inPhone').focus(); return; }
  const full = ddi + local;
  // login por teléfono: limpiar cualquier idToken de una sesión Google anterior (p.ej. del Admin)
  // para que el backend NO estampe el email de otra persona en este usuario.
  try{ sessionStorage.removeItem('mf_idtoken'); }catch(e){}
  window._googleEmail='';
  // 1) ¿existe en el SERVIDOR (creado por el Admin o registrado en otro dispositivo)?
  var srv = volByTelServer(full);
  if(srv && srv.name){ USER={ name:srv.name, phone:srv.phone, email:srv.email||'' }; enter('Entrando…'); return; }
  // 2) ¿base local de este dispositivo?
  const known = knownUsers();
  if(known[full]){ USER={ name:known[full], phone:full }; enter('Entrando…'); return; }
  // 3) por si el pull inicial aún no trajo voluntarios: pull fresco y reintenta
  if(window.MFSync && window.MFSync.enabled){
    document.getElementById('lgCheckTxt').textContent='Entrando…';
    document.getElementById('panelPhone').classList.add('hidden');
    document.getElementById('lgChecking').classList.add('on');
    window.MFSync.pull().then(function(res){
      if(res && res.data && res.data.voluntarios){ setServerVols(res.data.voluntarios); if(res.data.permisos) setPermisos(res.data.permisos); }
      var s2 = volByTelServer(full);
      if(s2 && s2.name){ USER={ name:s2.name, phone:s2.phone, email:s2.email||'' }; enter('Entrando…'); return; }
      document.getElementById('lgChecking').classList.remove('on');
      _phoneFirstTime(ddi, local);   // 1ª vez → pedir nombre
    }).catch(function(){
      document.getElementById('lgChecking').classList.remove('on');
      _phoneFirstTime(ddi, local);
    });
    return;
  }
  // 4) sin servidor → 1ª vez
  _phoneFirstTime(ddi, local);
}
/* muestra el formulario de nombre (1ª vez con teléfono) */
function _phoneFirstTime(ddi, local){
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('ddi2').value = ddi;
  document.getElementById('regPhone').value = local;
  document.getElementById('regName').value = '';
  document.getElementById('regWelcome').innerHTML = 'Parece que es tu primera vez. <b>¡Bienvenido!</b> Solo necesitamos tu nombre.';
  var back=document.querySelector('#panelRegister .lg-back'); if(back) back.style.display='';
  document.getElementById('panelRegister').classList.remove('hidden');
  setTimeout(()=>document.getElementById('regName').focus(),200);
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
  // 3) por si el pull inicial aún no trajo voluntarios: pull fresco y reintenta.
  //    Mostramos "Entrando…" desde ya (ocultando los botones de login); si el usuario
  //    existe seguimos entrando, si es 1ª vez pedimos teléfono, y si FALLA volvemos a los botones.
  if(window.MFSync && window.MFSync.enabled){
    _showEntering();
    window.MFSync.pull().then(function(res){
      if(res && res.data && res.data.voluntarios){ setServerVols(res.data.voluntarios); if(res.data.permisos) setPermisos(res.data.permisos); }
      var s2 = volByEmail(email);
      if(s2 && s2.phone){ USER={ name:s2.name||nombre, phone:s2.phone, email:email }; enter('Entrando…'); return; }
      // si el pull falló (sin datos utilizables) → volver a los botones de login
      if(res && res.error && !(res.data && res.data.voluntarios)){
        _backToLogin();
        toast && toast('No se pudo conectar. Inténtalo de nuevo.');
        return;
      }
      // pull ok pero el email no está registrado → 1ª vez: pedir teléfono
      _googleFirstTime(nombre, email);
    }).catch(function(){
      // salvaguarda: cualquier rechazo inesperado → volver a los botones de login
      _backToLogin();
      toast && toast('No se pudo conectar. Inténtalo de nuevo.');
    });
    return;
  }
  // 4) sin servidor → pide teléfono (1ª vez)
  _googleFirstTime(nombre, email);
}
/* muestra el estado "Entrando…" ocultando los paneles de login (Google/teléfono) */
function _showEntering(){
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('lgCheckTxt').textContent = 'Entrando…';
  document.getElementById('lgChecking').classList.add('on');
}
/* vuelve a la pantalla inicial con los botones de login (tras un fallo) */
function _backToLogin(){
  document.getElementById('lgChecking').classList.remove('on');
  document.getElementById('panelRegister').classList.add('hidden');
  document.getElementById('panelPhone').classList.remove('hidden');
}
function _googleFirstTime(nombre, email){
  // oculta el spinner "Entrando…" antes de mostrar el formulario de teléfono (1ª vez)
  document.getElementById('lgChecking').classList.remove('on');
  document.getElementById('panelPhone').classList.add('hidden');
  document.getElementById('ddi2').disabled=false; document.getElementById('ddi2').value='+34';
  document.getElementById('regPhone').value=''; document.getElementById('regPhone').removeAttribute('readonly');
  document.getElementById('regPhone').placeholder='600 000 000';
  document.getElementById('regName').value=nombre||'';
  document.getElementById('regWelcome').innerHTML= email
    ? 'Primera vez con Google. <b>¡Bienvenido!</b> Confirma tu nombre y añade tu teléfono (para los recordatorios por WhatsApp).'
    : 'Primera vez. <b>¡Bienvenido!</b> Solo necesitamos tu nombre y teléfono.';
  // quando vem do Google não faz sentido voltar para escolher método de login
  var backBtn = document.querySelector('#panelRegister .lg-back');
  if(backBtn) backBtn.style.display = email ? 'none' : '';
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
  // restaurar visibilidade do botão voltar para o próximo uso
  var backBtn = document.querySelector('#panelRegister .lg-back');
  if(backBtn) backBtn.style.display = '';
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
  // re-render de la gestión de accesos al cambiar conectividad (gate online-only)
  if(!window._accNetBound){
    window._accNetBound = true;
    var onNet = function(){ if(ADMIN_NAV && ADMIN_NAV.screen==='accesos' && ACC_VIEW==='list' && !ACC_BUSY) renderAdmin(); };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
  }
}

/* ---------- MODO DEMO: selector de perfil ---------- */
function renderDemoBar(){
  const bar = document.getElementById('demoBar');
  // Backend activo (LIVE): NUNCA selector demo. El rol viene de la allowlist real (por email).
  if(LIVE){
    if(myEmail() && isAdmin()){ bar.innerHTML='<b>Admin</b> · '+myEmail(); }
    else if(myEmail() && isLider()){ bar.innerHTML='<b>Líder</b> · '+myEmail(); }
    else { bar.style.display='none'; }   // voluntario normal: sin barra
    applyProfile();
    return;
  }
  // modo LOCAL (sin backend): selector demo para probar
  bar.style.display='';
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
  const cap = a.roles[r];
  // SIEMPRE datos reales del servidor (inscritos + añadidos por el líder + temporales).
  // Cada chip abre el detalle (quitar de la tarea). Sin datos demo.
  const insc = inscritosDetalle(a, r);
  const ocup = insc.length;
  const falta = Math.max(0, cap - ocup);
  let html = insc.map(function(p){
    var extra = p.temp ? ' <span class="tg">· Temp</span>' : '';
    return `<span class="chip ${p.temp?'temp':''} clickable" onclick="volDetalle('${a.id}','${r}','${String(p.tel).replace(/'/g,"")}','${String(p.id||'').replace(/'/g,"")}')">${p.name}${extra}</span>`;
  }).join('');
  html += Array.from({length:falta}).map(()=>`<span class="chip vac clickable" onclick="openAddSheet('${a.id}','${r}')">+ vacante</span>`).join('');
  return html || `<span class="chip vac clickable" onclick="openAddSheet('${a.id}','${r}')">+ sin inscritos</span>`;
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
      <div class="lr-h"><span class="lr-name">${rd?rd.label[LANG]:r}</span>
        <span class="lr-right"><button class="lr-add" title="Añadir servidor" onclick="openAddSheet('${a.id}','${r}')">+</button><span class="lr-count ${falta>0?'miss':'full'}">${gente.length}/${cap}${falta>0?` · faltan ${falta}`:' · completo'}</span></span></div>
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
  const liderNombre = LIVE
    ? ((USER && USER.name) ? USER.name : 'Líder')
    : mias.map(c=>(DEMO_LIDERES[c]?DEMO_LIDERES[c].name:c)).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
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
  const fuente = SERVER_VOLS.map(function(x){ return { n:x.nombre, p:String(x.telefono) }; });
  const hits = fuente.filter(s=>norm(String(s.n||'')).includes(q)).slice(0,5);
  const ini = n => n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  let html = hits.map(s=>`<div class="ac-item" onclick="acPick('${s.n.replace(/'/g,"\\'")}','${String(s.p).replace(/'/g,"")}')">
      <div class="av">${ini(s.n)}</div>
      <div class="nm"><div class="n1">${s.n}</div><div class="n2">${s.p}</div></div>
      <span class="tag-reg">registrado</span></div>`).join('');
  html += `<div class="ac-create" onclick="acGoTemp('${(v||'').replace(/'/g,"\\'")}')">
      <div class="plus">+</div>
      <div class="ct"><b>Añadir "${v}"</b><div class="sub">como servidor temporal (solo hoy)</div></div></div>`;
  list.innerHTML = html; list.style.display='block';
}
function acPick(name, tel){ _liderInscribir(addCtx.activityId, addCtx.roleId, { tel:tel||'', nombre:name, temp:false }); closeAddSheet(); }
function acGoTemp(name){
  document.getElementById('addStSearch').style.display='none';
  document.getElementById('addStTemp').style.display='block';
  document.getElementById('tNameLbl').textContent = name || '—';
  document.getElementById('tNameInput').value = name || '';
}
function addTemp(){
  const name = document.getElementById('tNameInput').value.trim() || 'Temporal';
  _liderInscribir(addCtx.activityId, addCtx.roleId, { tel:'', nombre:name, temp:true });
  closeAddSheet();
}
/* el líder inscribe a alguien (real por teléfono o temporal) → PERSISTE en el backend (con cola offline) */
function _liderInscribir(activityId, roleId, who){
  var a = currentActivities().find(function(x){ return x.id===activityId; });
  if(!a){ toast('Actividad no encontrada'); return; }
  var cap = a.roles[roleId] || 0;
  var payload = { inscripcion:{
    activityId:activityId, misionId:a.misionId||'', templateId:a.templateId||'', fecha:a.data||'',
    rol:roleId, capacidad:cap, porLider:true,
    voluntario: who.temp ? '' : String(who.tel||'').replace(/[^0-9]/g,''),
    nombre: who.nombre||'', temp: !!who.temp
  }};
  if(!window.MFSync || !window.MFSync.enabled){ toast('Necesita backend'); return; }
  toast('Añadiendo…');
  window.MFSync.post('inscribir', payload).then(function(j){
    if(j && j.ok){
      // reflejar de inmediato en local sin esperar el pull
      SERVER_INSCR.push({ id:(j.id||'_local_'+Date.now()), activityId:activityId, rol:roleId,
        voluntario:(j.voluntario|| (who.temp?'temp:local':String(who.tel||'').replace(/[^0-9]/g,''))),
        nombre:who.nombre||'', temp:!!who.temp, estado:(j.estado||'confirmado') });
      toast(j.estado==='espera'?'Añadido a lista de espera':'Añadido');
    } else { toast('No se pudo añadir'); }
    renderLider();
  }).catch(function(){
    // offline → encola y refleja local optimista
    window.MFSync.queue('inscribir', payload);
    SERVER_INSCR.push({ id:'_local_'+Date.now(), activityId:activityId, rol:roleId,
      voluntario:(who.temp?'temp:local':String(who.tel||'').replace(/[^0-9]/g,'')),
      nombre:who.nombre||'', temp:!!who.temp, estado:'confirmado' });
    toast('Sin conexión — se enviará al reconectar'); renderLider();
  });
}
function delAdd(activityId, roleId, idx){ removeAdd(activityId, roleId, idx); renderLider(); }
window.openAddSheet=openAddSheet; window.closeAddSheet=closeAddSheet; window.acType=acType; window.acBackSearch=acBackSearch;
window.acPick=acPick; window.acGoTemp=acGoTemp; window.addTemp=addTemp; window.delAdd=delAdd;

/* ---------- DETALLE de voluntario asignado (vista líder) → quitar de la tarea con motivo ---------- */
let VOL_CTX = null;      // { activityId, roleId, tel }
let VOL_BUSY = false, _volConfirm = false;
function volDetalle(activityId, roleId, tel, id){
  VOL_CTX = { activityId, roleId, tel, id:id||'' }; _volConfirm=false;
  _renderVolDetalle();
  document.getElementById('usrBackdrop').classList.add('on');
  document.getElementById('usrSheet').classList.add('on');
}
function closeVolDetalle(){ VOL_CTX=null; _volConfirm=false; document.getElementById('usrBackdrop').classList.remove('on'); document.getElementById('usrSheet').classList.remove('on'); }
function _renderVolDetalle(){
  const a = currentActivities().find(x=>x.id===VOL_CTX.activityId);
  const rd = window.CFMS.ROLES[VOL_CTX.roleId];
  var esTemp = String(VOL_CTX.tel||'').indexOf('temp:')===0;
  var rowInsc = SERVER_INSCR.find(function(r){ return (VOL_CTX.id && String(r.id)===String(VOL_CTX.id)) || (String(r.voluntario)===String(VOL_CTX.tel) && r.activityId===VOL_CTX.activityId && r.rol===VOL_CTX.roleId); }) || {};
  const v = esTemp ? {} : (_volByTel(VOL_CTX.tel) || {});
  const nombre = esTemp ? (rowInsc.nombre||'Temporal') : (v.nombre || _volName(VOL_CTX.tel));
  const subLine = esTemp ? 'Servidor temporal' : (VOL_CTX.tel + (v.email?(' · '+v.email):''));
  const f = a ? fmtFecha(a.data) : null;
  const tarea = (a?a.titulo[LANG]:'') + (f?(' · '+f.w+' '+f.d+' '+f.m):'') + (rd?(' · '+rd.label[LANG]):'');
  const dis = VOL_BUSY?'disabled':'';
  const ini = String(nombre).split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('usrBody').innerHTML = `
    <div class="md-icon verde" style="font-family:'Jost',sans-serif;font-weight:600;color:#2f7d4f;font-size:20px">${ini}</div>
    <h3 class="usr-t">${nombre}</h3>
    <div class="usr-sub">${subLine}</div>
    <div class="vd-tarea"><span class="vd-lbl">Asignado a</span>${tarea}</div>
    <div class="usr-sec">Motivo para quitarlo (opcional)</div>
    <textarea id="volMotivo" ${dis} rows="2" placeholder="Ej. avisó que no puede venir" style="width:100%;padding:12px;border:1px solid var(--linea);border-radius:var(--raio);font-family:'Jost',sans-serif;font-size:14px;resize:vertical"></textarea>
    <div class="usr-actions"><button class="btn ghost" ${dis} onclick="closeVolDetalle()">Cerrar</button>
      <button class="btn danger ${_volConfirm?'armed':''}" ${dis} onclick="volQuitar()">${_volConfirm?'¿Seguro? Quitar':'Quitar de la tarea'}</button></div>`;
}
function volQuitar(){
  if(!_volConfirm){ _volConfirm=true; _renderVolDetalle(); return; }   // 1º toque: confirma
  if(!LIVE || !window.MFSync || !window.MFSync.enabled){ toast('Necesita backend'); return; }
  if(VOL_BUSY) return; VOL_BUSY=true; _renderVolDetalle();
  const motivo=(document.getElementById('volMotivo').value||'').trim();
  toast('Quitando…');
  window.MFSync.post('cancelar', { id:VOL_CTX.id||'', activityId:VOL_CTX.activityId, rol:VOL_CTX.roleId, voluntario:VOL_CTX.tel, motivo:motivo })
    .then(function(j){ if(j&&j.ok) toast('Voluntario quitado de la tarea'); else toast('No se pudo'); return window.MFSync.pull(); })
    .then(function(res){ if(res&&res.data&&res.data.inscripciones) setServerInscr(res.data.inscripciones); })
    .catch(function(){ toast('Error'); })
    .then(function(){ VOL_BUSY=false; closeVolDetalle(); renderLider(); });
}
window.volDetalle=volDetalle; window.closeVolDetalle=closeVolDetalle; window.volQuitar=volQuitar;

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
/* =========================================================================
   ADMIN · ACCESOS Y USUARIOS — arquitectura unificada
   -------------------------------------------------------------------------
   ESTADO:   PERMISOS, SERVER_VOLS (del pull) son la única fuente de verdad.
   VISTA:    ACC_VIEW = 'list' | 'user' | 'form:<tipo>' → un solo punto de render.
   MUTACIÓN: mfMutate() es el ÚNICO camino al backend: post → pull → refresca
             estado → re-render de la vista actual. Loading state centralizado.
   ========================================================================= */
let ACC_SEARCH = '';
let ACC_VIEW = 'list';       // 'list' | 'form'  (form = crear/editar unificado)
let USR_KEY = null;          // clave (teléfono) del usuario abierto en el modal, o null si crear
let ACC_FILTERS = { admin:false, lider:false, vol:false };  // chips multi-select (ninguno = todos)
let ACC_FORM = null;         // borrador del modal: { telefono, nombre, email, esAdmin, misiones:[], esNuevo, err }
let ACC_BUSY = false;
let _accSearchT = null, _delArm = null;

/* ---- helpers de lectura (sobre el estado real) ---- */
function _permInfo(email){
  const perm = PERMISOS || { admins:[], lideres:{} };
  const e = (email||'').toLowerCase();
  return { admin: !!e && (perm.admins||[]).indexOf(e)>=0, lideres: (e && perm.lideres && perm.lideres[e]) ? perm.lideres[e].slice() : [] };
}
function _nameByEmail(email){ var v=SERVER_VOLS.find(function(x){ return String(x.email||'').toLowerCase()===String(email||'').toLowerCase(); }); return v?v.nombre:email; }
function _volByTel(tel){ var k=String(tel).replace(/[^0-9]/g,''); return SERVER_VOLS.find(function(v){ return String(v.telefono).replace(/[^0-9]/g,'')===k; }); }
/* clasifica un voluntario (por su email) en roles acumulados */
function _rolesDe(v){
  var pi=_permInfo(String(v.email||''));
  return { admin:pi.admin, lider:pi.lideres.length>0, misiones:pi.lideres };
}

/* ---- ÚNICO camino al backend: gate online → post → pull → refresca estado → re-render.
   Online-only: la gestión de usuarios NO usa la cola offline. Bloquea navegación mientras dura. ---- */
function mfMutate(action, payload, okMsg){
  if(!window.MFSync || !window.MFSync.enabled){ _accSetErr('Necesita backend configurado'); _renderFormBody(); return Promise.resolve(false); }
  if(!navigator.onLine){ _accSetErr('Sin conexión. La gestión de usuarios necesita internet.'); _renderFormBody(); return Promise.resolve(false); }
  if(ACC_BUSY){ _accSetErr('Espera: guardando la operación anterior…'); _renderFormBody(); return Promise.resolve(false); }
  ACC_BUSY = true; _accLockNav(true);
  try{ accRender(); }catch(_){}                        // overlay + navegación bloqueada + controles disabled
  var releaseAndRender = function(){ ACC_BUSY=false; _accLockNav(false); try{ accRender(); }catch(_){} };
  return window.MFSync.post(action, payload)
    .then(function(j){
      if(j && j.ok){ return { ok:true }; }
      return { ok:false, err:(j && j.error) || 'desconocido' };
    })
    .catch(function(e){ return { ok:false, err:(e&&e.message)?e.message:'conexion' }; })
    .then(function(res){
      // siempre releer del servidor antes de liberar (lista nunca queda desactualizada)
      return window.MFSync.pull().then(function(pr){
        if(pr && pr.data){
          if(pr.data.permisos) setPermisos(pr.data.permisos);
          if(pr.data.voluntarios) setServerVols(pr.data.voluntarios);
          if(pr.data.inscripciones) setServerInscr(pr.data.inscripciones);
        }
        return res;
      }).catch(function(){ return res; });
    })
    .then(function(res){
      ACC_BUSY=false; _accLockNav(false);
      if(res.ok){ toast(okMsg||'Hecho'); }
      else { _accSetErr(_errMsg(res.err)); }   // error inline persistente en el modal
      try{ accRender(); }catch(_){}
      return res.ok;
    })
    .catch(function(e){
      // salvaguarda final: nunca dejar ACC_BUSY colgado ni fallar en silencio
      releaseAndRender();
      _accSetErr('Error inesperado: '+((e&&e.message)?e.message:e));
      try{ _renderFormBody(); }catch(_){}
      return false;
    });
}
function _errMsg(code){
  if(code==='email_requerido') return 'Falta el email: un Admin o Líder necesita email de Google.';
  if(code==='last_admin') return 'No se puede: debe quedar al menos un administrador.';
  if(code==='forbidden_admin') return 'Sesión caducada o sin permiso — vuelve a entrar con Google.';
  if(code==='datos_incompletos') return 'Faltan datos obligatorios (nombre y teléfono).';
  if(code==='sin_telefono') return 'No se pudo identificar el teléfono del usuario.';
  if(code==='telefono_en_uso') return 'Ese teléfono ya pertenece a otro usuario. Usa un número distinto.';
  if(code==='email_en_uso') return 'Ese email ya pertenece a otro usuario. Cada persona debe tener un email único.';
  if(code==='bad_token') return 'Token inválido — revisa la configuración del backend.';
  if(code==='conexion') return 'No se pudo guardar: sin respuesta del servidor. Revisa tu conexión.';
  if(!code || code==='desconocido') return 'No se pudo completar la operación. Inténtalo de nuevo.';
  // código no reconocido (p.ej. "HTTP 404 — ...") → mostrarlo tal cual para no ocultar el problema
  return 'Error: ' + String(code);
}
function _accSetErr(msg){ if(ACC_FORM) ACC_FORM.err=msg||''; else toast(msg); }

/* bloqueo/desbloqueo de navegación (tab bar + backdrop) durante la escritura */
function _accLockNav(on){
  var nav=document.getElementById('bottomNav');
  if(nav){ nav.querySelectorAll('button').forEach(function(b){ b.disabled=!!on; }); nav.classList.toggle('nav-locked', !!on); }
  var bd=document.getElementById('usrBackdrop');
  if(bd){ bd.onclick = on ? null : closeUsr; }   // clic fuera no cierra mientras guarda
  window._accBusyGuard = !!on;
}

/* ---- render unificado: decide qué mostrar según ACC_VIEW ---- */
function accRender(){
  _accSetModal(ACC_VIEW==='form');
  renderAdmin();
  if(ACC_VIEW==='form') _renderFormBody();
}
function _accSetModal(open){
  document.getElementById('usrBackdrop').classList.toggle('on', open);
  document.getElementById('usrSheet').classList.toggle('on', open);
}

/* ---- PANTALLA base (lista con filter chips + "+ Usuario" en el header) ---- */
function _accFilterOn(){ return ACC_FILTERS.admin || ACC_FILTERS.lider || ACC_FILTERS.vol; }
function accToggleFilter(k){ ACC_FILTERS[k]=!ACC_FILTERS[k]; if(ACC_VIEW==='list') renderAdmin(); }
window.accToggleFilter=accToggleFilter;
function renderAdminAccesos(box, cfg){
  const q = norm(ACC_SEARCH.trim());
  const anyFilter = _accFilterOn();
  // enriquecer voluntarios con roles
  const enr = SERVER_VOLS.map(function(v){ var r=_rolesDe(v); return { v:v, r:r, tipo: r.admin?'admin':(r.lider?'lider':'vol') }; });
  // contadores para los chips
  const cAdmin = enr.filter(function(x){ return x.r.admin; }).length;
  const cLider = enr.filter(function(x){ return x.r.lider; }).length;
  const cVol = enr.length;
  // filtro por búsqueda
  let list = enr.filter(function(x){
    if(q && !(norm(String(x.v.nombre||'')).includes(q) || String(x.v.telefono||'').includes(ACC_SEARCH.trim()))) return false;
    if(!anyFilter) return true;
    return (ACC_FILTERS.admin && x.r.admin) || (ACC_FILTERS.lider && x.r.lider) || (ACC_FILTERS.vol && true && ACC_FILTERS.vol);
  });
  // orden: Admin → Líderes → Voluntarios, luego por nombre
  const rank = function(x){ return x.r.admin?0:(x.r.lider?1:2); };
  list.sort(function(a,b){ return rank(a)-rank(b) || String(a.v.nombre||'').localeCompare(String(b.v.nombre||'')); });

  function badges(r){
    var b='';
    if(r.admin) b+='<span class="acc-role admin">Admin</span>';
    if(r.lider) b+='<span class="acc-role lider">Líder</span>';
    if(!r.admin && !r.lider) b+='<span class="acc-role vol">Voluntario</span>';
    return b;
  }
  function rowHtml(x){
    var tel=String(x.v.telefono||'');
    return `<div class="acc-row" onclick="usrOpen('${tel.replace(/'/g,"")}')">
      <div class="acc-nm"><div class="n">${x.v.nombre||'(sin nombre)'}</div><div class="s">${tel}</div></div>
      <div class="acc-roles">${badges(x.r)}</div><span class="chev">›</span></div>`;
  }
  // agrupar con etiquetas ligeras
  const groups = [
    { key:'admin', label:'Administradores', items:list.filter(function(x){ return x.r.admin; }) },
    { key:'lider', label:'Líderes', items:list.filter(function(x){ return !x.r.admin && x.r.lider; }) },
    { key:'vol', label:'Voluntarios', items:list.filter(function(x){ return !x.r.admin && !x.r.lider; }) }
  ];
  const groupsH = groups.map(function(g){
    if(!g.items.length) return '';
    return `<div class="grp-label">${g.label}</div><div class="acc-list">${g.items.map(rowHtml).join('')}</div>`;
  }).join('') || '<div class="admnote">Sin usuarios que coincidan.</div>';

  const dis = ACC_BUSY?'disabled':'';
  const off = !navigator.onLine;
  box.innerHTML = `
    <div class="adm-head acc-head-row">
      <button class="back" onclick="adminGo('list')">‹</button>
      <div class="htxt"><div class="ah-t">Accesos y usuarios</div><div class="ah-s">${cVol} usuario${cVol===1?'':'s'}</div></div>
      <button class="add-top" ${off||ACC_BUSY?'disabled':''} onclick="usrNew()"><span class="plus">+</span> Usuario</button>
    </div>
    ${off?'<div class="acc-offline">Sin conexión. La gestión de usuarios necesita internet.</div>':''}
    ${!LIVE?'<div class="usr-note" style="margin-bottom:12px">Modo local (sin backend): los cambios no se comparten.</div>':''}
    <div class="filter-bar">
      <button class="fchip admin ${ACC_FILTERS.admin?'on':''}" onclick="accToggleFilter('admin')"><span class="tick">✓</span>Admin <span class="cnt">${cAdmin}</span></button>
      <button class="fchip lider ${ACC_FILTERS.lider?'on':''}" onclick="accToggleFilter('lider')"><span class="tick">✓</span>Líderes <span class="cnt">${cLider}</span></button>
      <button class="fchip vol ${ACC_FILTERS.vol?'on':''}" onclick="accToggleFilter('vol')"><span class="tick">✓</span>Voluntarios <span class="cnt">${cVol}</span></button>
    </div>
    <div class="acc-search"><input type="search" id="accSearch" placeholder="Buscar nombre o teléfono…" value="${ACC_SEARCH.replace(/"/g,'&quot;')}" oninput="accSearchInput(this.value)" /></div>
    ${groupsH}`;
  var si=document.getElementById('accSearch'); if(si && ACC_SEARCH){ si.focus(); si.setSelectionRange(si.value.length,si.value.length); }
}
function accSearchInput(v){ ACC_SEARCH=v; clearTimeout(_accSearchT); _accSearchT=setTimeout(function(){ if(ACC_VIEW==='list') renderAdmin(); }, 220); }
window.accSearchInput=accSearchInput;

/* ---- MODAL UNIFICADO: crear / editar persona ----
   ACC_FORM = { telefono, nombre, email, esAdmin, misiones:[misionId], esNuevo, err }
   Crear: usrNew() abre en blanco. Editar: usrOpen(tel) precarga desde el voluntario + permisos. */
function usrNew(){
  if(!navigator.onLine){ toast('Sin conexión. La gestión de usuarios necesita internet.'); return; }
  ACC_FORM = { telefono:'', ddi:'+34', nombre:'', email:'', esAdmin:false, misiones:[], esNuevo:true, err:'' };
  ACC_VIEW='form'; _delArm=null; accRender();
  setTimeout(function(){ var el=document.getElementById('fNom'); if(el) el.focus(); },220);
}
function usrOpen(key){
  var v=_volByTel(key); if(!v){ toast('Usuario no encontrado — actualiza la lista'); return; }
  var pi=_permInfo(String(v.email||''));
  var tel=String(v.telefono||'').replace(/^'/,'').trim();   // quita comilla de texto de Sheets si viene
  // separar DDI + local casando contra la LISTA REAL de DDIS (prefijo más largo primero).
  // (el regex \+\d{1,3} era greedy y capturaba "+346" de "+34600...", rompiendo el select)
  var ddi='', local='';
  var telDigits = tel.replace(/[^0-9+]/g,'');
  var candidatos = DDIS.map(function(d){ return d.c; }).sort(function(a,b){ return b.length-a.length; });
  for(var ci=0; ci<candidatos.length; ci++){
    if(telDigits.indexOf(candidatos[ci])===0){ ddi=candidatos[ci]; local=telDigits.slice(candidatos[ci].length).replace(/[^0-9]/g,''); break; }
  }
  if(!ddi){ ddi='+34'; local=telDigits.replace(/^\+/,'').replace(/[^0-9]/g,''); }
  ACC_FORM = {
    telefonoFull: tel,                 // teléfono canónico ORIGINAL (clave real — NUNCA reconstruir)
    telKeyOrig: normPhone(tel),        // solo dígitos, para comparar
    telefono:local, ddi:ddi,
    nombre:v.nombre||'', email:String(v.email||''),
    esAdmin:pi.admin, misiones:pi.lideres.slice(), esNuevo:false, err:''
  };
  ACC_VIEW='form'; _delArm=null; accRender();
}
function closeUsr(){ if(ACC_BUSY) return; ACC_VIEW='list'; USR_KEY=null; ACC_FORM=null; _delArm=null; accRender(); }
window.usrNew=usrNew; window.usrOpen=usrOpen; window.closeUsr=closeUsr;

/* lee los campos del DOM al borrador (para no perder lo escrito al re-render) */
function _formSync(){
  if(!ACC_FORM) return;
  var n=document.getElementById('fNom'); if(n) ACC_FORM.nombre=n.value;
  var e=document.getElementById('fEmail'); if(e) ACC_FORM.email=e.value.trim().toLowerCase();
  var t=document.getElementById('fTel'); if(t) ACC_FORM.telefono=t.value;
  var d=document.getElementById('fDdi'); if(d) ACC_FORM.ddi=d.value;
}
function fToggleAdmin(){ _formSync(); ACC_FORM.esAdmin=!ACC_FORM.esAdmin; ACC_FORM.err=''; _renderFormBody(); }
function fToggleLiderOn(){
  _formSync();
  var on = (ACC_FORM.misiones && ACC_FORM.misiones.length>0) || ACC_FORM.__liderOn;
  if(on){ ACC_FORM.misiones=[]; ACC_FORM.__liderOn=false; }   // apagar: limpa missões e flag
  else { ACC_FORM.__liderOn=true; }                           // ligar: revela chips (sem missão ainda)
  ACC_FORM.err=''; _renderFormBody();
}
function fToggleMision(mid){ _formSync(); var i=ACC_FORM.misiones.indexOf(mid); if(i>=0) ACC_FORM.misiones.splice(i,1); else ACC_FORM.misiones.push(mid); ACC_FORM.__liderOn=true; ACC_FORM.err=''; _renderFormBody(); }
window.fToggleAdmin=fToggleAdmin; window.fToggleLiderOn=fToggleLiderOn; window.fToggleMision=fToggleMision;

/* email obligatorio si es admin o hay misiones de líder */
function _emailRequerido(){ return !!(ACC_FORM && (ACC_FORM.esAdmin || (ACC_FORM.misiones && ACC_FORM.misiones.length))); }
/* valida el formulario y DEVUELVE EL MOTIVO exacto si algo falta (para mostrarlo en pantalla) */
function _validarForm(){
  if(!ACC_FORM) return { ok:false, msg:'Formulario no disponible.' };
  var f=ACC_FORM;
  if(!String(f.nombre||'').trim()) return { ok:false, msg:'Falta el nombre (obligatorio).' };
  var tel = f.esNuevo ? ((f.ddi||'+34')+normPhone(f.telefono||'')) : (f.telefonoFull || (f.ddi||'+34')+normPhone(f.telefono||''));
  if(normPhone(tel).length < 8) return { ok:false, msg:'El teléfono es obligatorio y debe tener al menos 8 dígitos.' };
  if(_emailRequerido() && !String(f.email||'').trim()) return { ok:false, msg:'Falta el email: un Admin o Líder necesita email de Google.' };
  return { ok:true };
}

function _renderFormBody(){
  const cfg=window.CFMS.getConfig(); const dis=ACC_BUSY?'disabled':'';
  const f=ACC_FORM; if(!f) return;
  const liderOn = (f.misiones && f.misiones.length>0) || f.__liderOn;
  const emailReq = _emailRequerido();
  const emailEmpty = !String(f.email||'').trim();
  const misChips = cfg.misiones.map(function(m){
    const on = f.misiones.indexOf(m.id)>=0;
    return `<button class="tog-chip ${on?'on':''}" ${dis} onclick="fToggleMision('${m.id}')">${m.nombre}${on?' ✓':''}</button>`;
  }).join('');
  const badges = (!f.esNuevo) ? `<div class="usr-badges">${f.esAdmin?'<span class="acc-role admin">Admin</span>':''}${liderOn?'<span class="acc-role lider">Líder</span>':''}${(!f.esAdmin&&!liderOn)?'<span class="acc-role vol">Voluntario</span>':''}</div>` : '';
  const emailTag = emailReq ? '<span class="f-tag req">Obligatorio</span>' : '<span class="f-tag opt">Opcional</span>';
  const emailHint = emailReq
    ? '<div class="f-hint req">Un Admin o Líder necesita email de Google para iniciar sesión.</div>'
    : '<div class="f-hint">Necesario solo si será Admin o Líder (para el login con Google).</div>';
  const canSave = !ACC_BUSY;   // siempre clicable (salvo mientras guarda) — la validación con mensaje ocurre al pulsar
  const primaryTxt = f.esNuevo ? 'Crear' : 'Guardar';
  const delTxt = (_delArm==='del')
    ? ('¿Eliminar a '+_esc(f.nombre||'(sin nombre)')+' ('+_esc(f.telefonoFull||'')+')? Toca de nuevo')
    : 'Eliminar usuario';

  document.getElementById('usrBody').innerHTML = `
    <h3 class="usr-t">${f.esNuevo?'Nuevo usuario':(f.nombre||'(sin nombre)')}</h3>
    <div class="usr-sub">${f.esNuevo?'Añade los datos y, si hace falta, sus accesos.':'Editar datos y accesos.'}</div>
    ${badges}
    ${f.err?`<div class="f-err"><span>⚠</span><span>${f.err}</span></div>`:''}

    <div class="f-fld" style="margin-top:12px"><label>Nombre <span class="f-tag req">Obligatorio</span></label>
      <input id="fNom" class="f-input" ${dis} value="${String(f.nombre||'').replace(/"/g,'&quot;')}" placeholder="Ej. María González" oninput="_formSync()" /></div>
    <div class="f-fld"><label>Teléfono <span class="f-tag req">Obligatorio</span></label>
      <div class="phone-row"><select id="fDdi" class="f-input f-ddi" ${dis}>${DDIS.map(function(dd){ return '<option value="'+dd.c+'"'+(dd.c===(f.ddi||'+34')?' selected':'')+'>'+dd.f+' '+dd.c+'</option>'; }).join('')}</select>
      <input id="fTel" class="f-input f-tel" ${dis} type="tel" value="${String(f.telefono||'').replace(/"/g,'&quot;')}" placeholder="600 000 000" oninput="_formSync()" /></div></div>
    <div class="f-fld"><label>Email ${emailTag}</label>
      <input id="fEmail" class="f-input ${emailReq&&emailEmpty?'req-empty':''}" ${dis} type="email" value="${String(f.email||'').replace(/"/g,'&quot;')}" placeholder="email@gmail.com" oninput="_formSync()" />
      ${emailHint}</div>

    <div class="f-div"></div>
    <div class="f-secrow"><span class="f-secname">Administrador</span>
      <span class="sw ${dis?'dis':''}"><input type="checkbox" ${f.esAdmin?'checked':''} ${dis} onchange="fToggleAdmin()" /><span class="track"></span><span class="knob"></span></span></div>
    <p class="f-secdesc">Gestiona accesos, misiones y configuración de toda la app.</p>

    <div class="f-secrow"><span class="f-secname">Líder de misiones</span>
      <span class="sw ${dis?'dis':''}"><input type="checkbox" ${liderOn?'checked':''} ${dis} onchange="fToggleLiderOn()" /><span class="track"></span><span class="knob"></span></span></div>
    <p class="f-secdesc">Gestiona voluntarios y checklist de las misiones marcadas.</p>
    ${liderOn?`<div class="tog-chips">${misChips}</div><div class="multi-hint">Puedes marcar varias misiones.</div>`:''}

    <div class="usr-actions"><button class="btn ghost" ${dis} onclick="closeUsr()">Cancelar</button>
      <button class="btn primary" ${canSave?'':'disabled'} onclick="usrSave()">${primaryTxt}</button></div>
    ${!f.esNuevo ? `<button class="usr-del ${_delArm==='del'?'armed':''}" ${dis} onclick="usrDelete()">${delTxt}</button>` : ''}`;

  // (el select fDdi ya viene con la opción correcta marcada como 'selected' en el HTML)

  // overlay "Guardando…" cuando está ocupado (bloqueo visual)
  var sheet=document.getElementById('usrSheet');
  var ov=document.getElementById('accSaving');
  if(ACC_BUSY){ if(!ov){ ov=document.createElement('div'); ov.id='accSaving'; ov.className='acc-saving'; ov.innerHTML='<div class="acc-spin"></div><div class="acc-savetx">Guardando…</div>'; sheet.appendChild(ov); } }
  else if(ov){ ov.remove(); }
}

function usrSave(){
  try{
    _formSync();
    if(!ACC_FORM){ toast('Error: formulario no disponible'); return; }
    if(ACC_BUSY){ _accSetErr('Espera: guardando la operación anterior…'); _renderFormBody(); return; }
    var f=ACC_FORM;
    var val=_validarForm();
    if(!val.ok){ _accSetErr(val.msg); _renderFormBody(); return; }   // muestra el motivo EXACTO en pantalla
    var telNuevo = (f.ddi||'+34') + normPhone(f.telefono||'');   // teléfono del formulario (puede haber cambiado)
    var payload = {
      telefono: telNuevo, nombre:String(f.nombre).trim(), email:String(f.email||'').trim().toLowerCase(),
      esAdmin:!!f.esAdmin, misionesLider:(f.misiones||[]).slice(), idioma:LANG
    };
    // al EDITAR, enviamos también la clave ORIGINAL para que el backend actualice la fila correcta
    // (permite cambiar el teléfono sin crear duplicado ni pisar a otro)
    if(!f.esNuevo && f.telefonoFull){ payload.telefonoAnterior = f.telefonoFull; }
    mfMutate('saveUsuario', { usuario: payload }, f.esNuevo?'Usuario creado':'Cambios guardados').then(function(ok){ if(ok) closeUsr(); });
  }catch(e){
    ACC_BUSY=false; _accLockNav(false);
    _accSetErr('Error inesperado al guardar: '+(e&&e.message?e.message:e));
    try{ _renderFormBody(); }catch(_){}
  }
}
function usrDelete(){
  try{
    if(!ACC_FORM){ toast('Error: formulario no disponible'); return; }
    if(ACC_BUSY){ _accSetErr('Espera: guardando la operación anterior…'); _renderFormBody(); return; }
    var tel = ACC_FORM.telefonoFull || ((ACC_FORM.ddi||'+34')+normPhone(ACC_FORM.telefono||''));
    if(!normPhone(tel)){ _accSetErr('No se pudo identificar el teléfono de este usuario.'); _renderFormBody(); return; }
    if(_delArm!=='del'){ _delArm='del'; _renderFormBody(); return; }   // 1º toque: arma confirmación
    mfMutate('delVoluntario', { telefono:tel }, 'Usuario eliminado').then(function(ok){ if(ok) closeUsr(); });
  }catch(e){
    ACC_BUSY=false; _accLockNav(false);
    _accSetErr('Error inesperado al eliminar: '+(e&&e.message?e.message:e));
    try{ _renderFormBody(); }catch(_){}
  }
}
window.usrSave=usrSave; window.usrDelete=usrDelete; window._formSync=_formSync;

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

/* ---------- SELECTOR DE IDIOMA (banderas SVG ES/BR) ---------- */
/* banderas dibujadas en SVG (consistentes en todas las plataformas, no emoji) */
function _flagES(){
  return '<svg viewBox="0 0 24 16" width="26" height="17" aria-label="Español">'
    + '<rect width="24" height="16" fill="#c60b1e"/><rect y="4" width="24" height="8" fill="#ffc400"/></svg>';
}
function _flagBR(){
  return '<svg viewBox="0 0 24 16" width="26" height="17" aria-label="Português (Brasil)">'
    + '<rect width="24" height="16" fill="#009b3a"/>'
    + '<polygon points="12,2 22,8 12,14 2,8" fill="#fedf00"/>'
    + '<circle cx="12" cy="8" r="3.2" fill="#002776"/></svg>';
}
function _langSelectorHtml(){
  return '<div class="mas-lang">'
    + '<button class="mas-flag '+(LANG==='es'?'on':'')+'" title="Español" aria-label="Español" onclick="setLang(\'es\')">'+_flagES()+'</button>'
    + '<button class="mas-flag '+(LANG==='pt'?'on':'')+'" title="Português" aria-label="Português" onclick="setLang(\'pt\')">'+_flagBR()+'</button>'
    + '</div>';
}
function setLang(l){
  if(l!=='es' && l!=='pt') return;
  if(l===LANG){ return; }
  LANG = l;
  try{ localStorage.setItem('mf_lang', l); }catch(e){}
  // persistir en el backend (columna idioma del usuario), sin bloquear la UI
  if(USER && USER.phone && window.MFSync && window.MFSync.enabled){
    try{ window.MFSync.queue('upsertVoluntario', { voluntario:{ telefono:USER.phone, nombre:USER.name, email:USER.email||'', idioma:l } }); }catch(e){}
  }
  try{ renderAll(); }catch(e){ renderMas(); }
}
window.setLang=setLang;

function renderMas(){
  var box = document.getElementById('masBody'); if(!box) return;
  var nombre  = (USER && USER.name)  ? USER.name  : '—';
  var email   = (USER && USER.email) ? USER.email : (USER && USER.phone ? USER.phone : '—');
  var papel   = isAdmin() ? 'Administrador' : (isLider() ? 'Líder' : 'Voluntario');
  var syncSt  = window.MFSync ? window.MFSync.status() : 'off';
  var syncTxt = { ok:'Sincronizado', pending:'Pendiente', syncing:'Sincronizando…',
                  offline:'Sin conexión', error:'Error de sync', off:'Sin servidor' };
  var syncCol = { ok:'#4f9d69', pending:'#d9a90a', syncing:'#d9a90a',
                  offline:'#c2560c', error:'#c2560c', off:'#9a9a9a' };
  var queueLen = 0;
  try{ queueLen = JSON.parse(localStorage.getItem('mf_sync_queue')||'[]').length; }catch(e){}
  var errList = (window.MFSync && window.MFSync.errorLog) ? window.MFSync.errorLog() : [];

  function _fmtErrTime(iso){ try{ var d=new Date(iso); return d.toLocaleString(LANG==='pt'?'pt-BR':'es-ES'); }catch(e){ return iso; } }
  // botón "Ver errores" (oculta la lista por defecto) + lista revelable con Copiar/Limpiar
  var errBlock = '';
  if(errList && errList.length){
    var verLabel = MAS_SHOW_ERRORS ? ('Ocultar errores ('+errList.length+')') : ('Ver errores ('+errList.length+')');
    errBlock =
      '<div class="mas-row" style="align-items:stretch;flex-direction:column;gap:8px">'
      + '<button class="mas-mini ghost" style="width:100%" onclick="mfToggleErrors()">'+verLabel+'</button>';
    if(MAS_SHOW_ERRORS){
      var items = errList.map(function(e){
        return '<div class="mas-err-item">'
          +   '<div class="mas-err-msg">'+_esc(e.detail)+'</div>'
          +   '<div class="mas-err-meta">'+_esc(e.where||'')+' · '+_fmtErrTime(e.ts)+' · '+(e.online?'en línea':'sin conexión')+'</div>'
          + '</div>';
      }).join('');
      errBlock +=
        '<div class="mas-errbox">'+items+'</div>'
        + '<div style="display:flex;gap:6px">'
        +   '<button class="mas-mini" style="flex:1" onclick="mfCopyErrLog()">Copiar</button>'
        +   '<button class="mas-mini ghost" style="flex:1" onclick="mfClearErrLog()">Limpiar</button>'
        + '</div>';
    }
    errBlock += '</div>';
  }

  box.innerHTML =
    '<div class="mas-card">'
    +_langSelectorHtml()
    +'<div class="mas-avatar">'+nombre.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase()+'</div>'
    +'<div class="mas-name">'+nombre+'</div>'
    +'<div class="mas-email">'+email+'</div>'
    +'<div class="mas-pill">'+papel+'</div>'
    +'</div>'

    +'<div class="mas-sec">Sincronización</div>'
    +'<div class="mas-row">'
    +  '<span class="mas-lbl">Estado</span>'
    +  '<span class="mas-val" style="color:'+syncCol[syncSt]+'">'+( syncTxt[syncSt]||'—')+'</span>'
    +'</div>'
    +(queueLen > 0
      ? '<div class="mas-row"><span class="mas-lbl">Pendientes de envío</span><span class="mas-val">'+queueLen+'</span></div>'
      : '')
    +'<div class="mas-row" style="padding:0;border:0;background:none"><button class="mas-retry" style="width:100%" onclick="mfRetrySync()">Reintentar sincronización</button></div>'
    + errBlock

    +'<div class="mas-sec">Aplicación</div>'
    +'<div class="mas-row"><span class="mas-lbl">Versión</span><span class="mas-val">v'+window.CFMS.APP_VERSION+'</span></div>'

    +'<div class="mas-logout-wrap">'
    +'<button class="mas-logout" onclick="goLogin()">Cerrar sesión</button>'
    +'</div>';
}
/* escape simple para el detalle del error (evita romper el HTML) */
function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
/* reintenta un pull manual desde la pestaña Más y re-renderiza el estado */
function mfRetrySync(){
  if(!window.MFSync || !window.MFSync.enabled){ toast('Sin servidor configurado'); return; }
  toast('Reintentando…');
  window.MFSync.pull().then(function(){ renderMas(); });
}
window.mfRetrySync=mfRetrySync;
/* mostrar/ocultar la lista de errores (oculta por defecto) */
var MAS_SHOW_ERRORS = false;
function mfToggleErrors(){ MAS_SHOW_ERRORS = !MAS_SHOW_ERRORS; renderMas(); }
window.mfToggleErrors=mfToggleErrors;
/* copiar el log de errores al portapapeles (con fallback para navegadores sin clipboard API) */
function mfCopyErrLog(){
  var txt = (window.MFSync && window.MFSync.errorLogText) ? window.MFSync.errorLogText() : '';
  if(!txt){ toast('Nada que copiar'); return; }
  function done(){ toast('Log copiado — pégalo donde quieras'); }
  function fallback(){
    try{
      var ta=document.createElement('textarea'); ta.value=txt;
      ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
      ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
    }catch(e){ toast('No se pudo copiar'); }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(fallback);
  } else { fallback(); }
}
function mfClearErrLog(){
  if(window.MFSync && window.MFSync.clearError){ window.MFSync.clearError(); }
  toast('Log limpiado'); renderMas();
}
window.mfCopyErrLog=mfCopyErrLog; window.mfClearErrLog=mfClearErrLog;

function renderAll(){ renderInicio(); renderAgenda(); renderMios(); renderLider(); renderAdmin(); renderMas(); }

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

  if(LIVE && window.MFSync){
    // --- modo LIVE: enviar ao backend ---
    // desabilitar botão para evitar double-tap
    var btn = document.getElementById('wzNext');
    if(btn){ btn.disabled=true; btn.textContent='Enviando…'; }

    var tel = USER && USER.phone ? String(USER.phone).replace(/[^0-9+]/g,'') : '';
    var promises = sel.map(function(a){
      var r = wzState.roles[a.id];
      var cap = a.roles[r] || 0;
      var payload = {
        inscripcion: {
          activityId: a.id,
          misionId:   a.misionId || a.cadeia || '',
          templateId: a.templateId || '',
          fecha:      a.data || '',
          rol:        r,
          capacidad:  cap,
          voluntario: tel
        }
      };
      return window.MFSync.post('inscribir', payload).then(function(j){
        return { activityId: a.id, rol: r, res: j };
      }).catch(function(err){
        // offline ou erro de rede → enfileira
        window.MFSync.queue('inscribir', payload);
        return { activityId: a.id, rol: r, res: { ok:true, estado:'confirmado', queued:true } };
      });
    });

    Promise.all(promises).then(function(results){
      // atualizar SERVER_INSCR local e estado INSCR/MI_ESPERA com base na resposta
      results.forEach(function(item){
        var estado = (item.res && item.res.estado) || 'confirmado';
        if(estado === 'espera'){ MI_ESPERA[item.activityId]=item.rol; delete INSCR[item.activityId]; }
        else                   { INSCR[item.activityId]=item.rol;     delete MI_ESPERA[item.activityId]; }
        // adicionar à lista local para refletir imediatamente sem precisar de pull
        if(!item.res.dup){
          SERVER_INSCR.push({ activityId:item.activityId, rol:item.rol, voluntario:tel, estado:estado, id:'_local_'+Date.now() });
        }
      });
      saveInscr(); saveEspera();
      _showWzOk(sel, results);
    });

  } else {
    // --- modo offline/local: grava só em localStorage ---
    var results = sel.map(function(a){
      var r = wzState.roles[a.id];
      var estado = libresRol(a,r) > 0 ? 'confirmado' : 'espera';
      if(estado === 'espera'){ MI_ESPERA[a.id]=r; delete INSCR[a.id]; }
      else                   { INSCR[a.id]=r; delete MI_ESPERA[a.id]; }
      return { activityId: a.id, rol: r, res: { ok:true, estado: estado } };
    });
    saveInscr(); saveEspera();
    _showWzOk(sel, results);
  }
}

function _showWzOk(sel, results){
  // mapeia activityId → estado para montar o resumo
  var estadoMap = {};
  results.forEach(function(item){ estadoMap[item.activityId] = (item.res && item.res.estado) || 'confirmado'; });

  document.querySelectorAll('.wz-step').forEach(function(s){ s.classList.remove('active'); });
  document.querySelector('.wz-step[data-step="ok"]').classList.add('active');
  document.getElementById('stepper').style.visibility='hidden';
  document.getElementById('wzOkResumo').innerHTML = sel.map(function(a){
    var f=fmtFecha(a.data); var r=wzState.roles[a.id]; var espera = estadoMap[a.id]==='espera';
    return '<div class="row"><span class="k">'+a.titulo[LANG]+'<br><span style="text-transform:none;letter-spacing:0;font-size:12px">'+f.w+' '+f.d+' '+f.m+' · '+a.hora+'</span></span>'
      +'<span class="v">'+(window.CFMS.ROLES[r]?window.CFMS.ROLES[r].label[LANG]:r)
      +(espera?' <span style="color:var(--warn);font-size:11px">· en espera</span>':'')+'</span></div>';
  }).join('');
  var anyEspera = sel.some(function(a){ return estadoMap[a.id]==='espera'; });
  var okTitle = document.querySelector('.wz-step[data-step="ok"] h2');
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
  // Opción C — nube en contorno (currentColor toma el color del estado). Sin animación.
  // Nube base común: path de una nube limpia y consistente en viewBox 24x24.
  var NUBE = 'M7.5 18h9a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.65-1.2A3.75 3.75 0 0 0 7.5 18z';
  function ic(inner, w){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||1.7)+'" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="'+NUBE+'"/>' + (inner||'') + '</svg>';
  }
  // OK: nube + check dentro
  var SVG_OK      = ic('<polyline points="10,13.2 11.6,14.8 14.4,11.4" stroke-width="1.6"/>');
  // Sincronizando: nube + flecha circular (estática, sin animación)
  var SVG_SYNC    = ic('<path d="M14.3 12.4a2.4 2.4 0 1 0-.5 2.7" stroke-width="1.6"/><polyline points="14.5,10.4 14.7,12.5 12.6,12.3" stroke-width="1.6"/>');
  // Pendiente: nube + tres puntos
  var SVG_PENDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+NUBE+'"/><circle cx="9.2" cy="13.6" r="0.7" fill="currentColor" stroke="none"/><circle cx="12" cy="13.6" r="0.7" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13.6" r="0.7" fill="currentColor" stroke="none"/></svg>';
  // Offline: nube tachada (línea diagonal)
  var SVG_OFFLINE = ic('<line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/>');
  // Error: nube + signo de exclamación
  var SVG_ERROR   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+NUBE+'"/><line x1="12" y1="10.6" x2="12" y2="13.4"/><circle cx="12" cy="15.5" r="0.75" fill="currentColor" stroke="none"/></svg>';
  var map={
    ok:      [SVG_OK,      'sincronizado',   '#4f9d69'],
    pending: [SVG_PENDING, 'pendiente',      '#d9a90a'],
    syncing: [SVG_SYNC,    'sincronizando…', '#d9a90a'],
    offline: [SVG_OFFLINE, 'sin conexión',   '#c2560c'],
    error:   [SVG_ERROR,   'error de sync',  '#c2560c'],
    off:     ['','','']
  };
  var m=map[s]||map.off;
  el.style.display = m[0] ? 'inline-flex' : 'none';
  el.style.color = m[2];
  el.title = m[1] || '';                       // texto solo como tooltip (accesibilidad)
  el.setAttribute('aria-label', m[1] || '');
  el.innerHTML = m[0] ? m[0] : '';             // solo el icono, sin texto visible
}
if(window.MFSync){
  window.MFSync.onStatus(renderSyncBadge);
  // aplica los datos de un pull (config/permisos/voluntarios) y re-renderiza si procede
  function applyPull(res, forceRender){
    if(!(res && res.data)) return;
    if(res.data.permisos) setPermisos(res.data.permisos);
    if(res.data.voluntarios) setServerVols(res.data.voluntarios);
    if(res.data.inscripciones) setServerInscr(res.data.inscripciones);
    if(res.data.config && res.data.config.misiones){
      window.CFMS.setConfig(res.data.config);
      localStorage.setItem('mf_config', JSON.stringify(res.data.config));
    }
    // no re-renderizar si el usuario está en medio de una edición (evita perder foco/estado)
    var editing = ACC_BUSY
      || (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))
      || document.getElementById('wizard').classList.contains('active')
      || document.getElementById('chkOverlay').classList.contains('active')
      || document.getElementById('asgSheet').classList.contains('on')
      || ACC_VIEW==='form';   // modal de gestión de usuario abierto → no re-render por debajo
    if(USER && (forceRender || !editing)){ renderDemoBar(); renderAll(); }
  }
  window.MFSync.init().then(function(res){ applyPull(res, true); });
  // PULL periódico y al volver el foco (para ver cambios de otros dispositivos)
  function refreshFromServer(){ if(document.hidden) return; window.MFSync.pull().then(function(r){ applyPull(r, false); }); }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) refreshFromServer(); });
  window.addEventListener('online', refreshFromServer);
  setInterval(refreshFromServer, 3*60*1000);   // cada 3 min
}
