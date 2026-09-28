/* Casa Fuerte — Misión Social · app.js
   Esqueleto inicial (v0.1.0). Foco: estrutura de dados do domínio + seed de templates.
   Stack alvo: PWA + Google Sheets (Apps Script) + login Google, como o gideao300.
   Este arquivo ainda NÃO implementa sync/login — é a fundação do modelo de dados e UI. */

'use strict';

const APP_VERSION = '0.1.0';
const CFG = window.CFMS_CONFIG || {};

/* =========================================================================
   MODELO DE DOMÍNIO
   -------------------------------------------------------------------------
   FRENTE (frente de missão) — ex.: Banco de Alimentos, Plaza Mayor...
   TEMPLATE (modelo recorrente de atividade) — gera ATIVIDADES no calendário
   ATIVIDADE (ocorrência datada) — tem PAPÉIS com capacidade
   VOLUNTÁRIO (perfil) — contato, papéis preferidos/aprovados, furgoneta?
   INSCRIÇÃO — voluntário × atividade × papel × status
   ========================================================================= */

/** Papéis do piloto. 'furgoneta' marca requisito (motorista precisa de furgoneta). */
const ROLES = {
  motorista:   { id: 'motorista',   label: { pt: 'Motorista (furgoneta)', es: 'Conductor (furgoneta)' }, requiresFurgoneta: true },
  ajudante:    { id: 'ajudante',    label: { pt: 'Ajudante de carga',      es: 'Ayudante de carga' } },
  preparacao:  { id: 'preparacao',  label: { pt: 'Preparação',             es: 'Preparación' } },
  distribuicao:{ id: 'distribuicao',label: { pt: 'Distribuição',           es: 'Distribución' } },
  limpeza:     { id: 'limpeza',     label: { pt: 'Limpeza',                es: 'Limpieza' } }
};

/** Tipos de recorrência suportados. */
const RECURRENCE = {
  SEMANAL: 'semanal',              // por dia da semana
  MENSAL_POSICAO: 'mensal_posicao',// ex.: 1º sábado, 1ª quarta
  AVULSO: 'avulso'                 // datas pontuais
};

/**
 * Templates das atividades do piloto Banco de Alimentos.
 * weekday: 0=dom,1=seg,...,6=sáb. ordinal: 1 = "primeiro" do mês.
 * roles: capacidade por papel. notes: observações operacionais.
 * Ver docs/dominio-piloto.md.
 */
const SEED_TEMPLATES = [
  // ---- Cadeia A — MercaMadrid (perecíveis) ----
  { id: 'A1', frente: 'banco_alimentos', cadeia: 'A',
    titulo: { pt: 'Retirada MercaMadrid', es: 'Recogida MercaMadrid' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 6, hora: '08:00',
    roles: { motorista: 2, ajudante: 2 },
    notes: { pt: 'Perecíveis (frutas, legumes, vegetais).', es: 'Perecederos (frutas, verduras).' } },

  { id: 'A2', frente: 'banco_alimentos', cadeia: 'A',
    titulo: { pt: 'Preparação (sábado)', es: 'Preparación (sábado)' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 6, hora: '15:00',
    roles: { preparacao: 6 },
    notes: { pt: 'Triagem parcial; separar distribuível; montar caixas dos pastores.',
             es: 'Triaje parcial; separar distribuible; montar cajas de los pastores.' } },

  { id: 'A3', frente: 'banco_alimentos', cadeia: 'A',
    titulo: { pt: 'Preparação (domingo)', es: 'Preparación (domingo)' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 0, hora: '08:00',
    roles: { preparacao: 10 },
    notes: { pt: 'Preparação final + separar bolsas dos diáconos.',
             es: 'Preparación final + separar bolsas de los diáconos.' } },

  { id: 'A4', frente: 'banco_alimentos', cadeia: 'A',
    titulo: { pt: 'Distribuição (domingo)', es: 'Distribución (domingo)' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 0, hora: '12:00',
    roles: { distribuicao: 6 },
    notes: { pt: 'Janela 12h–16h; pausa e retomada ~14h (entre os cultos).',
             es: 'Franja 12h–16h; pausa y reanudación ~14h (entre cultos).' } },

  { id: 'A5', frente: 'banco_alimentos', cadeia: 'A',
    titulo: { pt: 'Limpeza (domingo)', es: 'Limpieza (domingo)' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 0, hora: '16:00',
    roles: { limpeza: 4 },
    notes: { pt: 'Após a distribuição; geralmente as mesmas pessoas.',
             es: 'Tras la distribución; normalmente las mismas personas.' } },

  // ---- Cadeia B — Banco de Alimentos (outros alimentos) ----
  { id: 'B1', frente: 'banco_alimentos', cadeia: 'B',
    titulo: { pt: 'Retirada Banco de Alimentos', es: 'Recogida Banco de Alimentos' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 3, hora: '10:00',
    roles: { motorista: 2, ajudante: 2 },
    notes: { pt: 'Outros tipos de alimentos.', es: 'Otros tipos de alimentos.' } },

  { id: 'B2', frente: 'banco_alimentos', cadeia: 'B',
    titulo: { pt: 'Preparação', es: 'Preparación' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 3, hora: '16:00',
    roles: { preparacao: 10 },
    notes: { pt: 'Triagem, separação, empacotamento.', es: 'Triaje, separación, empaquetado.' } },

  { id: 'B3', frente: 'banco_alimentos', cadeia: 'B',
    titulo: { pt: 'Distribuição', es: 'Distribución' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 3, hora: '18:00',
    roles: { distribuicao: 6 },
    notes: { pt: '18h–19h30.', es: '18h–19h30.' } },

  { id: 'B4', frente: 'banco_alimentos', cadeia: 'B',
    titulo: { pt: 'Limpeza', es: 'Limpieza' },
    recurrence: RECURRENCE.MENSAL_POSICAO, ordinal: 1, weekday: 3, hora: '19:30',
    roles: { limpeza: 4 },
    notes: { pt: 'Mesma equipe da distribuição.', es: 'Mismo equipo de la distribución.' } }
];

/* =========================================================================
   GERAÇÃO DE ATIVIDADES A PARTIR DOS TEMPLATES
   ========================================================================= */

/** Formata uma Date como 'YYYY-MM-DD' em horário LOCAL (evita bug de fuso do toISOString). */
function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Retorna a data do N-ésimo (ordinal) dia-da-semana (weekday) do mês/ano. */
function nthWeekdayOfMonth(year, month /*0-11*/, weekday /*0-6*/, ordinal /*1..5*/) {
  const first = new Date(year, month, 1);
  const shift = (weekday - first.getDay() + 7) % 7;
  const day = 1 + shift + (ordinal - 1) * 7;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? d : null; // null se estourar o mês
}

/** Gera as atividades (ocorrências datadas) de um mês a partir dos templates. */
function generateActivities(year, month /*0-11*/, templates = SEED_TEMPLATES) {
  const out = [];
  for (const t of templates) {
    let date = null;
    if (t.recurrence === RECURRENCE.MENSAL_POSICAO) {
      date = nthWeekdayOfMonth(year, month, t.weekday, t.ordinal);
    }
    if (!date) continue;
    const iso = toISODateLocal(date); // local, não UTC (evita deslocamento de fuso)
    out.push({
      id: `${t.id}-${iso}`,
      templateId: t.id,
      frente: t.frente,
      cadeia: t.cadeia,
      titulo: t.titulo,
      data: iso,
      hora: t.hora,
      roles: Object.assign({}, t.roles), // capacidade por papel
      notes: t.notes,
      inscricoes: [] // preenchido via backend
    });
  }
  // ordenar por data + hora
  out.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  return out;
}

/* =========================================================================
   HELPERS DE OCUPAÇÃO / VAGAS
   ========================================================================= */

/** Conta inscritos confirmados por papel numa atividade. */
function countByRole(activity, roleId) {
  return (activity.inscricoes || [])
    .filter((i) => i.papel === roleId && (i.status === 'confirmado' || i.status === 'presente'))
    .length;
}

/** Vagas restantes de um papel (pode ser negativo se houver lista de espera). */
function vagasRestantes(activity, roleId) {
  const cap = activity.roles[roleId] || 0;
  return cap - countByRole(activity, roleId);
}

/* Exportar para uso no index.html / testes (quando houver módulos/ferramentas). */
window.CFMS = {
  APP_VERSION, ROLES, RECURRENCE, SEED_TEMPLATES,
  nthWeekdayOfMonth, toISODateLocal, generateActivities, countByRole, vagasRestantes
};

/* Registro do service worker (offline-first). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW falhou', e));
  });
}
