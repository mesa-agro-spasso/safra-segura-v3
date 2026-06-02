# Herança visual de custos no CombinationsTab

## Contexto
No modal de edição de combinações (Settings → Combinações), os campos de custo que herdam do armazém atualmente mostram apenas o placeholder "Herdar do armazém". O objetivo é tornar o valor herdado visível (pré-preenchido, em estilo apagado) e permitir "voltar a herdar" quando houver override.

## O que será feito

### 1. Novos helpers + substituição do `numField`
Logo acima do `numField` atual (entre `handleSave` e o `return`), adicionar:

- `selectedWarehouse`: busca o armazém correspondente a `editing?.warehouse_id`.
- `inheritedValueFor(key)`: resolve o valor herdado do armazém, com lógica especial para `brokerage_per_contract` (escolhe `b3` ou `cbot` conforme `editing.benchmark`).
- Novo `numField(label, key, placeholder?, inheritable?)`:
  - Se `inheritable === true` e não houver override (`override == null`), pré-preenche o input com o valor herdado em `text-muted-foreground italic`.
  - Mostra a legenda "Herdado do armazém" abaixo do input.
  - Se houver override, exibe um link "voltar a herdar" que seta o campo para `null`.
  - A regra de salvamento continua igual: campo sem override salva `null` no banco.

### 2. Ativar herança visual nos 6 campos de custo
Dentro do `CollapsibleContent` "Sobrescrever custos do armazém", passar `true` como 4º argumento apenas em:

- `interest_rate`
- `storage_cost`
- `reception_cost`
- `brokerage_per_contract`
- `desk_cost_pct`
- `shrinkage_rate_monthly`

### 3. O que NÃO muda
- `numField` do Long Basis (`target_basis`, `additional_discount_brl`) — sem 4º argumento.
- Select de `storage_cost_type` — inalterado.
- Lógica de `handleSave`.
- `inheritCost` do `GeneratePricingModal`.

## Arquivos alterados
- `src/pages/Settings.tsx`