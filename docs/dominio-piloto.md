# Modelo de domínio — Piloto Banco de Alimentos

Documento de referência do fluxo operacional que o app gerencia no piloto.
Validado com o coordenador em 2026-09-28.

## Visão geral

Duas **cadeias independentes** de recolhimento de alimentos, cada uma com sua
retirada, preparação(ões), distribuição e limpeza. Recorrência **mensal**.

- **Cadeia A — MercaMadrid** (perecíveis: frutas, legumes, vegetais) — 1º fim de semana.
- **Cadeia B — Banco de Alimentos** (outros alimentos) — 1ª quarta do mês.

O papel **motorista** é qualificado: exige ter **furgoneta**.

## Cadeia A — MercaMadrid (1º sábado + 1º domingo)

| ID | Atividade | Dia / hora | Vagas | Papéis / notas |
|----|-----------|------------|-------|----------------|
| A1 | Retirada MercaMadrid | 1º sábado, 8h | 4 | 2 motoristas c/ furgoneta + 2 ajudantes de carga |
| A2 | Preparação (sábado) | sábado, tarde | 6 | triagem parcial de frutas/vegetais; separar o que é distribuível (pequenas quantidades NÃO vão ao público geral); montar **caixas dos pastores** (em caixa, não saco plástico de um dia p/ outro) |
| A3 | Preparação (domingo) | domingo, 8h | 10 | preparação final p/ público geral + separar **bolsas dos diáconos** (uma por diácono, do que foi preparado) |
| A4 | Distribuição (domingo) | domingo, 12h → ~14h → ~16h | 6 | horário partido: começa às 12h (fim do 1º culto), pausa, retoma ~14h (fim do 2º culto) até ~16h |
| A5 | Limpeza (domingo) | domingo, ~16h | 4 | após a distribuição; geralmente as mesmas pessoas de A4 |

## Cadeia B — Banco de Alimentos (1ª quarta)

| ID | Atividade | Dia / hora | Vagas | Papéis / notas |
|----|-----------|------------|-------|----------------|
| B1 | Retirada Banco de Alimentos | 1ª quarta, 10h | 4 | 2 motoristas c/ furgoneta + 2 ajudantes de carga |
| B2 | Preparação | quarta, a partir das 16h | 10 | triagem, separação, empacotamento |
| B3 | Distribuição | quarta, 18h → 19h30 | 6 | — |
| B4 | Limpeza | quarta, após 19h30 | (herda B3) | mesma equipe da distribuição |

## Papéis (roles)

| Papel | Requisito | Onde aparece |
|-------|-----------|--------------|
| Motorista (furgoneta) | ter furgoneta | A1, B1 |
| Ajudante de carga | — | A1, B1 |
| Preparação | — | A2, A3, B2 |
| Distribuição | — | A4, B3 |
| Limpeza | — | A5, B4 |

## Tarefas embutidas (NÃO são atividades de escala)

- **Caixas dos pastores** — montadas dentro de A2 (sábado).
- **Bolsas dos diáconos** — separadas dentro de A3 (domingo), uma por diácono.

Essas são etapas internas da preparação; não geram vaga/escala própria.

## Regras de negócio

- Uma pessoa **pode acumular papéis no mesmo dia** (ex.: distribuição + limpeza).
- Cada atividade tem **capacidade por papel**; ao lotar, novas inscrições vão para **lista de espera**.
- Recorrência gerada por **template**:
  - `semanal` — por dia da semana (não usado no piloto, mas suportado para outras frentes).
  - `mensal_posicao` — ex.: "1º sábado", "1ª quarta" do mês (usado no piloto).
  - `avulso` — datas pontuais.
- Distribuição de domingo (A4) = **uma** atividade com janela 12h–16h + nota da pausa entre cultos (não fragmentar em duas).

## Fluxo do voluntário (app)

1. Abre a **Agenda** do mês → vê atividades por cadeia/frente.
2. Cada card: atividade, dia/hora, local, "X de Y vagas" (por papel), quem já está no time.
3. **Participar** (escolhe o papel) → confirmação imediata. Pode **cancelar**.
4. Recebe **lembrete WhatsApp** 24–48h antes (padrão wa.me do gideao300).

## Fluxo do líder (app)

1. **Monta a escala** a partir dos templates (gera as atividades do mês).
2. Ajusta vagas/papéis conforme a necessidade do mês.
3. No dia, **marca presença** (presente / faltou / atrasado) em poucos toques.

## Fora de escopo (por ora)

- Cadastro de **beneficiários/atendidos** (dados sensíveis — LGPD; módulo separado no futuro).
- Outras frentes da missão (Plaza Mayor, Villaverde, Cañada Real, Jurídico, Emocional, Networking)
  — o modelo de dados já as acomoda, mas o piloto foca no Banco de Alimentos.
