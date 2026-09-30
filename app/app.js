/* Manos Fuertes — Misión Social Casa Fuerte · app.js
   v0.5.0 — Arquitectura CONFIGURABLE: las misiones dejan de estar fijas en el código
   y pasan a ser datos (CONFIG) que el Admin edita. generateActivities lee de CONFIG.
   Compatibilidad: las ocurrencias generadas mantienen los campos que ui.js ya usa
   (cadeia, roles{id:cap}, titulo, hora, notes, templateId) + nuevos (misionId, horaFin, checklistTemplate). */

'use strict';

const APP_VERSION = '0.21.1';
const CFG = window.CFMS_CONFIG || {};

/* =========================================================================
   RECORRENCIA
   ========================================================================= */
const RECURRENCE = {
  SEMANAL: 'semanal',               // params: { weekday }
  MENSAL_POSICAO: 'mensal_posicao', // params: { weekday, ordinal } (ex.: 1º sábado)
  MENSAL_DIA: 'mensal_dia',         // params: { day } (1..31)
  AVULSO: 'avulso'                  // params: { fechas: ['YYYY-MM-DD', ...] }
};

/* =========================================================================
   CONFIGURACIÓN POR DEFECTO (semilla) — el Admin puede editar y se guarda aparte
   -------------------------------------------------------------------------
   CONFIG = { roles:[...], misiones:[...] }
   rol:      { id, nombre{pt,es}, requisito?, activo }
   mision:   { id, nombre, descripcion?, color, activo, lideres:[email],
               actividades:[actividad] }
   actividad:{ id, nombre{pt,es}, horaInicio, duracionMin?, notas{pt,es}?,
               recurrencia:{tipo, ...params}, activo, plazas:[{rolId, cap}],
               checklistTemplate:[{id, texto{pt,es}, orden, rolSugerido?}] }
   ========================================================================= */
const DEFAULT_CONFIG = {
  roles: [
    { id:'motorista',    nombre:{ pt:'Motorista (furgoneta)', es:'Conductor (furgoneta)' }, requisito:{ pt:'furgoneta', es:'furgoneta' }, activo:true },
    { id:'ajudante',     nombre:{ pt:'Ajudante de carga',      es:'Ayudante de carga' }, activo:true },
    { id:'preparacao',   nombre:{ pt:'Preparação',             es:'Preparación' }, activo:true },
    { id:'distribuicao', nombre:{ pt:'Distribuição',           es:'Distribución' }, activo:true },
    { id:'limpeza',      nombre:{ pt:'Limpeza',                es:'Limpieza' }, activo:true }
  ],
  misiones: [
    {
      id:'mercamadrid', nombre:'Misión MercaMadrid', color:'#f2711c', activo:true,
      descripcion:{ pt:'Recolhimento de perecíveis no MercaMadrid e distribuição dominical.', es:'Recogida de perecederos en MercaMadrid y reparto dominical.' },
      lideres:['rogerio.s.ono@gmail.com'],
      actividades:[
        { id:'A1', nombre:{ pt:'Retirada MercaMadrid', es:'Recogida MercaMadrid' }, horaInicio:'08:00', duracionMin:120, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:6, ordinal:1 },
          plazas:[ {rolId:'motorista',cap:2}, {rolId:'ajudante',cap:2} ],
          notas:{ pt:'Perecíveis (frutas, legumes, vegetais).', es:'Perecederos (frutas, verduras).' },
          checklistTemplate:[
            { id:'c1', texto:{ pt:'Conferir a furgoneta', es:'Comprobar furgoneta' }, orden:1, rolSugerido:'motorista' },
            { id:'c2', texto:{ pt:'Levar sacos e caixas', es:'Llevar sacos y cajas' }, orden:2 }
          ] },
        { id:'A2', nombre:{ pt:'Preparação (sábado)', es:'Preparación (sábado)' }, horaInicio:'15:00', duracionMin:180, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:6, ordinal:1 },
          plazas:[ {rolId:'preparacao',cap:6} ],
          notas:{ pt:'Triagem parcial; separar distribuível; montar caixas dos pastores.', es:'Triaje parcial; separar distribuible; montar cajas de los pastores.' },
          checklistTemplate:[
            { id:'c1', texto:{ pt:'Triagem de frutas e vegetais', es:'Triaje de frutas y verduras' }, orden:1 },
            { id:'c2', texto:{ pt:'Separar caixas dos pastores', es:'Separar cajas de los pastores' }, orden:2 }
          ] },
        { id:'A3', nombre:{ pt:'Preparação (domingo)', es:'Preparación (domingo)' }, horaInicio:'08:00', duracionMin:180, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:0, ordinal:1 },
          plazas:[ {rolId:'preparacao',cap:10} ],
          notas:{ pt:'Preparação final + separar bolsas dos diáconos.', es:'Preparación final + separar bolsas de los diáconos.' },
          checklistTemplate:[] },
        { id:'A4', nombre:{ pt:'Distribuição (domingo)', es:'Distribución (domingo)' }, horaInicio:'12:00', duracionMin:240, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:0, ordinal:1 },
          plazas:[ {rolId:'distribuicao',cap:6} ],
          notas:{ pt:'Janela 12h–16h; pausa e retomada ~14h (entre os cultos).', es:'Franja 12h–16h; pausa y reanudación ~14h (entre cultos).' },
          checklistTemplate:[] },
        { id:'A5', nombre:{ pt:'Limpeza (domingo)', es:'Limpieza (domingo)' }, horaInicio:'16:00', duracionMin:90, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:0, ordinal:1 },
          plazas:[ {rolId:'limpeza',cap:4} ],
          notas:{ pt:'Após a distribuição; geralmente as mesmas pessoas.', es:'Tras la distribución; normalmente las mismas personas.' },
          checklistTemplate:[] }
      ]
    },
    {
      id:'banco', nombre:'Misión Banco de Alimentos', color:'#3a5a78', activo:true,
      descripcion:{ pt:'Recolhimento no Banco de Alimentos e distribuição na quarta.', es:'Recogida en el Banco de Alimentos y reparto el miércoles.' },
      lideres:['tania.eustaqui@gmail.com'],
      actividades:[
        { id:'B1', nombre:{ pt:'Retirada Banco de Alimentos', es:'Recogida Banco de Alimentos' }, horaInicio:'10:00', duracionMin:120, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:3, ordinal:1 },
          plazas:[ {rolId:'motorista',cap:2}, {rolId:'ajudante',cap:2} ],
          notas:{ pt:'Outros tipos de alimentos.', es:'Otros tipos de alimentos.' }, checklistTemplate:[] },
        { id:'B2', nombre:{ pt:'Preparação', es:'Preparación' }, horaInicio:'16:00', duracionMin:120, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:3, ordinal:1 },
          plazas:[ {rolId:'preparacao',cap:10} ],
          notas:{ pt:'Triagem, separação, empacotamento.', es:'Triaje, separación, empaquetado.' }, checklistTemplate:[] },
        { id:'B3', nombre:{ pt:'Distribuição', es:'Distribución' }, horaInicio:'18:00', duracionMin:90, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:3, ordinal:1 },
          plazas:[ {rolId:'distribuicao',cap:6} ],
          notas:{ pt:'18h–19h30.', es:'18h–19h30.' }, checklistTemplate:[] },
        { id:'B4', nombre:{ pt:'Limpeza', es:'Limpieza' }, horaInicio:'19:30', duracionMin:60, activo:true,
          recurrencia:{ tipo:RECURRENCE.MENSAL_POSICAO, weekday:3, ordinal:1 },
          plazas:[ {rolId:'limpeza',cap:4} ],
          notas:{ pt:'Mesma equipe da distribuição.', es:'Mismo equipo de la distribución.' }, checklistTemplate:[] }
      ]
    }
  ]
};

/* CONFIG viva: por defecto la semilla; ui.js puede sustituirla por la versión guardada. */
let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
function getConfig(){ return CONFIG; }
function setConfig(cfg){ CONFIG = cfg; }
function resetConfig(){ CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); return CONFIG; }

/* ---- helpers de acceso a config ---- */
function getRol(rolId){ return CONFIG.roles.find(r=>r.id===rolId) || null; }
function rolLabel(rolId, lang){ const r=getRol(rolId); return r ? (r.nombre[lang]||r.nombre.es) : rolId; }
function rolRequiereFurgoneta(rolId){ const r=getRol(rolId); return !!(r && r.requisito); }
function getMision(misionId){ return CONFIG.misiones.find(m=>m.id===misionId) || null; }
function misionLabel(misionId){ const m=getMision(misionId); return m ? m.nombre : misionId; }
function misionColor(misionId){ const m=getMision(misionId); return m ? m.color : '#767676'; }
/* Compatibilidad con ui.js antiguo (usaba cadenaLabel(cadeia)) */
function cadenaLabel(c){ return misionLabel(c); }

/* =========================================================================
   GENERACIÓN DE OCURRENCIAS A PARTIR DE CONFIG
   ========================================================================= */
function toISODateLocal(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function nthWeekdayOfMonth(year, month, weekday, ordinal){
  const first=new Date(year,month,1);
  const shift=(weekday-first.getDay()+7)%7;
  const day=1+shift+(ordinal-1)*7;
  const d=new Date(year,month,day);
  return d.getMonth()===month ? d : null;
}
/** Todas las fechas de un weekday en el mes (para recurrencia semanal). */
function allWeekdaysOfMonth(year, month, weekday){
  const out=[]; const d=new Date(year,month,1);
  while(d.getMonth()===month){ if(d.getDay()===weekday) out.push(new Date(d)); d.setDate(d.getDate()+1); }
  return out;
}
/** Devuelve las fechas (Date[]) que genera una recurrencia en un mes dado. */
function datesForRecurrence(rec, year, month){
  if(!rec) return [];
  switch(rec.tipo){
    case RECURRENCE.SEMANAL: return allWeekdaysOfMonth(year, month, rec.weekday);
    case RECURRENCE.MENSAL_POSICAO: { const d=nthWeekdayOfMonth(year, month, rec.weekday, rec.ordinal); return d?[d]:[]; }
    case RECURRENCE.MENSAL_DIA: {
      const d=new Date(year, month, rec.day); return d.getMonth()===month ? [d] : [];
    }
    case RECURRENCE.AVULSO: {
      return (rec.fechas||[]).map(s=>new Date(s+'T12:00:00')).filter(d=>d.getFullYear()===year && d.getMonth()===month);
    }
    default: return [];
  }
}
/** hora fin = inicio + duracionMin (HH:MM) o null si no hay duración. */
function calcFin(horaInicio, duracionMin){
  if(!duracionMin) return null;
  const [h,m]=horaInicio.split(':').map(Number);
  const tot=h*60+m+duracionMin;
  const hh=String(Math.floor(tot/60)%24).padStart(2,'0'), mm=String(tot%60).padStart(2,'0');
  return `${hh}:${mm}`;
}

/** Genera las ocurrencias datadas del mes leyendo CONFIG (misiones/actividades activas). */
function generateActivities(year, month){
  const out=[];
  for(const mis of CONFIG.misiones){
    if(mis.activo===false) continue;
    for(const act of mis.actividades){
      if(act.activo===false) continue;
      const fechas=datesForRecurrence(act.recurrencia, year, month);
      for(const date of fechas){
        const iso=toISODateLocal(date);
        // roles: mapa {rolId: cap} para compatibilidad con ui.js
        const rolesMap={}; (act.plazas||[]).forEach(p=>{ rolesMap[p.rolId]=p.cap; });
        out.push({
          id:`${mis.id}:${act.id}-${iso}`,
          templateId:act.id,
          misionId:mis.id,
          cadeia:mis.id,                 // compat: ui.js usa a.cadeia
          color:mis.color,
          titulo:act.nombre,
          data:iso,
          hora:act.horaInicio,
          horaFin:calcFin(act.horaInicio, act.duracionMin),
          duracionMin:act.duracionMin||null,
          roles:rolesMap,
          notes:act.notas||null,
          checklistTemplate:act.checklistTemplate||[],
          inscricoes:[]
        });
      }
    }
  }
  out.sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
  return out;
}

/* =========================================================================
   HELPERS DE OCUPAÇÃO (compat)
   ========================================================================= */
function countByRole(activity, roleId){
  return (activity.inscricoes||[]).filter(i=>i.papel===roleId && (i.status==='confirmado'||i.status==='presente')).length;
}
function vagasRestantes(activity, roleId){ return (activity.roles[roleId]||0) - countByRole(activity, roleId); }

/* ---- ROLES compat: objeto {id:{label{pt,es},requiresFurgoneta}} derivado de CONFIG ---- */
function buildRolesCompat(){
  const o={};
  CONFIG.roles.forEach(r=>{ o[r.id]={ id:r.id, label:r.nombre, requiresFurgoneta:!!r.requisito }; });
  return o;
}

/* Exportar */
window.CFMS = {
  APP_VERSION, RECURRENCE, DEFAULT_CONFIG,
  getConfig, setConfig, resetConfig,
  getRol, rolLabel, rolRequiereFurgoneta, getMision, misionLabel, misionColor, cadenaLabel,
  toISODateLocal, nthWeekdayOfMonth, datesForRecurrence, calcFin, generateActivities,
  countByRole, vagasRestantes, buildRolesCompat,
  get ROLES(){ return buildRolesCompat(); }   // compat: window.CFMS.ROLES sigue funcionando
};

/* Service worker */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW falhou',e)); });
}
