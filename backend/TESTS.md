# Testes de regressão — gestión de usuarios

## Como rodar
```
python3 backend/test_usuarios.py
```
Sai com código 0 se tudo passar, 1 se algo falhar.

## O que cobre (26 asserções, 12 casos)
Simula fielmente a lógica do backend `Code.gs` (aba `Usuarios`) para os fluxos críticos:

1. Login por teléfono reconhece usuário criado pelo Admin (não pede nome de novo).
2. Criar voluntário só com nome+telefone (sem email) NÃO falha.
3. Email obrigatório se Admin ou Líder.
4. Editar NÃO cria duplicado (mesma chave).
5. Mudar o telefone persiste e NÃO apaga outro usuário.
6. Mudar para um telefone que já é de outro → `telefono_en_uso`.
7. Pôr o email do Admin em OUTRO usuário → `email_en_uso` (não duplica identidade).
8. Não deixar 0 admins (`last_admin`).
9. Login (auto-registro) não pisa roles existentes.
10. Admin acumula roles (admin + líder + voluntário) em 1 fila.
11. **Login por teléfono de outra pessoa com idToken do Admin na sessão NÃO carimba o email do Admin** (o bug do "vira admin sozinho").
12. Login Google do próprio dono fixa o seu email (se não colidir).

## Regra de ouro (best practice — identidade)
- `telefono` = chave primária (dígitos).
- `email` = OPCIONAL mas ÚNICO (não repete entre usuários) — é identidade de login.
- O email verificado do idToken só entra no registro se o cliente enviar explicitamente E coincidir (login Google do próprio dono). Nunca carimba email de terceiro.
- Admin/Líder exigem email. `esAdmin` = flag; `lider` = JSON de misiones.

## OBRIGATÓRIO
Rodar esta suíte antes de todo deploy que toque em criação/edição/login de usuário.
