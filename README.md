# Casa Fuerte — Misión Social

Ferramenta de **gestão de voluntários** das missões sociais da Casa Fuerte Church (Leganés, Madrid).
Ajuda os servidores/voluntários a encontrar a **agenda**, ver o **time montado** de cada atividade e **se inscrever/confirmar** presença. Os líderes montam as escalas e registram presença.

> Projeto de gestão interna — complementa (não substitui) o site institucional `casafuertechurch.com`.

## Escopo

- **Gestão de voluntários / escalas** — quem serve em cada frente.
- **NÃO** cadastra beneficiários/atendidos (dados sensíveis ficam fora deste app por ora).

## Piloto: Banco de Alimentos

Fluxo mensal de recolhimento → preparação → distribuição → limpeza, em duas cadeias:

- **Cadeia A — MercaMadrid** (perecíveis, 1º fim de semana): retirada (sáb 8h), preparação sábado (tarde) e domingo (8h), distribuição domingo (12h–16h), limpeza (~16h).
- **Cadeia B — Banco de Alimentos** (1ª quarta): retirada (10h), preparação (16h), distribuição (18h–19h30), limpeza (após).

Detalhes completos do domínio em [`docs/dominio-piloto.md`](docs/dominio-piloto.md).

## Stack

- **PWA** (HTML/CSS/JS puro, sem framework), offline-first.
- **Backend:** Google Sheets via Google Apps Script.
- **Login:** Google Identity Services + allowlist.
- **Lembretes:** WhatsApp click-to-chat (`wa.me`).
- **Idiomas:** PT + ES.

## Configuração

1. Copie `config.example.js` para `app/config.js`.
2. Preencha os valores reais (URL do Web App, Client ID, token, allowlist).
3. `app/config.js` está no `.gitignore` — **nunca** é versionado.

## Segurança / privacidade

- Repositório **privado**.
- Segredos e dados pessoais reais **nunca** vão para o repo (`.gitignore` cobre `*.real`, `config.js`, `*-real.json`).
- Num frontend público, o `SYNC_TOKEN` não é segredo forte — a segurança real é o login Google + allowlist no servidor.

## Licença

Uso interno da Casa Fuerte Church. Ver [`LICENSE`](LICENSE).
