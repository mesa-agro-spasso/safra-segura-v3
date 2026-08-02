# Payload em camadas no POST /pricing/table

O backend passou a resolver a herança de custos. O frontend deixa de fundir combinação sobre armazém e passa a enviar as duas fontes separadas, cruas.

## Mudanças em `src/components/GeneratePricingModal.tsx`

### Sai
- `inheritCost` — herança agora é do backend.
- `normalizeInterestPeriod` e `INTEREST_PERIOD_VOCAB` — o backend traduz o vocabulário.
- O bloqueio de geração por período de juros inválido (o `toast.error` + `return`). Cadastro inválido vira descarte de linha pelo backend.
- Todos os campos de custo do nível de cima de cada combinação: `interest_rate`, `interest_rate_period`, `storage_cost`, `storage_cost_type`, `reception_cost`, `brokerage_per_contract`, `desk_cost_pct`, `shrinkage_rate_monthly`, `additional_discount_brl`.

### Entra
Dois objetos por combinação, montados por cópia direta do cadastro, sem default, sem conversão de null↔0:

- `combination`: `interest_rate`, `storage_cost`, `storage_cost_type`, `reception_cost`, `brokerage_per_contract`, `desk_cost_pct`, `shrinkage_rate_monthly`, `additional_discount_brl` — todos vindos da linha de `pricing_combinations`.
  - **Confirmado: `pricing_combinations` NÃO tem coluna `interest_rate_period`.** O campo não vai nesta camada. Nada é inventado nem copiado do armazém.
- `warehouse`: `interest_rate`, `interest_rate_period`, `storage_cost`, `storage_cost_type`, `reception_cost`, `brokerage_per_contract_cbot`, `brokerage_per_contract_b3`, `desk_cost_pct`, `shrinkage_rate_monthly` — todos vindos do cadastro do armazém. Sem `additional_discount_brl` (422) e sem `brokerage_per_contract` sem sufixo (422).

`manual_override` não é enviado nesta entrega.

`additional_discount_brl` no TARGET_PRICE: **omitido por completo** — nem `0`, nem o valor cadastrado. Enviar zero inventado pelo frontend carimbaria `source="combination"` numa origem falsa. Omitido, cai em `system_default` ou a linha é recusada pelo backend, que é a regra do schema. No LONG_BASIS o campo segue indo dentro de `combination` com o valor cadastrado.

### Continua igual
- Validações de mercado: ticker ausente, preço B3 faltando, contrato vencido, milho CBOT > 24h, `target_basis` / `origination_price_net_brl` obrigatórios por método.
- `trade_date` e `spot_usd_brl` no nível da requisição; `exchange_rate_override` por linha, só CBOT.
- Lista de descartes e recasamento por `index`.
- `outputs_json: { ...r }` por spread — `resolved_inputs` chega íntegro sem nenhuma alteração de código.
- `inputs_json`: continua gravando o mesmo conteúdo; os campos de custo passam a ser lidos de `orig.combination` / `orig.warehouse` em vez do nível de cima.

## Descartes

`DiscardedCombinationsList` já cai no `default` do `switch` e mostra `item.detail` ou o código cru. `UNRESOLVED_COST_PARAMETER` aparece sem alteração — nada a fazer.

## Escopo negativo

Nenhum cálculo financeiro no frontend, nenhuma mudança de schema, nenhuma exibição de `resolved_inputs` (é o cockpit, tarefa separada), nenhum outro arquivo alterado.
