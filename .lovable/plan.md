# Plano — Fundação D24 (Tipagens + Serviço de API)

Criar a camada de tipos e o cliente de serviço para os novos endpoints orientados a evento (operation-centric). Sem mudanças em UI. **Não tocar na Edge Function `api-proxy`** (gerenciada externamente; allowlist já atualizada).

## Arquivos a criar

### 1. `src/types/d24.ts` (novo)
Espelha exatamente os schemas Pydantic do backend. Interfaces exportadas:

- `PricingSnapshotIn`
- `HedgePlanItemIn`
- `OperationIn`
- `OrderIn`
- `ValidationAlertOut`
- `OperationBalanceOut`

Campos e opcionalidade idênticos ao especificado no pedido (strings simples para preservar paridade com backend, sem unions estreitos).

### 2. `src/services/d24Api.ts` (novo)
Funções que invocam a Edge Function `api-proxy` via `supabase.functions.invoke('api-proxy', { body: { endpoint, body } })` — padrão exato pedido (sem reaproveitar `callApi`, para manter o contrato literal solicitado).

Funções exportadas:

| Função | Endpoint | Payload | Retorno |
|---|---|---|---|
| `buildHedgePlan(operation, pricingSnapshot)` | `POST /operations/build-plan` | `{ operation, pricing_snapshot }` | `{ plan: HedgePlanItemIn[]; order_message: string; confirmation_message: string }` |
| `calculateBalance(operation, existingOrders)` | `POST /operations/balance` | `{ operation, existing_orders }` | `{ balance: OperationBalanceOut }` |
| `validateExecution(operation, existingOrders, newOrder)` | `POST /orders/validate-execution` | `{ operation, existing_orders, new_order }` | `{ is_valid: boolean; structural_errors: string[]; business_alerts: ValidationAlertOut[]; balance_after: OperationBalanceOut }` |
| `allocateClosingBatch(payload)` | `POST /closing-batches/allocate` | `payload` (passa direto) | `unknown` |

Tratamento padrão em todas: `if (error) throw error; return data;`. Sem normalização extra (regra "frontend só repassa").

## Convenções de payload

Snake_case nos campos enviados ao backend Python (`pricing_snapshot`, `existing_orders`, `new_order`). CamelCase apenas nos parâmetros TS.

## Fora de escopo

- Nenhuma alteração de componente, página, hook ou contexto.
- Nenhuma alteração na Edge Function `api-proxy`.
- Nenhuma migration de banco.
- Nenhum teste automatizado.
- Tipagem completa de `allocateClosingBatch` permanece `unknown` por design (próxima etapa).

## Resposta final

Após implementar, responder exatamente: **"Tipagens e Serviço D24 criados com sucesso"** seguido dos blocos de código dos 2 arquivos para revisão.
