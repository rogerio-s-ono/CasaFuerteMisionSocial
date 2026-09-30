# Manos Fuertes — Session Summary

> ⚠️ **AVISO PARA QUALQUER SESSÃO (2026-09-30):** o deploy do **backend `Code.gs` agora é AUTOMÁTICO via clasp** — NÃO faça mais o passo manual antigo (Apps Script → Implementar → Nova versão), e NÃO edite o `Code.gs.real` no OneDrive como caminho de deploy. Para publicar qualquer mudança no backend, rode:
> ```bash
> export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; cd backend && npm run deploy
> ```
> Isso sobe o `Code.gs` e republica a MESMA Web App (URL `/exec` inalterada). O próprio Kiro pode e deve rodar esse comando. Detalhes na seção "Pipeline de deploy automático (clasp)" abaixo. **Importante:** os segredos NÃO ficam mais no `Code.gs` — estão nas Script Properties do projeto; o `Code.gs` versionado só tem placeholders em `setupSecrets()`. Isto NÃO afeta o deploy do FRONTEND (app), que continua sendo `git push origin main` → GitHub Pages.
>
> 🧹 **2026-09-30 (limpeza):** o `Code.gs.real` no OneDrive foi **REMOVIDO** — era o caminho de deploy legado. NÃO recriar. O deploy de backend é SÓ `cd backend && npm run deploy` (clasp). Se alguma sessão pedir para "recolar Code.gs manualmente", está ERRADO — use o clasp. Backend publicado até **@20** (inclui: saveUsuario com email único, _inscribir com temp/porLider, dedup de admins).

## Projeto
PWA de gestão de voluntários das missões sociais da Casa Fuerte Church (Leganés/Madrid). UI em **espanhol**. Mobile-first, HTML/JS/CSS puro (sem framework). Estilo: monocromático grafite/branco + dourado `#f5c518`. Fontes: Cormorant Garamond (títulos itálico) + Jost + Oswald.

## Estado atual: **v0.15.0** (no ar)
- App publicado: https://rogerio-s-ono.github.io/CasaFuerteMisionSocial/
- Repo PÚBLICO (autorizado): github.com/rogerio-s-ono/CasaFuerteMisionSocial — branch **`main`** (NÃO master), Pages via GitHub Actions (.github/workflows/pages.yml, ~1-2min).
- Último commit: d580880.

## Pipeline de deploy automático (clasp) — montado 2026-09-30
- **Objetivo:** eliminar copy/paste manual do Code.gs no editor Apps Script.
- **Node** instalado via nvm (v24.21.0). **clasp 3.4.1** local em `backend/`.
- **Code.gs refatorado:** segredos saíram do código → lidos das **Script Properties** via getters `SYNC_TOKEN()`/`GOOGLE_CLIENT_ID()`/`ADMIN_FALLBACK()` + função `setupSecrets()`. Segredos já gravados nas Properties (SYNC_TOKEN=Mateo#25:40, CLIENT_ID, ADMIN_FALLBACK=rogerio.s.ono@gmail.com). setupSecrets() voltou a placeholders.
- **Arquivos:** `backend/appsscript.json` (webapp USER_DEPLOYING/ANYONE_ANONYMOUS), `package.json` (scripts push/deploy/open/login/status), `deploy.mjs` (push -f + deploy -i deploymentId), `.claspignore` (só Code.gs+appsscript.json), `.clasp.json` (scriptId=1Q4_2ni1...), `.deploy.json` (deploymentId=AKfycbwPHCK... = o @18/@19 versionado, mesmo do config.js). `.gitignore` cobre .clasprc.json/.clasp.json/.deploy.json.
- **Uso diário:** `cd backend && npm run deploy`. Kiro pode rodar; usuário só reentra em erro de login (`npm run login`, token clasp expira ~7 dias).
- **Verificado:** deploy `@19` OK, curl com token certo → ok:true+data, token errado → bad_token. URL /exec inalterada.
- **Cópia do SETUP.md no OneDrive:** `Kiro Folder/CasaFuerte_backend_SETUP.md`.
- **Backlog:** item DEVOPS criado para replicar o mesmo pipeline no App Gideões.

## Backend (Apps Script + Sheets)- URL: `https://script.google.com/macros/s/AKfycbwPHCKuHv9JeBIS5AUhkPYICoQNEZ6h4AsLkT2i-Z9DE7OAhQr1op5f9UuEuJA2SYiKIg/exec`
- Token `Mateo#25:40` · Client ID `363930767849-h5s9kodg8ic1rioc540bvlfnp8nmrmvp.apps.googleusercontent.com`
- Deploys do Code.gs agora são **automáticos via clasp**: `cd backend && npm run deploy` (sobe Code.gs + republica a MESMA Web App / URL `/exec`). O Kiro pode rodar isso; usuário só entra se o token do clasp expirar (`npm run login`). Deploy manual antigo (Apps Script → Nova versão) não é mais necessário.
- Segredos reais no OneDrive: `/mnt/c/Users/eonorog/OneDrive - Ericsson/Kiro Folder/Personal/Casa Fuerte/Manos Fuertes - Backend/` (Code.gs.real, config.js.real, SETUP.md). Code.gs.real gerado do repo com sed injetando token+ClientID — JÁ atualizado com tudo até v0.14.0/0.15.0.

## Feito nesta sessão (v0.10.0 → v0.15.0)
- **0.10.0** — Gestão de acessos REESCRITA com arquitetura coesa: `mfMutate` (ÚNICO caminho ao backend: post→pull→refresh→libera busy) + `accRender` (ponto único de refresh, detecta usuário deletado). Botões "+" no cabeçalho de cada seção (Administradores/Líderes/Voluntarios).
- **0.11.0** — Modais de criação CENTRALIZADOS (padrão Gideões: `.sheet` com inset:0 margin:auto), com ícone no topo (`.md-icon` oro/purp/verde: escudo admin, estrela líder, pessoa+ voluntário) + botão Cancelar.
- **0.12.0** — FIX modal de gestão de admin/líder: agora funciona por **email OU telefone** (`_resolveUser` + `USR_KEY`, antes só `USR_TEL`). Admin/líder só-email (sem telefone) agora abre/edita. Botão "Eliminar voluntario" só aparece se for voluntário real (tem telefone).
- **0.13.0** — Vista líder: chip de voluntário atribuído é clicável (`chip clickable` → `volDetalle`) → modal centralizado com detalhes + "Quitar de la tarea" + campo **motivo opcional** (duplo-toque confirma). Backend `_cancelar` aceita campos no topo do body + grava `motivo` (coluna motivo no header INSCRIPCIONES + audit). `inscritosDetalle()` retorna {id,tel,name,estado}.
- **0.14.0** — Item A: **Proteção do último admin** no `_delPermiso` (bloqueia remover o único admin, erro `last_admin`; toast "debe quedar al menos un administrador"). Testado 3 casos. (Portado do padrão do Gideão 300, sem migrar todo o modelo.)
- **0.15.0** — Vista líder: **2 formas de atribuir voluntário** — (1) chip "+ vacante" clicável, (2) botão "+" (`.lr-add`) à esquerda do `x/x` no cabeçalho do rol, SEMPRE visível (permite extra acima do cupo). Removido o antigo "+ Añadir servidor". Ambos chamam `openAddSheet(activityId, roleId)`.

## PENDÊNCIAS DO USUÁRIO (lado servidor — não bloqueiam o app, mas ativam features)
1. **Deploy do Code.gs** para ativar features de backend (`delVoluntario`, `cancelar` com motivo, proteção do último admin): agora é **`cd backend && npm run deploy`** (o Kiro roda). NÃO é mais manual (Apps Script → Nova versión). O `Code.gs` do repo é a fonte de verdade agora — o `Code.gs.real` no OneDrive ficou legado.
2. Coluna `motivo` só é criada em planilha nova; na atual, adicionar manualmente coluna `motivo` na aba Inscripciones se quiser ver o motivo na célula (senão fica no audit).
3. Refresh do app (logo Casa Fuerte) para pegar v0.15.0.

## BACKLOG / PRÓXIMOS PASSOS
- **Tab "Más"** (PEDIDA via steering, NÃO iniciada): semelhante ao Gideão — detalhes do usuário logado (nome/email/papel), versão do app, status de sincronização. No HEADER: usar apenas ÍCONES para status de sync (nuvem ✓ sincronizado / seta sincronizando / cortada offline-pendente). ESCOPO CONFIRMADO com usuário, falta implementar.
- **Item D (explicado, NÃO feito):** gestão de usuários por endpoints com **LockService** (atomicidade contra escritas simultâneas — race condition) + `replaceUsers` (restore). Recomendei versão ENXUTA: envolver setPermiso/delPermiso/upsert/del com LockService MANTENDO o modelo multi-linha (email,papel,mision) do Manos, sem migrar para 1-linha-por-usuário do Gideão. Usuário ainda não decidiu.
- **Itens B/C do Gideão (oferecidos, não pedidos):** B=`_verify` robusto (tolerar email_verified ausente); C=backup diário automático (dailyBackup + retenção). Alto valor, aguardando decisão.
- **Fase 3:** inscrições reais no backend (wizard do voluntário ainda grava em localStorage, não em Inscripciones via `inscribir`). **Fase 4:** checklists no servidor. **Comunicação em grupos** (mencionada, não iniciada).

## ARQUITETURA / ARQUIVOS
- `app/index.html` (UI + CSS inline), `app/ui.js` (lógica+telas), `app/app.js` (CONFIG + generateActivities + APP_VERSION), `app/sync.js` (window.MFSync: pull/post/queue, offline-first), `app/config.js` (versionado, URL+token+ClientID), `app/sw.js` (network-first shell), `backend/Code.gs`.
- **LIVE** = `!!(window.MFSync && window.MFSync.enabled)`. Quando true: usa SERVER_INSCR/SERVER_VOLS/PERMISOS reais, sem DEMO_*. Perfil vem do login Google + allowlist (aba Admin).
- **Padrão de mutação (Accesos):** `mfMutate(action,payload,okMsg)` → guard ACC_BUSY, post, pull, atualiza estado, accRender, libera. Erros tratados: forbidden_admin ("Sesión caducada"), last_admin ("debe quedar al menos un administrador").
- **Modal centralizado:** `#usrSheet`/`#usrBody` (`.sheet` inset:0 margin:auto). Estados: ACC_VIEW = list|user|form. Usuário identificado por USR_KEY (email ou tel) via `_resolveUser`.
- **Vista líder:** `actCardLider` → `chipsRol` (LIVE: inscritos reais clicáveis + vacantes clicáveis). `volDetalle`/`volQuitar` (quitar da tarefa com motivo).

## REGRA IMPORTANTE (SEMPRE)
Ao publicar o **FRONTEND (app)**: bumpar **3 juntos** — `APP_VERSION` (app.js) + `version.json` + `CACHE` cfms-vX (sw.js). Validar JS com Node (agora via nvm: `export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; node --check <arquivo>`). Deploy do app = commit + `git push origin main` → workflow Pages. Confirmar version.json no ar. Sem barra larga (／⁄∕).
Ao publicar o **BACKEND (Code.gs)**: `cd backend && npm run deploy` (clasp — sobe + republica a mesma Web App). NÃO é git/Pages e NÃO é o passo manual antigo do Apps Script.

## GUIA DO USUÁRIO (comportamental)
- **Analisar o TODO e o contexto antes de codar** — NÃO fazer por pedaços. Pesquisar best practices (UX) antes de implementar UI. É "obra de Deus", capricho no acabamento.
- Mostrar mock/plano antes de mudanças de UI quando pedir.
- Token Google expira ~1h → re-logar se "Sesión caducada".
