# Migração para `users` + autocadastro

Três frentes: cadastro próprio na tela de login, portões de acesso por `users.status` e remoção total de `user_profiles` do frontend.

## 1. Autocadastro na tela de login

A aba "Cadastrar" (já existe em `src/pages/Login.tsx`) ganha os campos definitivos:

- Nome completo — obrigatório
- Cargo — obrigatório, texto livre
- Telefone — opcional (máscara já existente em `src/lib/masks.ts`)
- Unidade — obrigatório, select com "Sede" + armazéns ativos do tipo ARMAZEM (`useActiveArmazens`, exibindo `display_name`)
- Email, senha e confirmação — como hoje

O envio chama `supabase.auth.signUp` com `options.data` contendo exatamente `full_name`, `job_title`, `phone`, `warehouse_id` (string vazia quando "Sede"). O frontend não escreve em `users` — a linha é criada pelo gatilho do banco. Depois do sucesso, redireciona para a tela de aguardando aprovação.

## 2. Portões de status

`AuthContext` passa a carregar a linha de `public.users` do usuário logado (id, email, full_name, job_title, phone, warehouse_id, roles, status, is_admin, is_owner, theme, approved_at, created_at), filtrando `deleted_at is null`.

O `ProtectedRoute` continua com a mesma estrutura de três casos (falha técnica / pendente / desativado), agora lendo `status` da linha de `users`:

- `pending` ou linha ausente → `/aguardando-aprovacao`
- `disabled` → `/acesso-desativado`
- `active` → app normal
- falha de consulta → tela de erro técnico com "Tentar novamente" (comportamento atual preservado)

## 3. Fim do `user_profiles`

| Arquivo | Mudança |
|---|---|
| `src/types/index.ts` | `UserProfile` vira o formato da linha de `users`; saem `access_level` e `forced_env`, entram `job_title`, `phone`, `warehouse_id`, `roles`, `is_owner`, `deleted_at` |
| `src/contexts/AuthContext.tsx` | leitura do perfil vai para `users`; tema continua aplicado ao `documentElement` |
| `src/hooks/useAuthorization.ts` | `isAdmin` por `users.is_admin` + `status === 'active'`; remove `hasAccessLevel` |
| `src/pages/Profile.tsx` | nome e tema gravam só em `users`; o `UPDATE` de tema envia **somente** a coluna `theme` |
| `src/pages/AdminUsers.tsx` | migração mecânica: lista, aprova, desativa, reativa, alterna admin e exclui (soft delete) direto em `users`; a coluna "Acesso" (access_level) sai da tabela; papéis continuam como estão |
| `src/components/ProtectedRoute.test.tsx` | fixture atualizada para o novo formato |
| `docs/auth-access-control.md` | documentação atualizada para refletir `users` |

A coluna `active` de `users` não é lida nem escrita em lugar nenhum; `status` é o único portão.

## Fora de escopo

- Nada de Edge Functions (`api-proxy` intocada), banco, RLS ou gatilhos.
- Sem controle de acesso por papel ou unidade.
- Sem redesenho da tela de administração.
- Sem tocar em operações, ordens ou precificação.

## Detalhes técnicos

- Rotas existentes em português são mantidas: `/aguardando-aprovacao` e `/acesso-desativado`.
- `supabasePublic` continua sendo o mesmo client; as leituras de perfil seguem por ele.
- Restos de `forced_env` (tipo e teste) são removidos apenas onde impedem a compilação.
- Verificação final: `rg "user_profiles" src/` sem resultados e typecheck limpo.
