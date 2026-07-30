## Objetivo

Criar um único arquivo de snapshot com o schema completo do banco como está hoje, mais as linhas de configuração. Nenhuma migration é executada.

## Caminho do arquivo

`supabase/schema/20260730_snapshot.sql` — **fora** de `supabase/migrations/`, de propósito: dentro da pasta de migrations a plataforma rodaria as 16 antigas primeiro e os `CREATE TABLE IF NOT EXISTS` do snapshot não fariam nada, deixando de fora tudo que foi adicionado depois de maio.

### Cabeçalho do arquivo

```text
-- SNAPSHOT DECLARATIVO DO SCHEMA — 30/07/2026
-- Isto NÃO é uma migration. Não é aplicado automaticamente por deploy,
-- db push ou db reset. É um documento de referência do estado do banco
-- de produção nesta data, para ser aplicado MANUALMENTE ao recriar o projeto.
-- As migrations em supabase/migrations/ estão INCOMPLETAS a partir de
-- 28/05/2026: alterações feitas por SQL direto nunca foram versionadas.
```

## Como o schema será extraído

`pg_dump` não está disponível nesta plataforma e esta sessão não tem `psql` (variáveis `PG*` ausentes). A extração usa **consultas de leitura ao catálogo do Postgres**, que devolvem o DDL gerado pelo próprio banco — não é redação à mão:

- Tabelas e colunas: `information_schema.columns` + defaults literais
- Constraints (PK, FK, unique, check): `pg_get_constraintdef()`
- Índices: `pg_indexes.indexdef`
- Enums: `pg_type` / `pg_enum` (ex.: `app_role`)
- Funções: `pg_get_functiondef()` (todas, incluindo as `security definer`)
- Triggers: `pg_get_triggerdef()` (inclui `spot_settings_updated_at` e `fx_parameters_updated_at`)
- Policies de RLS: `pg_policies` + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Grants: `information_schema.role_table_grants` para `anon`, `authenticated`, `service_role`

Os `INSERT` de configuração saem de `SELECT` nas próprias tabelas, convertidos em SQL literal.

## Ordem dos objetos no arquivo

```text
0. Cabeçalho explicativo
1. CREATE TYPE (enums)
2. CREATE TABLE (todas as tabelas do schema public)
3. GRANT por tabela (conforme o estado atual)
4. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
5. CREATE POLICY
6. Índices e constraints adicionais
7. CREATE OR REPLACE FUNCTION
8. CREATE TRIGGER
9. INSERT de configuração
```

## Dados de configuração incluídos

- `pricing_parameters` — 3 linhas (`soybean_cbot`, `corn_cbot`, `corn_b3`), com `ticker_count` e `rounding_increment`
- `spot_settings` — 1 linha (`default`)
- `fx_parameters` — 1 linha (`default`)
- `warehouses` — as 13 praças, com `basis_config`, custos e `abbr`

Excluídos: `pricing_combinations`, `pricing_snapshots`, `operations`, `orders`, `market_data`, `market_data_history`, `historical_basis`, `activity_log`, `users`, `user_profiles`, `producers` e demais tabelas transacionais.

## Escopo negativo

- Nenhuma migration aplicada, sem `db push` nem `db reset`; as consultas ao banco são exclusivamente `SELECT` no catálogo.
- Migrations antigas intactas.
- `types.ts` não é regenerado.
- Nenhum arquivo de código da aplicação alterado.

## Entrega

Caminho do arquivo, contagem de tabelas, lista de triggers, contagem de policies por tabela e as linhas de configuração incluídas — com confirmação explícita de que nada foi aplicado ao banco.
