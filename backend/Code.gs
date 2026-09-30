/**
 * Manos Fuertes — Misión Social Casa Fuerte
 * Backend (Google Apps Script Web App) — Fase 1: configuración compartida + base de sync.
 *
 * Cómo usar: ver backend/SETUP.md
 * - Este archivo va pegado en el editor de Apps Script de la planilla.
 * - NO contiene secretos reales; el SYNC_TOKEN y CLIENT_ID se ponen abajo al desplegar
 *   (mantén una copia como Code.gs.real fuera del repo).
 *
 * Arquitectura (ver design/CFMS_Concept_Backend_v1.html):
 *   doGet(pull)  -> devuelve { config, voluntarios, inscripciones, checklists }
 *   doPost       -> aplica acciones: saveConfig, upsertVoluntario, inscribir, cancelar,
 *                   setChecklistItem, addLider... (con validación de permisos y LockService)
 *   Pestañas:    Config (JSON en una celda), Voluntarios, Inscripciones, Checklists, Admin, Auditoria
 */

/* ============ CONFIGURACIÓN (rellenar al desplegar; guardar en Code.gs.real) ============ */
var SYNC_TOKEN   = 'TROCAR_POR_UM_TOKEN';                 // token compartido app<->backend
var GOOGLE_CLIENT_ID = 'XXXXXXXXXX-xxxx.apps.googleusercontent.com'; // OAuth client (login Google)
/* Fallback de admins si la pestaña Admin está vacía (la fuente real es la pestaña Admin). */
var ADMIN_FALLBACK = ['rogerio.s.ono@gmail.com'];

/* ============ PESTAÑAS ============ */
var SHEETS = {
  CONFIG: 'Config',
  USUARIOS: 'Usuarios',          // NUEVA aba única: reemplaza Voluntarios + Admin
  VOLUNTARIOS: 'Voluntarios',    // (obsoleta — se puede borrar manualmente)
  INSCRIPCIONES: 'Inscripciones',
  CHECKLISTS: 'Checklists',
  ADMIN: 'Admin',                // (obsoleta — se puede borrar manualmente)
  AUDIT: 'Auditoria'
};

/* ============ ENTRADAS HTTP ============ */
function doGet(e) {
  try {
    _ensureSheets();
    var p = (e && e.parameter) || {};
    if (p.token !== SYNC_TOKEN) return _json({ ok:false, error:'bad_token' });
    var action = p.action || 'pull';
    if (action === 'pull') return _json({ ok:true, data: _pull() });
    return _json({ ok:false, error:'unknown_action' });
  } catch (err) {
    return _json({ ok:false, error:String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // serializa escrituras (evita sobrecupo)
    _ensureSheets();
    var body = {};
    try { body = JSON.parse(e.postData.contents); } catch (x) {}
    if (body.token !== SYNC_TOKEN) return _json({ ok:false, error:'bad_token' });

    var email = _verify(body.idToken); // null si no verificado / no login Google
    var action = body.action;

    switch (action) {
      case 'saveConfig':      return _json(_saveConfig(body, email));
      case 'upsertVoluntario':return _json(_upsertVoluntario(body, email));
      case 'saveUsuario':     return _json(_saveUsuario(body, email));
      case 'delVoluntario':   return _json(_delVoluntario(body, email));
      case 'dedupeVoluntarios':return _json(_dedupeVoluntarios(body, email));
      case 'inscribir':       return _json(_inscribir(body, email));
      case 'cancelar':        return _json(_cancelar(body, email));
      case 'setChecklistItem':return _json(_setChecklistItem(body, email));
      default:                return _json({ ok:false, error:'unknown_action' });
    }
  } catch (err) {
    return _json({ ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ============ PULL ============ */
function _pull() {
  var usuarios = _readRows(SHEETS.USUARIOS);
  return {
    config:        _readConfig(),
    voluntarios:   usuarios,          // compat: el cliente sigue leyendo "voluntarios" (ahora = Usuarios)
    usuarios:      usuarios,
    inscripciones: _readRows(SHEETS.INSCRIPCIONES),
    checklists:    _readRows(SHEETS.CHECKLISTS),
    permisos:      _permisos(),   // { admins:[email], lideres:{email:[misionId]} }
    serverTime:    new Date().toISOString()
  };
}
/* parse tolerante del JSON de líder (puede venir vacío, array o string JSON) */
function _parseLider(val){
  if(!val) return [];
  if(Array.isArray(val)) return val;
  try{ var a=JSON.parse(val); return Array.isArray(a)?a:[]; }catch(e){ return []; }
}
function _esAdminFlag(val){
  var s=String(val==null?'':val).toLowerCase().trim();
  return s==='true' || s==='1' || s==='sí' || s==='si' || s==='yes' || val===true;
}
/* Permisos desde la aba Usuarios: esAdmin (flag) + lider (JSON de misiones). Clave de permiso = email. */
function _permisos() {
  var rows = _readRows(SHEETS.USUARIOS);
  var admins = [], lideres = {};
  rows.forEach(function(r){
    var email = String(r.email||'').toLowerCase().trim(); if(!email) return;   // admin/líder requieren email
    if(_esAdminFlag(r.esAdmin)) admins.push(email);
    var mis = _parseLider(r.lider);
    if(mis.length) lideres[email] = (lideres[email]||[]).concat(mis);
  });
  if(!admins.length) admins = ADMIN_FALLBACK.map(function(e){ return e.toLowerCase(); });
  return { admins: admins, lideres: lideres };
}

/* ============ CONFIG (JSON en una celda A1 de la pestaña Config) ============ */
function _readConfig() {
  var sh = _sheet(SHEETS.CONFIG);
  var raw = sh.getRange('A1').getValue();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (x) { return null; }
}
function _saveConfig(body, email) {
  if (!_isAdmin(email)) return { ok:false, error:'forbidden_admin' };
  if (!body.config) return { ok:false, error:'no_config' };
  var sh = _sheet(SHEETS.CONFIG);
  sh.getRange('A1').setValue(JSON.stringify(body.config));
  _audit(email, 'saveConfig', 'config', '');
  return { ok:true };
}

/* ============ USUARIOS (aba única — reemplaza Voluntarios + Admin) ============ */
function _normTel(t){ return String(t==null?'':t).replace(/[^0-9]/g,''); } // solo dígitos, para comparar
function _telText(tel){ var k=_normTel(tel); return "'+" + k; } // texto con "+" (Sheets no lo vuelve número)

/* login/auto-registro: crea o actualiza SOLO los datos (no toca roles esAdmin/lider) */
function _upsertVoluntario(body, email) {
  var v = body.voluntario || {};
  if (!v.telefono || !v.nombre) return { ok:false, error:'datos_incompletos' };
  var telKey = _normTel(v.telefono);
  var sh = _sheet(SHEETS.USUARIOS);
  var rows = _readRows(SHEETS.USUARIOS);
  var idx = rows.findIndex(function(r){ return _normTel(r.telefono) === telKey; });
  if (idx >= 0) {
    // actualizar datos, preservar esAdmin/lider existentes
    _updateRow(sh, idx, { telefono:_telText(v.telefono), nombre:v.nombre, email:(email||v.email||rows[idx].email||''), idioma:(v.idioma||rows[idx].idioma||'es'), actualizadoEm:new Date().toISOString() });
  } else {
    _appendRow(sh, { telefono:_telText(v.telefono), nombre:v.nombre, email:(email||v.email||''), esAdmin:false, lider:'[]', idioma:(v.idioma||'es'), actualizadoEm:new Date().toISOString() });
  }
  _audit(email||v.telefono, 'upsertVoluntario', 'usuario', telKey);
  return { ok:true };
}

/* ============ GESTIÓN UNIFICADA DE USUARIO (solo admin) ============
   Reconcilia en UNA transacción: fila de Voluntarios (datos) + filas de Admin (roles).
   body.usuario = { telefono, nombre, email, esAdmin:bool, misionesLider:[misionId] }
   - telefono y nombre: obligatorios siempre (clave = telefono).
   - email: obligatorio si esAdmin o hay misionesLider (vínculo Voluntarios<->Admin).
   - Protección del último admin: si se desmarca admin y quedaría 0 admins, se rechaza.
   Devuelve permisos + voluntarios frescos para que el cliente refresque. */
function _saveUsuario(body, email) {
  if (!_isAdmin(email)) return { ok:false, error:'forbidden_admin' };
  var u = body.usuario || {};
  var nombre = String(u.nombre||'').trim();
  var telKey = _normTel(u.telefono);
  var mail = String(u.email||'').toLowerCase().trim();
  var esAdmin = !!u.esAdmin;
  var misiones = Array.isArray(u.misionesLider) ? u.misionesLider.map(function(m){ return String(m).trim(); }).filter(Boolean) : [];
  var esLider = misiones.length > 0;

  if (!telKey || !nombre) return { ok:false, error:'datos_incompletos' };
  if ((esAdmin || esLider) && !mail) return { ok:false, error:'email_requerido' };

  // protección del último admin: si esta persona es el único admin y se está desmarcando, rechazar
  if (!esAdmin && mail) {
    var permPre = _permisos();
    var admins = permPre.admins || [];
    if (admins.length <= 1 && admins.indexOf(mail) >= 0) {
      return { ok:false, error:'last_admin', permisos:permPre };
    }
  }

  // upsert de UNA fila en Usuarios: datos + esAdmin (flag) + lider (JSON de misiones)
  var sh = _sheet(SHEETS.USUARIOS);
  var rows = _readRows(SHEETS.USUARIOS);
  var idx = rows.findIndex(function(r){ return _normTel(r.telefono) === telKey; });
  var rec = {
    telefono:_telText(telKey), nombre:nombre, email:mail,
    esAdmin: (esAdmin ? true : false),
    lider: JSON.stringify(misiones),
    idioma:(u.idioma||'es'), actualizadoEm:new Date().toISOString()
  };
  if (idx >= 0) _updateRow(sh, idx, rec); else _appendRow(sh, rec);

  SpreadsheetApp.flush();
  _audit(email, 'saveUsuario', 'usuario', telKey + (mail?('/'+mail):'') + ' admin='+esAdmin+' lider='+misiones.join(','));
  return { ok:true, permisos:_permisos(), voluntarios:_readRows(SHEETS.USUARIOS) };
}

function _delVoluntario(body, email){
  if (!_isAdmin(email)) return { ok:false, error:'forbidden_admin' };
  var telKey = _normTel(body.telefono);
  if (!telKey) return { ok:false, error:'sin_telefono' };
  var sh = _sheet(SHEETS.USUARIOS);
  var rows = _readRows(SHEETS.USUARIOS);
  // email + si es admin (para proteger el último admin)
  var mail = '', eraAdmin = false;
  rows.forEach(function(r){ if(_normTel(r.telefono)===telKey){ if(r.email) mail=String(r.email).toLowerCase().trim(); if(_esAdminFlag(r.esAdmin)) eraAdmin=true; } });
  if (eraAdmin && mail) {
    var perm = _permisos(); var admins = perm.admins || [];
    if (admins.length <= 1 && admins.indexOf(mail) >= 0) {
      return { ok:false, error:'last_admin', permisos:perm };
    }
  }
  // borrar la(s) fila(s) de este teléfono
  for (var i = rows.length - 1; i >= 0; i--) {
    if (_normTel(rows[i].telefono) === telKey) sh.deleteRow(i + 2);
  }
  SpreadsheetApp.flush();
  _audit(email, 'delVoluntario', 'usuario', telKey);
  return { ok:true, permisos:_permisos(), voluntarios:_readRows(SHEETS.USUARIOS) };
}

function _dedupeVoluntarios(body, email){
  if (!_isAdmin(email)) return { ok:false, error:'forbidden_admin' };
  var sh = _sheet(SHEETS.USUARIOS);
  var rows = _readRows(SHEETS.USUARIOS);
  // quedarse con la ÚLTIMA fila por teléfono; borrar las demás
  var lastByTel = {};
  rows.forEach(function(r,i){ var k=_normTel(r.telefono); if(k) lastByTel[k]=i; });
  var keep = {}; Object.keys(lastByTel).forEach(function(k){ keep[lastByTel[k]]=true; });
  for (var i = rows.length - 1; i >= 0; i--) {
    if (!keep[i]) sh.deleteRow(i + 2);
  }
  _audit(email, 'dedupeVoluntarios', 'usuario', String(rows.length)+'→'+Object.keys(lastByTel).length);
  return { ok:true, antes:rows.length, despues:Object.keys(lastByTel).length };
}

/* ============ INSCRIPCIONES (con validación de cupo) ============ */
function _inscribir(body, email) {
  var i = body.inscripcion || {};
  // { activityId, misionId, templateId, fecha, rol, capacidad, voluntario }
  if (!i.activityId || !i.rol || !i.voluntario) return { ok:false, error:'datos_incompletos' };
  var rows = _readRows(SHEETS.INSCRIPCIONES);
  // ya inscrito en esa actividad+rol?
  var yaExiste = rows.some(function(r){ return r.activityId===i.activityId && r.rol===i.rol && r.voluntario===i.voluntario && r.estado!=='cancelado'; });
  if (yaExiste) return { ok:true, estado:'confirmado', dup:true };
  // contar confirmados en ese activityId+rol
  var confirmados = rows.filter(function(r){ return r.activityId===i.activityId && r.rol===i.rol && r.estado==='confirmado'; }).length;
  var cap = Number(i.capacidad || 0);
  var estado = (cap > 0 && confirmados >= cap) ? 'espera' : 'confirmado';
  var sh = _sheet(SHEETS.INSCRIPCIONES);
  _appendRow(sh, {
    id: Utilities.getUuid(), activityId:i.activityId, misionId:i.misionId||'', templateId:i.templateId||'',
    fecha:i.fecha||'', rol:i.rol, voluntario:i.voluntario, estado:estado,
    porEmail:(email||''), creadoEm:new Date().toISOString()
  });
  _audit(email||i.voluntario, 'inscribir:'+estado, 'inscripcion', i.activityId+'/'+i.rol);
  return { ok:true, estado:estado };
}
function _cancelar(body, email) {
  var i = body.inscripcion || body || {};
  var motivo = String(body.motivo || i.motivo || '').trim();
  var sh = _sheet(SHEETS.INSCRIPCIONES);
  var rows = _readRows(SHEETS.INSCRIPCIONES);
  var idx = rows.findIndex(function(r){ return r.activityId===i.activityId && r.rol===i.rol && r.voluntario===i.voluntario && r.estado!=='cancelado'; });
  if (idx < 0) return { ok:true, dup:true };
  _setCell(sh, idx, 'estado', 'cancelado');
  if (motivo) { try { _setCell(sh, idx, 'motivo', motivo); } catch(e){} }   // columna opcional
  _audit(email||i.voluntario, 'cancelar'+(motivo?(' ('+motivo+')'):''), 'inscripcion', i.activityId+'/'+i.rol);
  return { ok:true };
}

/* ============ CHECKLISTS ============ */
function _setChecklistItem(body, email) {
  var c = body.item || {}; // { activityId, itemId, texto, hecho, hechoPor, asignado, suelto }
  if (!c.activityId || !c.itemId) return { ok:false, error:'datos_incompletos' };
  var sh = _sheet(SHEETS.CHECKLISTS);
  var rows = _readRows(SHEETS.CHECKLISTS);
  var idx = rows.findIndex(function(r){ return r.activityId===c.activityId && r.itemId===c.itemId; });
  var rec = {
    activityId:c.activityId, itemId:c.itemId, texto:c.texto||'',
    hecho:!!c.hecho, hechoPor:c.hechoPor||'', asignado:JSON.stringify(c.asignado||null),
    suelto:!!c.suelto, actualizadoEm:new Date().toISOString()
  };
  if (idx >= 0) _updateRow(sh, idx, rec); else _appendRow(sh, rec);
  _audit(email||'', 'setChecklistItem', 'checklist', c.activityId+'/'+c.itemId);
  return { ok:true };
}

/* ============ PERMISOS ============ */
function _verify(idToken) {
  if (!idToken) return null;
  try {
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions:true });
    var info = JSON.parse(resp.getContentText());
    if (info.aud !== GOOGLE_CLIENT_ID) return null;
    if (info.email_verified !== 'true' && info.email_verified !== true) return null;
    return String(info.email || '').toLowerCase();
  } catch (x) { return null; }
}
function _isAdmin(email) {
  if (!email) return false;
  email = email.toLowerCase();
  var admins = _adminList();
  return admins.indexOf(email) >= 0;
}
function _adminList() {
  var rows = _readRows(SHEETS.USUARIOS);
  var list = rows.filter(function(r){ return _esAdminFlag(r.esAdmin) && String(r.email||'').trim(); })
                 .map(function(r){ return String(r.email||'').toLowerCase(); });
  return list.length ? list : ADMIN_FALLBACK.map(function(e){ return e.toLowerCase(); });
}

/* ============ HELPERS DE PLANILLA ============ */
function _ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(name){ var s=_ss().getSheetByName(name); if(!s) s=_ss().insertSheet(name); return s; }
function _ensureSheets() {
  var headers = {};
  headers[SHEETS.CONFIG] = ['config_json'];
  headers[SHEETS.USUARIOS] = ['telefono','nombre','email','esAdmin','lider','idioma','actualizadoEm'];
  headers[SHEETS.INSCRIPCIONES] = ['id','activityId','misionId','templateId','fecha','rol','voluntario','estado','porEmail','creadoEm','motivo'];
  headers[SHEETS.CHECKLISTS] = ['activityId','itemId','texto','hecho','hechoPor','asignado','suelto','actualizadoEm'];
  headers[SHEETS.AUDIT] = ['timestamp','usuario','accion','tipo','ref'];
  Object.keys(headers).forEach(function(name){
    var sh = _sheet(name);
    if (name === SHEETS.CONFIG) return; // Config usa A1 libre
    if (sh.getLastRow() === 0) sh.appendRow(headers[name]);
  });
  // Usuarios: sembrar el admin fallback si la aba está vacía (solo cabecera)
  var usr = _sheet(SHEETS.USUARIOS);
  if (usr.getLastRow() === 1) {
    _appendRow(usr, { telefono:'', nombre:'Admin', email:ADMIN_FALLBACK[0], esAdmin:true, lider:'[]', idioma:'es', actualizadoEm:new Date().toISOString() });
  }
  // NOTA: las abas 'Voluntarios' y 'Admin' quedaron obsoletas — bórralas manualmente en la planilha.
}
function _headers(name){ var sh=_sheet(name); return sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0]; }
function _readRows(name){
  var sh=_sheet(name); var last=sh.getLastRow(); if(last<2) return [];
  var cols=sh.getLastColumn(); var vals=sh.getRange(2,1,last-1,cols).getValues(); var h=_headers(name);
  return vals.map(function(row){ var o={}; h.forEach(function(k,i){ o[k]=row[i]; }); return o; });
}
function _appendRow(sh, obj){ var h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; sh.appendRow(h.map(function(k){ return (k in obj)?obj[k]:''; })); }
function _updateRow(sh, idx, obj){ var h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; var r=idx+2; h.forEach(function(k,i){ if(k in obj) sh.getRange(r,i+1).setValue(obj[k]); }); }
function _setCell(sh, idx, col, val){ var h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; var c=h.indexOf(col); if(c>=0) sh.getRange(idx+2,c+1).setValue(val); }
function _audit(usuario, accion, tipo, ref){ try{ _sheet(SHEETS.AUDIT).appendRow([new Date().toISOString(), usuario||'', accion||'', tipo||'', ref||'']); }catch(x){} }
function _json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
