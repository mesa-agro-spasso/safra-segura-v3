# Etapa B — GeneratePricingModal aceita TARGET_PRICE no batch

## Objetivo
Permitir que combinações `TARGET_PRICE` e `LONG_BASIS` convivam no mesmo batch enviado para `POST /pricing/table`, com payload coerente por método e snapshots auditáveis.

## Arquivo único alterado
- `src/components/GeneratePricingModal.tsx`

Nenhum outro arquivo, hook, tipo ou query muda.

## Mudança 1 — `handleGenerate`, montagem do `payload`

No loop `for (const combo of combinations)`, substituir o `payload.push({...})` atual (linhas ~170-198) por:

1. Resolver método com fallback retrocompat:
   ```ts
   const pricingMethod = combo.pricing_method ?? 'LONG_BASIS';
   ```

2. Construir `baseCombo` com os campos comuns (warehouse, datas, custos herdados, sigma, futures_price, exchange_rate, `pricing_method`).

3. Ramo `LONG_BASIS`:
   - Se `combo.target_basis == null` → `toast.warning(... sem target_basis — pulando)` e `continue`.
   - Push: `baseCombo + target_basis + additional_discount_brl` (mantém comportamento atual).

4. Ramo `TARGET_PRICE`:
   - Se `combo.origination_price_net_brl == null` → `toast.warning(... sem origination_price_net_brl — pulando)` e `continue`.
   - Push: `baseCombo + origination_price_net_brl + additional_discount_brl: 0` (forçado).

5. Default (método desconhecido) → `toast.warning` + `continue`.

## Mudança 2 — `inputs_json` do snapshot

No `apiResults.map(...)` que monta os snapshots (linhas ~231-243), expandir `inputs_json` para registrar auditoria do método:

```ts
inputs_json: {
  pricing_method: orig.pricing_method,
  futures_price: orig.futures_price,
  exchange_rate: orig.exchange_rate ?? null,
  exp_date: orig.exp_date ?? null,
  target_basis: orig.target_basis ?? null,
  origination_price_net_brl: orig.origination_price_net_brl ?? null,
  interest_rate: orig.interest_rate,
  storage_cost: orig.storage_cost,
  storage_cost_type: orig.storage_cost_type,
  reception_cost: orig.reception_cost,
  brokerage_per_contract: orig.brokerage_per_contract,
  desk_cost_pct: orig.desk_cost_pct,
  shrinkage_rate_monthly: orig.shrinkage_rate_monthly,
},
```

Restante da montagem do snapshot fica intacto (o backend já devolve `target_basis_brl` e `origination_price_brl` em ambos os métodos).

## Garantias / não-mudanças
- UI do modal inalterada (contador, avisos B3, botão Gerar).
- Tipo `PricingCombination` já tem `pricing_method`, `target_basis` nullable e `origination_price_net_brl` (Etapa A).
- Hooks `usePricingCombinations` / `useSavePricingSnapshots` intocados.
- Schema do banco intocado.

## Validação manual após build
1. Modal mostra contador cobrindo combos LONG_BASIS + TARGET_PRICE.
2. "Gerar" produz toast de sucesso sem erros no console.
3. Em `pricing_snapshots`:
   - TARGET_PRICE → `origination_price_brl` = net informado, `target_basis_brl` calculado, `inputs_json.pricing_method === 'TARGET_PRICE'`, `origination_price_net_brl` preenchido, `target_basis === null`.
   - LONG_BASIS → mesmos números de antes, `inputs_json.pricing_method === 'LONG_BASIS'`, `target_basis` preenchido, `origination_price_net_brl === null`.
4. Combo TARGET_PRICE sem `origination_price_net_brl` (defensivo) → toast.warning, batch não quebra.
