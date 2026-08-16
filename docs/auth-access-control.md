# Sistema de Autenticação e Controle de Acesso

## Arquitetura

- **auth.users** → autenticação (Supabase Auth)
- **public.users** → fonte única de dados e autorização do usuário (status, admin, papéis, unidade)
- `user_profiles` foi depreciada e não é mais referenciada pelo frontend

## Fluxo

1. Usuário se cadastra pela tela de login informando nome, cargo, telefone (opcional) e unidade
2. `supabase.auth.signUp` envia em `options.data` as chaves `full_name`, `job_title`, `phone`, `warehouse_id`
   (contrato com o gatilho — não renomear; `warehouse_id` vazio significa Sede)
3. Gatilho `handle_new_user` cria a linha em `public.users` com `status='pending'`
4. Admin aprova no painel → `status='active'`, `approved_at=now()`, `approved_by=admin_uid`
5. `ProtectedRoute` verifica `users.status` a cada carregamento

## Status

| Status | Comportamento |
|---|---|
| pending | Redireciona para `/aguardando-aprovacao` |
| active | Acesso liberado |
| disabled | Redireciona para `/acesso-desativado` |

Falha técnica na consulta do perfil mostra tela de erro com "Tentar novamente" — nunca "cadastro em análise".

A coluna `active` de `users` é legada; `status` é o único portão.

## Regras de escrita em public.users

- Um usuário não-admin só pode atualizar a coluna `theme` da própria linha. Qualquer outra coluna
  no mesmo UPDATE faz a operação inteira falhar (gatilho `protect_user_rows`).
- Por isso o nome é somente leitura em "Meu perfil"; alterações ficam com o admin.
- O frontend nunca faz INSERT em `users` — a linha nasce do gatilho.

## Admin

- `users.is_admin` (ou a função `is_admin(uuid)`) define acesso administrativo.
- `useAuthorization().isAdmin()` exige `is_admin` **e** `status='active'`.

## Promover novo admin

```sql
UPDATE public.users
SET status='active', is_admin=true,
    approved_at=now(), approved_by='<admin-uuid>'
WHERE email='<email>';
```

## Notas

- `access_level` e `forced_env` não existem mais.
- Controle de acesso por papel/unidade será implementado depois, sem refatoração estrutural.
