# Corrigir login: permissões da API do banco foram perdidas

## O que está acontecendo

O perfil `mesaagro@grupospasso.com.br` está correto no banco: `status = active`, `is_admin = true`, sem exclusão. O problema não é o dado — é permissão.

Nenhuma tabela do schema `public` tem mais `GRANT` para os papéis da API do Supabase (`anon`, `authenticated`, `service_role`). Consulta feita agora em `information_schema.role_table_grants` para o schema `public` retorna **zero linhas**.

Consequência no login:

```text
login OK (auth funciona)
  -> app busca user_profiles
  -> PostgREST responde "permission denied"
  -> AuthContext trata erro e deixa profile = null
  -> ProtectedRoute: sem profile == pendente
  -> redireciona para /aguardando-aprovacao
```

Ou seja: qualquer usuário, admin ou não, cai em "Cadastro em análise". As policies de RLS estão corretas e intactas — RLS sozinha não basta sem os GRANTs.

Isso também derruba todo o resto do app (mercado, tabela de preços, configurações), não só o login.

## Correção

Uma migration que restaura os GRANTs de todas as tabelas do schema `public`, respeitando as policies existentes:

- `authenticated`: SELECT, INSERT, UPDATE, DELETE nas tabelas de negócio; em `user_profiles`, SELECT e UPDATE (as policies já limitam ao próprio perfil, com exceção para admin).
- `service_role`: ALL em todas as tabelas (Edge Functions).
- `anon`: nada — não há policy que libere leitura anônima.
- Também restaurar `USAGE` no schema `public` e `USAGE, SELECT` nas sequences para os mesmos papéis, e ajustar os `ALTER DEFAULT PRIVILEGES` para que tabelas novas já nasçam com acesso.

Nenhuma alteração de RLS, de policy, de schema ou de dado. Nenhuma alteração no código do frontend.

## Verificação

1. Reconsultar `information_schema.role_table_grants` e confirmar que cada tabela de `public` aparece para `authenticated` e `service_role`.
2. Abrir o app, entrar com o usuário admin e confirmar que cai no cockpit e não em `/aguardando-aprovacao`.
3. Conferir que a aba Mercado e a Tabela de Preços voltam a carregar.

## Observação

Vale entender depois como os GRANTs sumiram (um `REVOKE`/recriação de schema recente). Se quiser, também dá para anexar o bloco de GRANTs ao snapshot em `supabase/schema/20260730_snapshot.sql` para não se perder de novo — fora do escopo urgente.
