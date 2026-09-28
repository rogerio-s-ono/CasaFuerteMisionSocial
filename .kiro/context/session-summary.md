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

## Próximos passos (backlog)
1. Implementar backend Apps Script (Sheets: Voluntarios, Frentes/Templates, Atividades, Inscricoes) + doGet/doPost.
2. Login Google + allowlist (reaproveitar do gideao300).
3. Fluxo participar/cancelar (inscrição) + lista de espera.
4. Tela do líder: montar escala do mês (gerar atividades) + marcar presença.
5. Lembretes WhatsApp wa.me.
6. i18n PT/ES completa. Ícones/manifest reais. Definir hospedagem (repo privado → Cloudflare/Netlify/Vercel grátis, ou GitHub Pages c/ Pro).
