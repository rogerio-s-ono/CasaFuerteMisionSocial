# Session Summary — CasaFuerteMisionSocial (workspace)

## Projeto
App de **gestão de voluntários** das missões sociais da Casa Fuerte Church (Leganés/Madrid).
Complementa o site institucional `casafuertechurch.com` (feito em Lovable) — NÃO o substitui.
Foco: voluntário encontra **agenda**, vê **time montado** por atividade, **se inscreve/confirma**; líder monta escala e marca presença.

## Repositório
- **GitHub (PRIVADO):** `git@github.com:rogerio-s-ono/CasaFuerteMisionSocial.git`
- Criado via `gh` CLI (instalado em `~/.local/bin/gh`, conta `rogerio-s-ono`, protocolo SSH).
- Convenção GitHub padrão herdada de `~/Projects/Personal/.kiro/steering/github-integration.md`.

## Stack (padrão gideao300)
PWA HTML/JS/CSS puro + Google Sheets via Apps Script + login Google + WhatsApp wa.me. Offline-first. Idiomas PT+ES (default es).
- node portátil p/ validar: `/tmp/node-v20.11.1-linux-x64/bin/node` (some entre sessões; rebaixar de nodejs.org/dist/v20.11.1).

## Escopo
- Gerencia VOLUNTÁRIOS/escalas. **NÃO** cadastra beneficiários/atendidos (dados sensíveis fora por ora — módulo futuro protegido).

## Piloto: Banco de Alimentos (mensal) — ver docs/dominio-piloto.md
Duas cadeias independentes, 9 atividades/mês:
- **Cadeia A (MercaMadrid, perecíveis, 1º fim de semana):** A1 retirada sáb 8h (2 motoristas furgoneta+2 ajudantes); A2 prep sáb tarde (6, monta caixas dos pastores); A3 prep dom 8h (10, separa bolsas dos diáconos); A4 distribuição dom 12h–16h (6, pausa entre cultos ~14h); A5 limpeza dom ~16h (4).
- **Cadeia B (Banco de Alimentos, 1ª quarta):** B1 retirada 10h (2+2); B2 prep 16h (10); B3 distribuição 18h–19h30 (6); B4 limpeza após (mesma equipe B3).
- Papel **motorista** = requer furgoneta (qualificado). Pessoa pode acumular papéis no mesmo dia.
- Recorrência: `mensal_posicao` (ex.: 1º sábado, 1ª quarta). Também suporta `semanal` e `avulso` p/ outras frentes.

## Outras frentes (fora do piloto, modelo já acomoda)
Plaza Mayor (ter 17h), Villaverde (qui 19h30), Cañada Real (sex 10h30), Jurídico (1ª quarta 19h), Emocional à família (a definir), Networking empregos (a definir).

## Estado do código (v0.1.0 — esqueleto)
- `app/app.js`: modelo de domínio (ROLES, RECURRENCE, SEED_TEMPLATES das 9 atividades), `generateActivities(ano,mes)`, `nthWeekdayOfMonth`, `toISODateLocal` (corrige bug de fuso do toISOString), `countByRole`, `vagasRestantes`. Exportado em `window.CFMS`.
- `app/index.html`: UI inicial de agenda (navega meses, renderiza atividades geradas, vagas por papel). Estilo dourado/grafite/off-white.
- `app/sw.js`: SW offline-first (version.json sempre da rede).
- `app/config.js`: LOCAL, não versionado (placeholders). `config.example.js` na raiz = template.
- **Testes de lógica:** geração de out/2026 validada (A1/A2=sáb 03, A3-A5=dom 04, B1-B4=qua 07; 9 atividades). Todos PASS.

## Segurança (lições do gideao300 aplicadas desde o início)
- `.gitignore` cobre `*.real`, `config.js`, `*-real.json`, `.env`, chaves.
- Nenhum dado pessoal real no repo. `config.js` versionado NÃO (só o .example com placeholders).

## Autenticação (DECIDIDO 2026-09-28 — sem auth complexa)
Login de dois níveis, baixo atrito:
- **Voluntários:** login SIMPLES — (a) **telefone + nome** (sem senha/SMS; número = identificador natural, evita duplicar cadastro e serve p/ lembrete WhatsApp) OU (b) **Google** (um toque). Sessão persiste no dispositivo.
  - Primeira vez (número novo): pede nome + telefone. Depois: só o número reconhece (reusa cadastro).
- **Líderes:** **forçado via Google** (mais controle + gestão de comunicação). Papel de líder concedido por **allowlist** (números/e-mails na planilha) — controla o QUE cada um pode fazer (montar escala, marcar presença), não a barreira de entrada.
- **Nota de segurança:** telefone+nome é IDENTIFICAÇÃO, não autenticação (qualquer um digita qualquer nome). Aceitável p/ auto-inscrição (baixo risco); por isso ações sensíveis (líder) exigem Google.

## Design / UI (validado iterativamente — mock em design/)
- Baseline visual = **site institucional casafuertechurch.com** (NÃO o Gideão): **monocromático grafite/branco**, fontes **Cormorant Garamond (títulos, itálico) + Jost (corpo)**, minimalista/elegante, cantos discretos.
- **Accent = dourado do logo Misión Social `#f5c518`** (resolve o "muito neutro"). Institucional=neutro; missão=neutro+dourado.
- **Tons por TIPO de atividade** (dessaturados): retirada=azul-ardósia `#3a5a78`; preparação=terroso `#8a6d3b`; distribuição=verde-oliva `#4a7052`; limpeza=ardósia `#5a6570`. Barra lateral + tag + legenda.
- **Header:** logo **Casa Fuerte à esquerda** (branco via invert) + **Misión Social à direita**, tamanhos coerentes (~44/46px), linha-com-ponto divisória.
- **Login:** logo igreja acima + **logo missão ao centro** com **glow dourado** + **card "Entrando…" com borda dourada girando** (conic-gradient + lc-spin) — padrão da animação do Gideão 300, recolorido p/ paleta missão.
- **Logos:** `app/assets/logo-casafuerte.png` (do favicon do site), `logo-mision-social.jpg` (fornecido pelo usuário) + versões processadas `-transp.png` e `-dark.png` (fundo transparente, texto branco + mãos douradas, p/ header escuro; geradas via Pillow).
- **UX validada:** dashboard "o que vem" (hero próxima atividade + KPIs + cards) · **wizard 3 passos** (Atividade→Função→Confirmar+revisão) com caixas de seleção grandes · nav inferior. Boas práticas pesquisadas (self-signup, stepper honesto, validação por passo, revisão antes de confirmar, alvos ≥44px).
- **Mocks:** `design/CFMS_Design_v4.html` (app c/ tons+logos), `design/CFMS_Design_v5.html` (login). v1/v2/v3 = iterações (v2 tinha paleta errada laranja-magenta-roxo; descartada). Ícones ainda emoji nos mocks → trocar por SVG na versão real.

## Próximos passos (backlog)

## === ESTADO ATUAL (2026-09-29) — RETOMAR AQUI ===
App v0.5.5 no repo (github.com/rogerio-s-ono/CasaFuerteMisionSocial, branch main). Arquitetura CONFIGURÁVEL completa e funcionando (localStorage, sem backend ainda):
- **app.js v0.5.x:** modelo CONFIG {roles[], misiones[]} substituiu SEED_TEMPLATES. generateActivities lê CONFIG. 4 tipos recorrência. horaInicio+duracionMin→início–fim. Compat ui.js (window.CFMS.ROLES getter, cadenaLabel=misionLabel).
- **Telas prontas no app real:** login (teléfono+DDI/Google), dashboard, agenda, wizard multi-seleção (pula passo função se papel único), Mis turnos, Líder (por dia/por função + seletor de missão p/ líder de várias), Admin (CRUD misiones/actividades/plazas/roles), Checklist do líder (plantilla+instância+atribuição+avulso+rol sugerido). Perfis demo: voluntario/lider_A/lider_B/lider_AB/admin (seletor no topo).
- **Persistência:** localStorage — chaves mf_config, mf_user, mf_known, mf_inscr, mf_espera, mf_lider_adds, mf_chk. Isolado por dispositivo/URL (não compartilhado). DEFAULT_CONFIG hardcoded em app.js = semente (MercaMadrid+Banco).
- **Bugs corrigidos na revisão:** líder vazio (A/B→misionId), tmplId (novo id mision:TMPL-data), toggleAcc accordion admin, prompt/confirm→inline (PWA bloqueia), z-index sheet asignar (60/61), sheet max-height 80vh+scroll, rol sugerido no template.

## BACKEND — EM DEFINIÇÃO (retomar)
Criado design/CFMS_Concept_Backend_v1.html (arquitetura para validar). Proposta: **Google Apps Script Web App + Sheets** (stack do Gideão 300), offline-first (localStorage=cache + fila pendentes), pull/push. Pestañas: Config(JSON numa célula), Voluntarios, Inscripciones, Checklists, Auditoría. Conflitos: last-write-wins por campo; CUPO validado no servidor via LockService (evita sobrecupo). Login Google + allowlist (admin/líder por missão). Plano em 5 fases (F1=config compartida primeiro).
**Perguntas em aberto p/ o usuário validar (no HTML):** (1) confirma Apps Script+Sheets? (2) Config JSON-em-célula vs filas (recomendo JSON)? (3) planilha nova vs reusar Gideão (recomendo nova)? (4) começar pela Fase 1 (config compartida)?
**Túnel mobile (temporário, muda a cada reinício):** cloudflared em /tmp/cf-tunnel.log; servidor node /tmp/cfms-server.js na porta 8091 servindo a raiz do projeto. node em /tmp/node-v20.11.1-linux-x64.

## OUTRAS PENDÊNCIAS
- Comunicação em grupos (incluindo lista de espera) — feature mencionada, não iniciada.
- Header: goLogin + logos reduzidos aplicados (v0.5.x).

## Próximos passos originais (backlog)
1. Implementar backend Apps Script (Sheets: Voluntarios, Frentes/Templates, Atividades, Inscricoes) + doGet/doPost.
2. Login Google + allowlist (reaproveitar do gideao300).
3. Fluxo participar/cancelar (inscrição) + lista de espera.
4. Tela do líder: montar escala do mês (gerar atividades) + marcar presença.
5. Lembretes WhatsApp wa.me.
6. i18n PT/ES completa. Ícones/manifest reais. Definir hospedagem (repo privado → Cloudflare/Netlify/Vercel grátis, ou GitHub Pages c/ Pro).
