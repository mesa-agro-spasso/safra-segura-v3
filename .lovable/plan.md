

# Combinações de Precificação — Plano de Implementação

## Escopo

4 arquivos: tipo atualizado, hook novo, Settings com aba Combinações, GeneratePricingModal refatorado.

## 1. Atualizar `src/types/index.ts`

Substituir `PricingCombination` pelo tipo completo com todos os campos da tabela (id, warehouse_id, commodity, benchmark, ticker, exp_date, sale_date, payment_date, is_spot, grain_reception_date, target_basis, campos de custo opcionais, additional_discount_brl, active, created_at, updated_at).

## 2. Criar `src/hooks/usePricingCombinations.ts`

- `usePricingCombinations(activeOnly?: boolean)` — SELECT * com filtro opcional `active = true`
- `useUpsertPricingCombination()` — upsert mutation
- `useTogglePricingCombinationActive()` — update apenas o campo `active`

## 3. Refatorar `src/pages/Settings.tsx`

Adicionar `Tabs` (Armazéns | Combinações).

**Aba Combinações:**
- Tabela com colunas: Armazém, Commodity, Ticker, Benchmark, Sale Date, Payment/Spot, Basis, Status, Ações
- Filtro toggle ativo/inativo
- Botão "Nova Combinação" abre Dialog
- Edit e Toggle ativo inline por linha

**Formulário:**
- Select warehouse (dos ativos), Select commodity (soybean/corn), Select benchmark (cbot/b3)
- Input ticker, exp_date (opcional), DatePicker sale_date
- DatePicker payment_date (desabilitado quando is_spot=true), Switch is_spot
- DatePicker grain_reception_date (opcional), Input target_basis, Input additional_discount_brl
- Seção colapsável "Sobrescrever custos do armazém": interest_rate, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract, desk_cost_pct, shrinkage_rate_monthly — todos opcionais com placeholder "Herdar do armazém"

## 4. Refatorar `src/components/GeneratePricingModal.tsx`

Remover DatePickers, seleção de tickers, e `resolveBasis`. O modal agora:

1. Busca `pricing_combinations` ativas
2. Busca `market_data` e `warehouses`
3. Mostra resumo: "X combinações ativas para Y armazéns"
4. Para cada combinação monta o payload:
   - `exp_date`: da combinação ou fallback do market_data pelo ticker
   - `payment_date`: se `is_spot=true`, `getNextTuesday(today)` (sempre T+7, nunca hoje); senão da combinação
   - `grain_reception_date`: da combinação ou fallback para payment_date
   - `exchange_rate`: USD/BRL de market_data
   - `futures_price`: market_data.price pelo ticker
   - `display_name`: do warehouse
   - Campos de custo: da combinação quando não-null, senão do warehouse.basis_config
5. Botão "Gerar" chama POST /pricing/table

**Função `getNextTuesday`:**
```typescript
function getNextTuesday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntilTuesday = day === 2 ? 7 : (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilTuesday);
  return d;
}
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/types/index.ts` | Atualizar PricingCombination |
| `src/hooks/usePricingCombinations.ts` | Novo |
| `src/pages/Settings.tsx` | Tabs + aba Combinações CRUD |
| `src/components/GeneratePricingModal.tsx` | Refatorar para usar combinações |

