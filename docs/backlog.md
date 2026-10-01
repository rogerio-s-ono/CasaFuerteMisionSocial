# Backlog — Casa Fuerte Misión Social

Itens de melhoria/evolução. Atualizado sempre que algo é entregue (mover para "Entregue").

> **Regra de deploy (lembrete):** FRONTEND = bump `APP_VERSION`+`version.json`+`CACHE` (sw.js) → `git push origin main` (Pages). BACKEND = `cd backend && npm run deploy` (clasp, mesma URL /exec).

---

## 🔴 Pendentes

### 1. Gestão de usuários — restore (`replaceUsers`)
**Prioridade:** Baixa · **Área:** Backend (Usuarios) · **Status:** opcional, não feito.
A **atomicidade via LockService já está feita** (ver Entregue). Falta apenas a ação `replaceUsers` (restaurar a aba Usuarios inteira a partir de um backup) — útil só como rede de segurança. Decidir se vale.

### 2. `_verify` mais tolerante (login Google) — DECISÃO
**Prioridade:** Baixa-Média · **Área:** Backend (segurança) · **Status:** NÃO feito como "tolerante" — hoje é mais ESTRITO.
Validado no código (`Code.gs` `_verify`): hoje **rejeita** se `email_verified` não for exatamente `'true'`/`true` (linha ~486) → se o Google omitir o campo, o login é recusado. O item original pedia **tolerar a ausência** de `email_verified`.
- **Decisão sua:** manter estrito (mais seguro) OU afrouxar para tolerar ausência (menos falsos negativos de login). Enquanto não decidir, fica como está (estrito).

### 3. Comunicação em grupos
**Prioridade:** Baixa · **Área:** Feature · **Status:** mencionada, não iniciada.
Comunicação/avisos em grupo (ex.: WhatsApp click-to-chat por função/missão, ou lista de contatos da escala). Escopo a definir.

### 4. Backup diário automático
**Prioridade:** Média · **Área:** Backend · **Status:** oferecido, aguardando decisão.
`dailyBackup` (trigger diário) com retenção — copiar as abas (Config, Usuarios, Inscripciones, Checklists) para um backup, à prova de perda de dados.

---

## 🧪 Exploratório — PENDENTE DE VALIDAÇÃO (ideias de mercado + UX, aguardam seu aval)

> Levantado em 2026-10-01 a partir de **apps de referência** (Planning Center Services — padrão-ouro em igrejas, SignUpGenius, Zelos, POINT, Servant Keeper, VolunteerLocal) e **best practices de UX** para gestão de voluntários/escalas. Cada item diz o que o mercado faz, o valor, e o que o app **já tem** (para não duplicar). **Nada aqui está aprovado — validar antes de implementar.**

### E1. Lembretes automáticos de turno (reduzir no-shows)
**Prioridade sugerida:** Alta · **Área:** Backend + comunicação.
Padrão nº1 citado em TODAS as referências (Planning Center envia lembrete até 7 dias antes; "reminders to cut no-shows"). Hoje o app tem WhatsApp click-to-chat **manual**. Ideia: lembrete automático (ex.: Apps Script time-trigger que gera as mensagens/avisos do dia seguinte, ou push PWA) para quem está confirmado numa atividade próxima.
- **Já tem:** `wa.me` manual, dados de inscrição no backend.
- **Validar:** canal (WhatsApp vs push vs e-mail), antecedência (24h?), quem dispara.

### E2. Confirmar presença (aceitar/recusar o turno)
**Prioridade sugerida:** Alta · **Área:** Frontend + backend.
Planning Center/Queensway: "enabling volunteers to confirm their slot, avoiding no-shows" — botões **Aceptar/Rechazar** por escala. Hoje o voluntário se inscreve (confirmado direto) mas não há um passo de **confirmação de presença** próximo à data (nem o líder vê quem confirmou).
- **Já tem:** estados confirmado/suspendido/espera; o líder adiciona/remove.
- **Validar:** adicionar estado "pendiente de confirmación" ou um flag `confirmadoPresencia` + UI de aceitar/recusar.

### E3. Datas de indisponibilidade (blockout) + aviso de conflito
**Prioridade sugerida:** Média · **Área:** Frontend + backend.
Planning Center "Blockouts": o voluntário marca dias em que **não pode servir**; ao escalá-lo nessa data, aparece **aviso de conflito** (líder pode ignorar). Reduz escalas furadas.
- **Já tem:** nada equivalente.
- **Validar:** nova aba/UI de indisponibilidade do voluntário + checagem no fluxo do líder (`openAddSheet`/wizard) com aviso não-bloqueante.

### E4. "Mi horario" consolidado + exportar/sincronizar calendário (.ics)
**Prioridade sugerida:** Média · **Área:** Frontend.
Planning Center: "My Schedule" + sync com Google/Outlook/Apple. Hoje há "Mis turnos", mas sem export. Ideia: botão **"Añadir al calendario"** gerando um `.ics` (data/hora/local/notas) por turno — simples, offline, sem backend novo.
- **Já tem:** aba "Mis turnos" (`renderMios`), dados de data/hora/duração.
- **Validar:** só o `.ics` (fácil) ou sync completo (mais complexo).

### E5. Troca de turno entre voluntários (swap) com aprovação do líder
**Prioridade sugerida:** Média-Baixa · **Área:** Frontend + backend.
Servant Keeper: "approval-controlled swaps and conflict checks". Voluntário pede para trocar/ceder seu turno; outro assume; líder aprova. Hoje só o líder remove/adiciona manualmente.
- **Já tem:** lista de espera FIFO (parcialmente cobre "quem assume"), suspender/reactivar.
- **Validar:** se o fluxo de espera já basta ou se vale um "ceder mi plaza" explícito.

### E6. Notas da atividade visíveis ao voluntário (preparação)
**Prioridade sugerida:** Média · **Área:** Frontend.
Planning Center: "notes to store info volunteers need to be prepared". O config já tem `notas` por atividade; validar se o **voluntário** as vê no detalhe/wizard (não só o líder). Barato e alto valor.
- **Já tem:** campo `notas` no config das atividades.
- **Validar:** expor as notas na tela do voluntário (hero/wizard/mis turnos).

### E7. Notificações push (PWA)
**Prioridade sugerida:** Média-Baixa · **Área:** PWA + backend.
Complemento ao WhatsApp: push nativo do PWA (service worker já existe) para lembretes/mudanças de escala. Mais "app-like".
- **Já tem:** `sw.js` (shell), sem push.
- **Validar:** exige Web Push (VAPID) + um emissor; avaliar custo/benefício vs. WhatsApp (que já é o canal natural do grupo).

### E8. Relatório de participação / horas servidas
**Prioridade sugerida:** Baixa · **Área:** Backend + UI (admin).
Mercado: "track hours for grant reporting"; aqui o valor é **reconhecimento e visão do líder** (quem serviu, quantas vezes, assiduidade). Dados já existem em `Inscripciones` (fecha, estado, voluntario).
- **Já tem:** histórico de inscrições no backend.
- **Validar:** um painel simples (por voluntário/mês/missão) — read-only, sem novo modelo.

### E9. Acessibilidade e refinamento UX do checklist/listas
**Prioridade sugerida:** Baixa · **Área:** Frontend (a11y).
Best practice: alvos de toque ≥44px, contraste AA, foco visível, `aria-label` em ícones-only (ex.: toggle N/A, 💬, chips de sync). Garante usabilidade para todas as idades do grupo.
- **Já tem:** UI mobile-first; falta auditoria a11y formal.
- **Validar:** auditoria rápida (Lighthouse) + ajustes pontuais.

---

## ✅ Entregue

### Tab "Más" + ícones de sync no header (validado no código 2026-10-01)
- `renderMas` (`ui.js`): card de perfil (nome/email/papel via allowlist real), seção **Sincronización** (estado colorido, pendentes de envio, log de erros com copiar/limpar, botão reintentar) e **Aplicación** (versão `v`+APP_VERSION) + logout.
- `renderSyncBadge` (`ui.js`): ícone de **nuvem** no header colorido por estado — ✓ sincronizado / 3 pontos pendente / seta sincronizando / nuvem cortada offline / "!" erro. Via `MFSync.onStatus`.

### Gestão de usuários atômica — LockService (validado no código)
- `doPost` (`Code.gs`) usa `LockService.getScriptLock()` + `waitLock(20000)` envolvendo TODAS as escritas (inclui `saveUsuario`/`delVoluntario`/`inscribir`/checklist) → serializa e evita race condition. (Restore `replaceUsers` fica como pendente opcional.)

### Coluna `motivo` + migração automática de colunas (validado no código)
- `motivo` está no header de `Inscripciones` e é gravado no `_cancelar` (`_setCell(... 'motivo' ...)`). A migração `_ensureColumns` (chamada por `_ensureSheets` em cada request) adiciona colunas novas às abas existentes de forma não-destrutiva — resolve planilhas antigas sem ação manual.


### Checklist persistente no backend + N/A + comentário (v0.34.1 / v0.35.0 · 2026-10-01)
- **Fase 4 — sincronização:** o checklist (instância por ocorrência) agora persiste no backend (aba `Checklists`), offline-first via `MFSync.queue('setChecklistItem')`, merge por `actualizadoEm`. `applyPull` consome `res.data.checklists`. Backend `_setChecklistItem` (upsert) + `_delChecklistItem` (remove item suelto). Plantilla continua em CONFIG (`saveConfig`).
- **Toggle N/A:** 3º estado por item (topo direito), mutuamente exclusivo com "feito", esmaece/risca e **sai do progresso** (`feitos / (total − N/A)`).
- **Comentário por item:** opcional na criação (suelto e plantilla), indicador 💬 discreto, abre por clique no corpo em **leitura** + botão **Editar**.
- Testes: `test_checklist.py` 27/27. Backend clasp @24.

### Inscrições reais do voluntário no backend (Fase 3)
- O wizard do voluntário (`confirmInscr`) agora posta ao backend (`inscribir`), offline-first (enfileira se sem rede). Antes gravava só em `localStorage`.

### Validação de navegação + limpeza fantasma/DEMO (v0.32.0 · 2026-09-30)
- `go()` fecha overlays (wizard/checklist) e reseta sub-estados ao trocar de aba (cada aba abre na tela inicial). MODO DEMO removido (papéis só via allowlist real). Seed sem e-mails reais. Código morto removido.

### Telefone do servidor temporal (v0.32.0)
- Campo de telefone do temporal passou a persistir (coluna `tel` em `Inscripciones`, migração `_ensureColumns`); exibido no detalhe com link `wa.me`.

### Pipeline de deploy automático do backend (clasp · 2026-09-30)
- `npm run deploy` sobe o `Code.gs` e republica a Web App (mesma URL `/exec`). Segredos movidos para Script Properties. Fim do copy/paste manual no Apps Script.

### Outros (sessões anteriores)
- Gestão de acessos coesa (`mfMutate`), modais centralizados, admin/líder por email ou telefone, proteção do último admin, vista líder com chips clicáveis e motivo de cancelação, estado "suspendido", lista de espera editável + promoção FIFO, feedback de sync bloqueante.
