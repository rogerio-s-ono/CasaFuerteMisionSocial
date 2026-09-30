# Backlog — Casa Fuerte Missão Social

Itens identificados para correção/melhoria, fora do escopo imediato da sprint.

---

## BUG / UX — Navegação e refresh da gestão de usuários é síncrona e online-only

**Data:** 2026-09-30
**Prioridade:** Alta
**Área:** Gestão de usuários (tela Admin — lista de servidores)

### Problema
O fluxo de adição, remoção e edição de usuários não bloqueia a navegação enquanto a operação não termina no backend. O usuário consegue sair da tela antes do salvamento ser concluído, e ao voltar para a lista de usuários ela está desatualizada (não reflete a última operação). O problema foi reportado mais de uma vez e ainda não foi corrigido.

### Comportamento esperado
1. **Online-only obrigatório:** bloquear qualquer operação de add/remove/edit de usuários se o app estiver offline. Exibir aviso claro: "Sem conexão — operação não disponível offline."
2. **Bloqueio de navegação durante a operação:** enquanto a chamada ao backend (Google Apps Script) estiver em andamento, o botão de confirmação fica desabilitado e a UI mostra spinner. O botão "voltar" / navegação para outra tela fica bloqueado até a resposta (sucesso ou erro) ser recebida.
3. **Refresh automático da lista após conclusão:** ao receber a resposta de sucesso do backend, fechar o modal/formulário E atualizar a lista de usuários buscando os dados frescos do servidor antes de liberar a navegação.
4. **Tratamento de erro:** se o backend retornar erro, manter o formulário aberto e exibir a mensagem de erro — não fechar nem navegar.

### Best practices a seguir
- Usar `navigator.onLine` + listener `online/offline` para gate antes de iniciar a operação.
- Desabilitar o botão de submit e qualquer link/botão de navegação (`<a>`, `history.back()`, tab bar) durante o `await` da chamada ao backend.
- Usar `finally` para garantir que o estado de "em progresso" seja sempre limpo, mesmo em erro.
- Após sucesso: `await loadUsers()` (ou equivalente) antes de `closeModal()` / `navigate()`.
- Considerar `beforeunload` / `popstate` como fallback para capturar saída acidental do usuário durante operação em progresso.

### Arquivos provavelmente afetados
- `app/ui.js` — handlers de add/edit/remove de usuários, função de fechar modal, navegação de tabs.
- `app/app.js` — função de carregamento/refresh da lista de usuários.

---

## FEATURE — Sincronizar o checklist do líder com o backend

**Data:** 2026-09-30
**Prioridade:** Média
**Área:** Checklist (vista Líder)

### Problema
O checklist funciona, mas persiste **apenas localmente** (`localStorage`, via `CHK`/`saveChk`/`chkPersistItem`). Não sincroniza entre dispositivos nem entre líderes — se um líder marca um item, outro não vê.

### Situação atual
- **Backend pronto:** já existe a ação `setChecklistItem` no `Code.gs` e a aba `Checklists`. O `_pull` já retorna `checklists`.
- **Frontend não conectado:** `chkPersistItem` só grava no `localStorage`; não chama `MFSync.queue('setChecklistItem', ...)` nem lê do pull.

### O que fazer
1. Em `chkPersistItem` (e no add/toggle/delete de itens), além de gravar local, enfileirar `MFSync.queue('setChecklistItem', { item:{ activityId, itemId, texto, hecho, hechoPor, asignado, suelto } })`.
2. No `applyPull`, popular/mesclar o `CHK` a partir de `res.data.checklists` (merge com o estado local, preferindo o mais recente por `actualizadoEm`).
3. Tratar a plantilla (template em CONFIG) vs. instância (estado por ocorrência) — a plantilla já sincroniza via `saveConfig`; falta só a instância.
4. Offline-first: manter a fila (o checklist pode ser preenchido offline e sincronizar depois) — diferente da gestão de usuários (online-only).

### Arquivos afetados
- `app/ui.js` — `chkPersistItem`, `chkToggle`, `chkAddSuelto`, `chkDelSuelto`, `chkAssign`, `applyPull`.
- Backend já pronto (`setChecklistItem`).

---
