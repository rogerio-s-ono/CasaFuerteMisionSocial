# Backlog — Casa Fuerte Missão Social

Itens identificados para correção/melhoria, fora do escopo imediato da sprint.

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
