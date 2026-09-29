/* Manos Fuertes — sync.js
   Camada de sincronización con el backend (Apps Script Web App).
   Offline-first: el caché local (localStorage) es la fuente de lectura instantánea;
   el pull refresca desde el servidor y el push envía cambios (con cola de pendientes).

   Expone window.MFSync:
     init()                     — pull inicial + listeners de reconexión
     pull()                     — trae {config, voluntarios, inscripciones, checklists}
     pushConfig(config)         — guarda la config en el servidor (solo admin)
     queue(action, payload)     — encola una escritura (inscribir, checklist…) y intenta enviar
     onStatus(cb)               — notifica cambios de estado de sync
     status()                   — 'ok' | 'pending' | 'offline' | 'error' | 'syncing' | 'off'
   Si no hay SHEET_WEBAPP_URL configurada, opera en modo LOCAL (sin servidor) — como hasta ahora. */
'use strict';
(function(){
  var CFG = window.CFMS_CONFIG || {};
  var URL = CFG.SHEET_WEBAPP_URL || '';
  var TOKEN = CFG.SYNC_TOKEN || '';
  var ENABLED = !!URL && URL.indexOf('XX(X)') === -1 && URL.indexOf('/exec') > -1;

  var state = ENABLED ? 'ok' : 'off';
  var listeners = [];
  var QUEUE_KEY = 'mf_sync_queue';
  var CACHE_KEY = 'mf_sync_cache';   // último pull cacheado (para offline)

  function setStatus(s){ state = s; listeners.forEach(function(cb){ try{ cb(s); }catch(e){} }); }
  function onStatus(cb){ listeners.push(cb); cb(state); }
  function status(){ return state; }

  function idToken(){ try{ return sessionStorage.getItem('mf_idtoken') || null; }catch(e){ return null; } }
  function loadQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); }catch(e){ return []; } }
  function saveQueue(q){ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
  function cacheGet(){ try{ return JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); }catch(e){ return null; } }
  function cacheSet(d){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }catch(e){} }

  /* ---- PULL ---- */
  function pull(){
    if(!ENABLED) return Promise.resolve({ local:true, data: cacheGet() });
    setStatus('syncing');
    var u = URL + '?action=pull&token=' + encodeURIComponent(TOKEN) + (idToken()?('&idToken='+encodeURIComponent(idToken())):'');
    return fetch(u, { method:'GET' })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(!j.ok) throw new Error(j.error||'pull_failed');
        cacheSet(j.data);
        flush(); // intenta enviar pendientes tras un pull ok
        return { data:j.data };
      })
      .catch(function(err){
        setStatus(navigator.onLine ? 'error' : 'offline');
        return { error:String(err), data: cacheGet() };  // fallback al caché
      });
  }

  /* ---- POST genérico ---- */
  function post(action, payload){
    var body = Object.assign({ token:TOKEN, action:action, idToken:idToken() }, payload||{});
    return fetch(URL, { method:'POST', body: JSON.stringify(body) })
      .then(function(r){ return r.json(); });
  }

  /* ---- CONFIG (admin) ---- */
  function pushConfig(config){
    if(!ENABLED){ return Promise.resolve({ ok:true, local:true }); }
    setStatus('syncing');
    return post('saveConfig', { config: config })
      .then(function(j){ setStatus(j.ok?'ok':'error'); return j; })
      .catch(function(err){ enqueue('saveConfig', { config: config }); return { ok:false, queued:true, error:String(err) }; });
  }

  /* ---- COLA de escrituras (inscribir, cancelar, setChecklistItem, upsertVoluntario) ---- */
  function enqueue(action, payload){
    var q = loadQueue(); q.push({ action:action, payload:payload, ts:Date.now() }); saveQueue(q);
    setStatus('pending');
  }
  function queue(action, payload){
    if(!ENABLED) return Promise.resolve({ ok:true, local:true });
    enqueue(action, payload);
    return flush();
  }
  var flushing = false;
  function flush(){
    if(!ENABLED || flushing) return Promise.resolve();
    var q = loadQueue();
    if(!q.length){ if(state==='pending') setStatus('ok'); return Promise.resolve(); }
    if(!navigator.onLine){ setStatus('offline'); return Promise.resolve(); }
    flushing = true; setStatus('syncing');
    var item = q[0];
    return post(item.action, item.payload)
      .then(function(j){
        if(j && j.ok){ var qq=loadQueue(); qq.shift(); saveQueue(qq); flushing=false; return flush(); } // siguiente
        else { flushing=false; setStatus('error'); }
      })
      .catch(function(){ flushing=false; setStatus(navigator.onLine?'error':'offline'); });
  }

  /* ---- init: pull inicial + reintentos al reconectar / volver a foco ---- */
  function init(){
    if(!ENABLED){ setStatus('off'); return Promise.resolve({ local:true }); }
    window.addEventListener('online', function(){ flush(); });
    window.addEventListener('visibilitychange', function(){ if(!document.hidden) flush(); });
    setInterval(flush, 3*60*1000); // reintento periódico cada 3 min
    return pull();
  }

  window.MFSync = { init:init, pull:pull, pushConfig:pushConfig, post:post, queue:queue, onStatus:onStatus, status:status, enabled:ENABLED };
})();
