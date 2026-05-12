# Encerramento de Block Trade com Preço Físico (v2 — aprovado)

Banco verificado: **0 batches `EXECUTED`** hoje, constraint estrita é segura. Ajustes obrigatórios incorporados: RPC atômico para o passo 6 e fallback do guardrail de mercado.

**Escopo**: o RPC cobre apenas as escritas do físico (physical_sales + operations + batch.physical_executed). A inserção de `orders` permanece client-side, como hoje — débito técnico existente, fora do escopo (será registrado no DECISIONS_LOG no prompt final).

---

## Passo 1 — Migration SQL (única chamada)

```sql
-- 1. operations: preço físico vendido
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS physical_sale_price_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_registered_at timestamptz;

-- 2. warehouse_closing_batches: estimado (no draft) + executado (na execução)
ALTER TABLE public.warehouse_closing_batches
  ADD COLUMN IF NOT EXISTS physical_sale_price_estimated_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_price_executed_brl_per_sack numeric;

-- 3. physical_sales: 1 linha por (operation, batch)
CREATE TABLE IF NOT EXISTS public.physical_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id),
  batch_id uuid NOT NULL REFERENCES public.warehouse_closing_batches(id),
  volume_sacks numeric NOT NULL CHECK (volume_sacks > 0),
  price_brl_per_sack numeric NOT NULL CHECK (price_brl_per_sack > 0),
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid,
  notes text,
  UNIQUE (operation_id, batch_id)
);
CREATE INDEX IF NOT EXISTS idx_physical_sales_operation ON public.physical_sales(operation_id);
CREATE INDEX IF NOT EXISTS idx_physical_sales_batch ON public.physical_sales(batch_id);

ALTER TABLE public.physical_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON public.physical_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Guardrail: batch EXECUTED exige preço executado
ALTER TABLE public.warehouse_closing_batches
  ADD CONSTRAINT physical_price_required_on_execution
  CHECK (status <> 'EXECUTED' OR physical_sale_price_executed_brl_per_sack IS NOT NULL);

-- 5. RPC atômico — escritas do físico em uma única transação
CREATE OR REPLACE FUNCTION public.execute_block_trade_physical(
  p_batch_id uuid,
  p_user_id uuid,
  p_sales jsonb,           -- [{operation_id, volume_sacks, price_brl_per_sack, current_volume_sacks}, ...]
  p_weighted_price numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale jsonb;
  v_op_id uuid;
  v_vol numeric;
  v_price numeric;
  v_current_vol numeric;
  v_existing_price numeric;
  v_original_vol numeric;
  v_previously_closed_vol numeric;
  v_final_price numeric;
BEGIN
  FOR sale IN SELECT * FROM jsonb_array_elements(p_sales) LOOP
    v_op_id       := (sale->>'operation_id')::uuid;
    v_vol         := (sale->>'volume_sacks')::numeric;
    v_price       := (sale->>'price_brl_per_sack')::numeric;
    v_current_vol := (sale->>'current_volume_sacks')::numeric;

    INSERT INTO public.physical_sales
      (operation_id, batch_id, volume_sacks, price_brl_per_sack, registered_by, notes)
    VALUES
      (v_op_id, p_batch_id, v_vol, v_price, p_user_id, 'Block trade ' || p_batch_id::text);

    SELECT physical_sale_price_brl_per_sack, volume_sacks
      INTO v_existing_price, v_original_vol
      FROM public.operations WHERE id = v_op_id;

    v_previously_closed_vol := v_original_vol - v_current_vol;

    IF v_existing_price IS NULL OR v_previously_closed_vol <= 0 THEN
      v_final_price := v_price;
    ELSE
      v_final_price := (v_existing_price * v_previously_closed_vol + v_price * v_vol)
                       / (v_previously_closed_vol + v_vol);
    END IF;

    UPDATE public.operations
       SET physical_sale_price_brl_per_sack = v_final_price,
           physical_sale_registered_at = now()
     WHERE id = v_op_id;
  END LOOP;

  UPDATE public.warehouse_closing_batches
     SET physical_sale_price_executed_brl_per_sack = p_weighted_price
   WHERE id = p_batch_id;
END;
$$;
```

Vou replicar `ALTER`s, `CREATE TABLE`, índice, RLS e RPC também no schema `staging` na mesma migration, mantendo paridade entre ambientes.

---

## Passo 2 — Aguardar regen de `src/integrations/supabase/types.ts`

Após approve, types vêm com `physical_sales`, novos campos de `operations`/`warehouse_closing_batches` e a função RPC. Onde tipo ainda não existir, uso `(supabase as any)` localmente — sem propagar `any`.

---

## Passo 3 — `ArmazensD24.tsx` (componente principal)

3.1. Importar `useLatestPhysicalPrices` e chamar.
3.2. Construir `operationsById` a partir das operações já carregadas:
```ts
const operationsById = useMemo(() => {
  const map: Record<string, OperationWithDetails> = {};
  for (const op of (d24Operations ?? [])) map[op.id] = op;
  return map;
}, [d24Operations]);
```
3.3. Em `handleBtSaveDraft`, antes do `insert(...)`:
```ts
const latestPhysical = latestPhysicalPrices?.find(
  p => p.warehouse_id === btWarehouse && p.commodity === btCommodity
);
const physicalEstimated = latestPhysical?.price_brl_per_sack ?? null;
```
e adicionar `physical_sale_price_estimated_brl_per_sack: physicalEstimated` ao payload.
3.4. Passar `operationsById` como nova prop pro `<BlockTradeExecutionModal />`.

---

## Passo 4 — Modal — Passo 1 (Ajustar Volumes e Preços)

4.1. Nova prop `operationsById`.
4.2. Estado `physicalPrices: Record<string, number | ''>`.
4.3. `useEffect` no `open`: inicializar cada `physicalPrices[op_id]` com `batch.physical_sale_price_estimated_brl_per_sack` (ou `''`).
4.4. Tabela "Volumes do batch" passa a ter 4 colunas: Código | A fechar (sc) | Preço orig. (R$/sc) | Preço físico (R$/sc) editável.
4.5. Validação `canReview = pricesOk && physicalOk` (cada físico > 0).
4.6. "Resultado estimado" passo 1 = Futures + NDF + Físico:
```ts
// TEMPORARY — physical P&L is calculated client-side for now.
// Must be moved to backend engine in next refactor. Source data
// (origination_price_brl, physical_sale_price_brl_per_sack) is
// persisted in operations + physical_sales for reconstruction.
const pnlFisicoTotal = proposals.proposals.reduce((s, p) => {
  const orig = operationsById[p.operation_id]?.origination_price_brl ?? 0;
  const venda = Number(physicalPrices[p.operation_id]) || 0;
  return s + (venda - orig) * Number(p.volume_to_close_sacks);
}, 0);
```

---

## Passo 5 — Modal — Passo 2 (Revisar)

5.1. Nova seção **Físico** após NDF, antes do "Resultado total":

| Operação | Volume (sc) | Preço orig. | Preço venda | Receita (R$) | Margem física (R$) |

Receita = `venda × volume`; Margem = `(venda − orig) × volume`. Linha de subtotal Σ Receita | Σ Margem.

5.2. Avisos não-bloqueantes (Alert amarelo):
- Para cada linha: se `Math.abs((venda - orig)/orig) > 0.30` → `⚠ {display_code}: margem física fora do padrão (variação > 30% sobre originação)` — sempre rodável.
- Comparação com mercado:
  ```ts
  const marketRef = latestPhysicalPrices?.find(
    p => p.warehouse_id === batch.warehouse_id && p.commodity === batch.commodity
  )?.price_brl_per_sack ?? null;
  ```
  - Se `marketRef != null`: para cada linha, se `Math.abs((venda - marketRef)/marketRef) > 0.10` → `⚠ {display_code}: preço diverge mais de 10% do mercado da praça`.
  - Se `marketRef == null`: NÃO roda comparação. Mostrar info (azul, não warning) abaixo da tabela: `ℹ Sem preço de mercado de referência para esta praça/commodity — guardrail de divergência de mercado desabilitado.`

5.3. "Resultado total estimado" passa a somar Futures + NDF + Margem física.

---

## Passo 6 — `handleExecute` (reescrito com RPC atômico)

Mantém **toda** a lógica atual de inserção de `orders` (loop client-side, fora de escopo).

Após o loop de orders, antes do `UPDATE warehouse_closing_batches SET status='EXECUTED'`:

```ts
// Calcular preço médio ponderado para auditoria
const totalVol = proposals.proposals.reduce((s, p) => s + Number(p.volume_to_close_sacks), 0);
const weightedPrice = totalVol > 0
  ? proposals.proposals.reduce(
      (s, p) => s + Number(physicalPrices[p.operation_id]) * Number(p.volume_to_close_sacks), 0
    ) / totalVol
  : 0;

// Escritas do físico em transação atômica
const salesPayload = proposals.proposals.map(p => ({
  operation_id: p.operation_id,
  volume_sacks: Number(p.volume_to_close_sacks),
  price_brl_per_sack: Number(physicalPrices[p.operation_id]),
  current_volume_sacks: Number(p.current_volume_sacks),
}));

const { error: rpcError } = await (supabase as any).rpc('execute_block_trade_physical', {
  p_batch_id: batch.id,
  p_user_id: userId,
  p_sales: salesPayload,
  p_weighted_price: weightedPrice,
});
if (rpcError) throw new Error(rpcError.message);
```

E o `UPDATE warehouse_closing_batches` existente vira:
```ts
.update({
  status: 'EXECUTED',
  generated_orders_count: totalOrdersInserted,
  // physical_sale_price_executed_brl_per_sack já foi populado pelo RPC,
  // satisfazendo a CHECK constraint
})
```

Janela de inconsistência conhecida: se o `UPDATE status='EXECUTED'` falhar após o RPC, batch fica DRAFT mas com `physical_sale_price_executed_brl_per_sack` preenchido. Reexecução vai falhar no `UNIQUE (operation_id, batch_id)` de `physical_sales`, sinalizando claramente o problema. Aceitável para esta entrega — anotado para DECISIONS_LOG.

Guardar `weightedPrice` em state pra usar na tela de conclusão.

---

## Passo 7 — Tela "Execução Concluída"

Acima da tabela atual:
```
Físico vendido — preço médio R$ X,XX/sc · receita total R$ Y
```
- Preço médio = `weightedPrice`
- Receita total = `Σ (price × volume)` por linha (calculado a partir de `salesPayload` salvo em state).

---

## Passo 8 — QA manual

1. Batch novo do zero → preço por linha → executar → SQL: confere `physical_sales`, `operations.physical_sale_price_brl_per_sack`, `warehouse_closing_batches.physical_sale_price_executed_brl_per_sack`.
2. Batch DRAFT antigo (sem estimado) → modal abre, físico inicia vazio, exige preenchimento.
3. Tentar avançar sem preencher um físico → "Revisar" desabilitado.
4. Forçar preço com >30% desvio → warning amarelo, execução continua possível.
5. Praça/commodity sem `physical_prices` → mostrar info azul, sem comparação de mercado.
6. Reexecutar batch já executado → RPC falha em `UNIQUE`, toast de erro (comportamento esperado).

---

## Fora de escopo (registrar no DECISIONS_LOG no prompt final)

- Mover inserção de `orders` para o RPC (débito técnico existente, ficou pior com novas escritas mas escopo não inclui refatoração).
- Mover `UPDATE status='EXECUTED'` para dentro do RPC (janela residual de inconsistência aceita).
- Backend Python `/closing-batches/allocate` permanece igual.
- `physical_prices` continua exclusivamente leitura (`useLatestPhysicalPrices` não invalida porque nada escreve nela).

Aprovado nesta forma? Se sim, executo na ordem: migration → frontend → QA.
