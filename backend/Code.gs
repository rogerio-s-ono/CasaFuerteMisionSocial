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
  VOLUNTARIOS: 'Voluntarios',
  INSCRIPCIONES: 'Inscripciones',
  CHECKLISTS: 'Checklists',
  ADMIN: 'Admin',
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
  return {
    config:        _readConfig(),
    voluntarios:   _readRows(SHEETS.VOLUNTARIOS),
    inscripciones: _readRows(SHEETS.INSCRIPCIONES),
    checklists:    _readRows(SHEETS.CHECKLISTS),
    serverTime:    new Date().toISOString()
  };
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

/* ============ VOLUNTARIOS ============ */
function _upsertVoluntario(body, email) {
  var v = body.voluntario || {};
  if (!v.telefono || !v.nombre) return { ok:false, error:'datos_incompletos' };
  var sh = _sheet(SHEETS.VOLUNTARIOS);
  var rows = _readRows(SHEETS.VOLUNTARIOS);
  var idx = rows.findIndex(function(r){ return r.telefono === v.telefono; });
  var rec = { telefono:v.telefono, nombre:v.nombre, email:(email||v.email||''), idioma:(v.idioma||'es'), actualizadoEm:new Date().toISOString() };
  if (idx >= 0) _updateRow(sh, idx, rec); else _appendRow(sh, rec);
  _audit(email||v.telefono, 'upsertVoluntario', 'voluntario', v.telefono);
  return { ok:true, voluntario:rec };
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
  var i = body.inscripcion || {};
  var sh = _sheet(SHEETS.INSCRIPCIONES);
  var rows = _readRows(SHEETS.INSCRIPCIONES);
  var idx = rows.findIndex(function(r){ return r.activityId===i.activityId && r.rol===i.rol && r.voluntario===i.voluntario && r.estado!=='cancelado'; });
  if (idx < 0) return { ok:true, dup:true };
  _setCell(sh, idx, 'estado', 'cancelado');
  _audit(email||i.voluntario, 'cancelar', 'inscripcion', i.activityId+'/'+i.rol);
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
  var rows = _readRows(SHEETS.ADMIN);
  var list = rows.filter(function(r){ return String(r.papel||'').toLowerCase()==='admin'; }).map(function(r){ return String(r.email||'').toLowerCase(); });
  return list.length ? list : ADMIN_FALLBACK.map(function(e){ return e.toLowerCase(); });
}

/* ============ HELPERS DE PLANILLA ============ */
function _ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(name){ var s=_ss().getSheetByName(name); if(!s) s=_ss().insertSheet(name); return s; }
function _ensureSheets() {
  var headers = {};
  headers[SHEETS.CONFIG] = ['config_json'];
  headers[SHEETS.VOLUNTARIOS] = ['telefono','nombre','email','idioma','actualizadoEm'];
  headers[SHEETS.INSCRIPCIONES] = ['id','activityId','misionId','templateId','fecha','rol','voluntario','estado','porEmail','creadoEm'];
  headers[SHEETS.CHECKLISTS] = ['activityId','itemId','texto','hecho','hechoPor','asignado','suelto','actualizadoEm'];
  headers[SHEETS.ADMIN] = ['email','papel','mision'];
  headers[SHEETS.AUDIT] = ['timestamp','usuario','accion','tipo','ref'];
  Object.keys(headers).forEach(function(name){
    var sh = _sheet(name);
    if (name === SHEETS.CONFIG) return; // Config usa A1 libre
    if (sh.getLastRow() === 0) sh.appendRow(headers[name]);
  });
  // Admin: sembrar fila de instrucciones si vacío
  var adm = _sheet(SHEETS.ADMIN);
  if (adm.getLastRow() === 1) adm.appendRow([ADMIN_FALLBACK[0], 'admin', '']);
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
