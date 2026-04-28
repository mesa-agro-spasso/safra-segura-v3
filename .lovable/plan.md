# Plano v2 — OrdensD24.tsx (Fase 4 D24)

Correções aplicadas vs v1:
- 🔴 Validação por leg: cada leg é uma `Order` independente. N legs = N chamadas a `validateExecution`, sem agregação. Cada leg expõe seu próprio resultado.
- 🟡 Datas da `OperationIn` vêm de `operations` (via `useOperations`), não de `pricing_snapshots`.

## Arquivos

1. **Criar** `src/pages/OrdensD24.tsx`.
2. **Editar** `src/App.tsx` — adicionar `import OrdensD24 from "./pages/OrdensD24"` e `<Route path="/ordens-d24" element={<OrdensD24 />} />` dentro do bloco protegido (ao lado de `/ordens`).

Nada mais é tocado. Hooks reusados: `useHedgeOrders`, `useUpdateHedgeOrder`, `useActiveArmazens`, `useOperations`, `useAuth`.

## Filtros (4 multi-select independentes)

Componente local `MultiSelect` em `Popover` + `Checkbox` (sem nova dependência). Trigger: "Todas" se vazio, label único se 1 selecionado, "N selecionadas" caso contrário.

| Filtro | Fonte |
|---|---|
| Praça | `useActiveArmazens` → `display_name`, valor `id` |
| Commodity | fixo: `soybean\|cbot` (Soja CBOT), `corn\|b3` (Milho B3) |
| Operação | `useOperations` → `display_code` |
| Status | fixo: GENERATED, SENT, APPROVED, EXECUTED, CANCELLED |

Botões globais: **Selecionar Todos** preenche todos os 4 sets com todas as opções; **Limpar Filtros** zera todos.

Filtragem client-side. Set vazio = sem restrição. Praça resolvida via `order.operation_id → operations.warehouse_id`.

## Tabela

Fonte: `useHedgeOrders()` (sem filtros server-side).

Sort: `SENT(1) → APPROVED(2) → GENERATED(3) → EXECUTED(4) → CANCELLED(5)`, depois `created_at DESC`.

Colunas: Praça | ID Operação (`display_code` ou UUID truncado) | Commodity (badge) | Volume sc (`pt-BR`) | Preço orig. (R$/sc) | Pernas (resumo `instrument(direction)` join ` + `) | Status (badge) | Data (`dd/MM/yyyy`) | Ações.

Badges: GENERATED cinza, SENT azul (outline), APPROVED amarelo (outline), EXECUTED verde, CANCELLED vermelho.

Ações por status (com `e.stopPropagation()`):
- GENERATED → **Enviar** (status=SENT), **Cancelar** (modal motivo)
- SENT → **Aprovar** (status=APPROVED), **Rejeitar** (modal motivo)
- APPROVED → **Executar** (modal execução), **Cancelar** (modal motivo)
- EXECUTED / CANCELLED → vazio

Click na linha (fora de Ações) abre Sheet de detalhe.

## Sheet de detalhe (somente leitura, lado direito)

- Identificação: commodity, exchange, status, `created_at`, `notes`.
- Volume e Preço: `volume_sacks`, `origination_price_brl`.
- Pernas: para cada item de `order.legs`, render de todos os campos não-nulos em grid 2 colunas.

Sem ações.

## Dialog de motivo (Cancelar / Rejeitar)

`Dialog` com `Textarea` + botão "Confirmar" desabilitado se `reason.trim() === ''`.

Cancelar → update `{ status: 'CANCELLED', cancellation_reason, cancelled_at, cancelled_by }`.
Rejeitar (de SENT) → mesma payload, `cancellation_reason` prefixado `[Rejeição] ` (não há status REJECTED definido na lista).

## Dialog de execução — uma validação por leg

### Estado

```ts
type ExecutionLeg = {
  leg_type: string; direction: string; ticker?: string;
  contracts?: number; volume_units?: number; currency: string;
  _price: string; _qty: string; _notes: string;
};

type LegValidation = {
  status: 'idle' | 'loading' | 'done' | 'error';
  result?: ValidateExecutionResponse;
  errorMsg?: string;
};

const [execLegs, setExecLegs] = useState<ExecutionLeg[]>([]);
const [validations, setValidations] = useState<LegValidation[]>([]);
```

Editar qualquer campo de uma leg → essa leg volta para `status: 'idle'` e limpa `result`. Outras legs permanecem inalteradas.

### Layout por leg (card individual)
- Header somente leitura: `leg_type · ticker · direction`.
- Input "Contratos" (futures/option) ou "Volume USD" (ndf) → `_qty`.
- Input "Preço" + label de unidade:
  - `ndf` → `BRL/USD`
  - exchange `cbot` (não-ndf) → `USD/bushel`
  - exchange `b3` (não-ndf) → `BRL/sc`
- Input "Obs." → `_notes`.
- Botão **"Validar leg"** (por leg).
- Painel de resultado da leg (abaixo dos inputs):
  - `structural_errors[]` em blocos vermelhos com `AlertCircle`.
  - `business_alerts[]` coloridos por `level` (ERROR=vermelho, WARNING=amarelo, INFO=azul).
  - Se `is_valid && !hasError` → "✓ Leg válida" verde.

### Chamada `validateExecution` (por leg)

`OperationIn` montada **uma vez** a partir de `useOperations`:
```ts
const op = operations?.find(o => o.id === order.operation_id);
const operationIn: OperationIn = {
  id: op.id,
  warehouse_id: op.warehouse_id,
  commodity: op.commodity,
  exchange: op.exchange,
  volume_sacks: op.volume_sacks,
  origination_price_brl: op.origination_price_brl,
  trade_date: op.trade_date,
  payment_date: op.payment_date,
  grain_reception_date: op.grain_reception_date,
  sale_date: op.sale_date,
  status: op.status,
  hedge_plan: (op.hedge_plan as HedgePlanItemIn[]) ?? [],
};
```

> Nota: a interface TS `Operation` em `src/types/index.ts` não declara hoje as colunas `exchange`, `trade_date`, `payment_date`, `grain_reception_date`, `sale_date`, `origination_price_brl`, `hedge_plan`, embora elas existam na tabela `operations` do banco. Para não editar `src/types/index.ts` (escopo proíbe), o componente fará um cast pontual `op as unknown as { ... }` com os campos necessários. Se algum desses campos vier `null/undefined` em runtime, exibe erro inline e bloqueia validação.

`existingOrders: []` (etapa 3 expande).

Para cada leg (`i`):
```ts
const CONTRACT_SIZE = order.exchange.toLowerCase() === 'b3' ? 450 : 5000;
const isNdf = leg.leg_type === 'ndf';
const newOrder: OrderIn = {
  operation_id: order.operation_id,
  instrument_type: leg.leg_type,
  direction: leg.direction,
  currency: leg.currency,
  contracts: parseFloat(leg._qty),
  volume_units: isNdf ? parseFloat(leg._qty) : parseFloat(leg._qty) * CONTRACT_SIZE,
  executed_at: new Date().toISOString(),
  executed_by: user.id,
  is_closing: false,
  ticker: leg.ticker,
  price: !isNdf ? parseFloat(leg._price) : undefined,
  ndf_rate: isNdf ? parseFloat(leg._price) : undefined,
  notes: leg._notes || undefined,
};
const res = await validateExecution(operationIn, [], newOrder);
setValidations(v => v.map((x, j) => j === i ? { status: 'done', result: res } : x));
```

Sem agregação cross-leg. Cada `LegValidation` é totalmente independente.

### Botão "Confirmar Execução" (rodapé do modal)

Habilitado **somente quando**:
1. Todas as legs têm `validations[i].status === 'done'`
2. Para todas: `result.is_valid === true`
3. Para todas: `result.business_alerts` não contém item com `level === 'ERROR'`

Indicador textual no rodapé: "X / N legs validadas".

Ao confirmar: `useUpdateHedgeOrder` com:
```ts
{
  id: order.id,
  status: 'EXECUTED',
  executed_legs: execLegs.map(...campos reais...),
  executed_at: new Date().toISOString(),
  executed_by: user.id,
}
```
Toast `Ordem ${display_code} executada`. Fecha modal.

## Restrições (recap)

- Sem sessionStorage.
- Sem cálculo local (saldo/plano/validação).
- Sem nova Edge Function.
- Sem aba "Criar Ordem" / "Registro Manual".
- Não importa de `Orders.tsx`.
- Não edita `src/types/index.ts` (cast local pontual em vez disso).

Aprove para eu executar.
