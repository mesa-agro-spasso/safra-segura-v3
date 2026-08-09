# Atualizar o snapshot declarativo do schema

Objetivo: `supabase/schema/20260730_snapshot.sql` volta a descrever exatamente o banco real.
Nada é aplicado no banco — o arquivo é documentação.

## O que muda no arquivo

Tabelas novas (seção 2, em ordem alfabética):
- `insurance_options`
- `insurance_option_quotes`

Colunas novas:
- `pricing_combinations`: `insurance_option_id`, `insurance_coverage_pct`, `insurance_carry_until`, `grain_already_delivered`
- `pricing_snapshots`: `insurance_quote_id`, `insurance_coverage_pct`, `insurance_cost_brl`, `insurance_carry_until`

Remoções (o snapshot ainda descreve coisas que não existem mais):
- tabela `insurance_snapshots` — sai da seção de tabelas, do RLS e das policies
- coluna `pricing_snapshots.insurance_json`
- coluna `pricing_parameters.sigma`

Nas seções 4 e 5, RLS e policies das duas tabelas de seguro entram; as de `insurance_snapshots` saem.
O cabeçalho ganha uma nota de revisão com a data de hoje e o resumo do que mudou.

## Constraints que serão reproduzidas literalmente

Já lidas do catálogo do Postgres, e vão para o arquivo como estão:

- `insurance_options`: PK; UNIQUE `(id, benchmark)` — é ela que sustenta a FK composta das cotações;
  checks de vocabulário fechado (`commodity` soja/milho, `benchmark` cbot/b3, `option_type` call/put),
  check de par válido (`soybean+cbot`, `corn+cbot`, `corn+b3`), check de unidade exclusiva por benchmark
  (cbot exige strike em USD/bushel e proíbe BRL/saca; b3 o inverso) e check de strike positivo.
- `insurance_option_quotes`: PK; FK composta `(option_id, benchmark)` → `insurance_options(id, benchmark)`,
  que impede cotação com benchmark diferente do da opção; a mesma regra de unidade exclusiva aplicada ao
  prêmio; check de prêmio positivo; FK de `created_by` para `auth.users`.
- `pricing_combinations`: check do trio de seguro — as três colunas juntas ou as três nulas;
  check de cobertura entre 0 e 1; check de `insurance_carry_until` no vocabulário
  `grain_reception` / `operation_end`; FK de `insurance_option_id`.
- `pricing_snapshots`: os checks e a FK equivalentes do lado do snapshot, lidos do banco antes de escrever.

Índices e defaults das tabelas e colunas novas também saem do catálogo, não de suposição.

## Duas divergências extras encontradas

Ao comparar o arquivo com o banco apareceram dois itens que o pedido não lista:

- a tabela `cockpit_layouts` existe no banco e **não** está no snapshot;
- a view `pricing_snapshots_clean` existe no banco e não está no snapshot (o arquivo não tem seção de views).

Proposta: incluir as duas, pelo mesmo motivo do resto — um snapshot incompleto engana.
Se preferir manter o escopo estrito do pedido, é só dizer e eu deixo de fora.

## Como será feito

Leitura do catálogo (`pg_constraint`, `information_schema.columns`, `pg_indexes`, `pg_policies`,
`pg_get_viewdef`) para cada objeto afetado, e edição cirúrgica do arquivo: só as seções tocadas mudam,
o resto fica byte a byte igual. Nenhuma migration, nenhum comando de escrita no banco.
