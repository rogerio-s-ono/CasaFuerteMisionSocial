# Regra de UI — Modais (.sheet) — NÃO QUEBRAR

## Status: ACTIVE. Regra crítica de layout do app Manos Fuertes.

## Regra
Os modais do app usam a classe `.sheet` (ex.: `#usrSheet`, `#addSheet`, `#asgSheet`), definida em `app/index.html`:

```
.sheet{ position:fixed; inset:0; margin:auto; width:calc(100% - 32px); max-width:400px;
        height:max-content; max-height:88vh; ... overflow-y:auto; }
```

Isso centraliza o modal na tela e o faz rolar internamente quando o conteúdo é grande.

### PROIBIDO
- **NUNCA** sobrescrever `position` de um `.sheet` (ex.: `#usrSheet{ position:relative }`).
  `position:relative` (ou qualquer coisa != `fixed`) **tira o modal do centro e o joga para fora da tela**.
  Esse bug já ocorreu 2x (modal de edição de usuário fora da tela) — sempre pela mesma causa.

### Se precisar de âncora para um overlay interno (ex.: "Guardando…")
- O `.sheet` **já é `position:fixed`**, o que **já serve de contexto de posicionamento** para filhos `position:absolute`.
  Basta o overlay ser `position:absolute; inset:0` — **não** adicionar `position:relative` no sheet.

### Checklist ao mexer em modais
1. O `.sheet` continua `position:fixed`? (não sobrescrever)
2. Overlays internos usam `position:absolute; inset:0` (o fixed do pai é a âncora).
3. Testar que o modal abre **centralizado** e rola internamente se alto.
