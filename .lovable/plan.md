# Plano — Carrego financeiro do prêmio no Modal de Seguro

## Objetivo
Adicionar suporte ao carrego financeiro no `InsuranceLayerModal`, repassando 5 novos campos ao endpoint `POST /pricing/insurance-layer` (já no whitelist do api-proxy) e persistindo o que vier no `insurance_snapshots`. Zero cálculo financeiro no front (P07) — o front só seleciona a fonte, repassa e exibe.

## Arquivos afetados
- `src/components/InsuranceLayerModal.tsx` — UI + payload + persistência mapeada.
- `src/pages/PricingTable.tsx` — passar campos extras de snapshot (`trade_date`, `payment_date`, `grain_reception_date`, `inputs_json`) e o `warehouseInterestMap` (taxa + período) para o modal.
- `src/hooks/useInsuranceSnapshots.ts` — adicionar `carry_*` ao tipo `InsuranceSnapshotRow` (sem mudar lógica de upsert; já é genérico).

## Origem dos novos campos (por linha)
| Campo no request | Fonte |
|---|---|
| `carry_enabled` | toggle no modal, default ON. Só habilitado se `enabled` (seguro) ON. |
| `interest_rate` | `snapshot.inputs_json.interest_rate`; se null → `warehouse.interest_rate`. **Repassar em %, sem dividir por 100.** |
| `interest_rate_period` | `warehouse.interest_rate_period` (buscar pelo `snapshot.warehouse_id`); se null → `'monthly'`. |
| `trade_date` | `snapshot.trade_date` (início do carrego). |
| `payment_receipt_date` | input de data no modal (fim do carrego). Default = `snapshot.grain_reception_date` ?? `snapshot.payment_date`. |

Se taxa indisponível (inputs_json e warehouse ambos null) → toggle de carrego desabilitado com aviso curto.

## Mudanças no `InsuranceLayerModal.tsx`

### Tipos
- Expandir `Row` para incluir `trade_date`, `payment_date`, `grain_reception_date`, `inputs_json`.
- Nova prop `warehouseInterestMap?: Record<string, { rate: number | null; period: string | null }>`.
- Estender `RowState` com `carryEnabled: boolean` e `paymentReceiptDateStr: string` (YYYY-MM-DD).
- Estender `InsuranceResult` com `carry_enabled`, `carry_cost_brl`, `total_insurance_cost_brl`.

### Init state (no `useEffect` quando abre)
Para cada linha calcular:
- `effectiveRate` = `inputs_json.interest_rate ?? warehouseInterestMap[wid]?.rate ?? null`
- `effectivePeriod` = `warehouseInterestMap[wid]?.period ?? 'monthly'`
- `carryAvailable` = `effectiveRate != null`
- `carryEnabled` = inicia em `true` se disponível e (nada salvo ainda OR existing.carry_enabled), senão `false`
- `paymentReceiptDateStr` = `existing.payment_receipt_date ?? grain_reception_date ?? payment_date ?? ''`

Quando carregar `existing` com `carry_interest_rate` salvo, preservar (mas o request sempre re-resolve a partir da fonte atual — mantemos a regra "front só seleciona a fonte").

### UI (dentro do bloco por-linha e do header global)
- Abaixo da grid de seguro existente, novo bloco global:
  - `Switch` "Aplicar carrego financeiro do prêmio" (default ON), controla um aplicar-em-todas; quando desligado globalmente desliga `carryEnabled` em todas as linhas.
- Por linha (expand): adicionar 2 colunas extras:
  - Toggle carrego (disabled se `!s.enabled` ou `!carryAvailable`; tooltip "Taxa indisponível" quando aplicável).
  - Input `type="date"` "Data recebimento" — visível só quando carrego ligado, pré-preenchido com default.
- Mostrar resumo por linha (após Apply ou usando existing): `carry_cost_brl`, `insurance_cost_brl`, `total_insurance_cost_brl`, `adjusted_price_brl`.

### `handleApply` (payload)
Para cada item, além dos campos atuais:
```ts
{
  ...campos atuais,
  carry_enabled: carryEffective,
  interest_rate: effectiveRate,          // em %, como está
  interest_rate_period: effectivePeriod, // 'monthly' | 'yearly'
  trade_date: r.trade_date,
  payment_receipt_date: s.paymentReceiptDateStr,
}
```
Onde `carryEffective = s.enabled && s.carryEnabled && carryAvailable`.

Validação client-side antes do POST: se `carryEffective`, exigir `effectiveRate`, `trade_date` e `payment_receipt_date` não-vazios — caso contrário toast e abortar (o backend rejeita 422, mas validamos para UX).

### Persistência (`upsertRows`)
Adicionar ao registro upsertado:
- `carry_enabled: result.carry_enabled`
- `payment_receipt_date: s.paymentReceiptDateStr || null`
- `carry_cost_brl: result.carry_cost_brl`
- `carry_interest_rate: effectiveRate`         // valor em % enviado
- `carry_interest_rate_period: effectivePeriod`

`insurance_cost_brl` e `adjusted_price_brl` continuam vindo do response (já são gravados hoje). `adjusted_price_brl` no response agora é `base − total_insurance_cost_brl` — basta gravar o que o backend devolve.

## Mudanças em `PricingTable.tsx`
- No render do `InsuranceLayerModal`, repassar:
  - linhas com `trade_date`, `payment_date`, `grain_reception_date`, `inputs_json` (já estão em `allRows` — só ajustar o cast).
  - `warehouseInterestMap` construído a partir do hook de warehouses existente: `{ [id]: { rate: w.interest_rate, period: w.interest_rate_period } }`.

## Mudanças em `useInsuranceSnapshots.ts`
- Adicionar a `InsuranceSnapshotRow`:
  - `carry_enabled?: boolean | null`
  - `carry_cost_brl?: number | null`
  - `carry_interest_rate?: number | null`
  - `carry_interest_rate_period?: string | null`
  - `payment_receipt_date?: string | null`

(As colunas já existem no banco — confirmado em `types.ts` linhas 156–191. Nenhuma migração SQL.)

## O que NÃO será feito
- Sem alterações em Edge Functions / endpoint.
- Sem cálculo financeiro no front (taxas, períodos, datas só são repassados).
- Sem migração SQL.
- Não alterar formato do `coverage_pct` (continua `% / 100` no request, como hoje).

## Verificação pós-implementação
- Abrir modal: toggle carrego visível e ON por default; campo data visível quando ON.
- Linha sem taxa disponível → toggle de carrego desabilitado com aviso.
- Apply: request inclui os 5 campos novos; response com `carry_cost_brl` e `total_insurance_cost_brl` exibido; upsert em `insurance_snapshots` grava os 5 novos campos.
