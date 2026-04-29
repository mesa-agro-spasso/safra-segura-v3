# Migrar aba MTM para orders D24

## Problema
A aba MTM em `src/pages/OperacoesD24.tsx` consome `useHedgeOrders({ status: 'EXECUTED' })`, que aponta para a tabela legada `hedge_orders` (vazia/inexistente no fluxo D24). Por isso, operações `ACTIVE`/`PARTIALLY_CLOSED` nunca aparecem para cálculo de MTM, mesmo após "Registrar Execução".

## Escopo
Apenas `src/pages/OperacoesD24.tsx`. Nenhum hook novo, nenhuma Edge Function nova, nenhum outro arquivo tocado.

## Mudanças

### 1. Nova query `d24Orders`
Adicionar junto às demais queries (após linha ~561), buscando todas as `orders` abertas (`is_closing = false`) via `supabase.from('orders' as any)`. Mantém compatibilidade com RLS atual (SELECT permitido a authenticated).

### 2. Reescrever `handleCalculate` (linhas ~890–980)
- Trocar fonte de `orders` (hedge_orders) por `operations` filtradas por status `ACTIVE` ou `PARTIALLY_CLOSED`.
- Para cada operação, agrupar suas `orders` D24 (via `d24Orders.filter(operation_id === op.id)`) e converter cada `order` em uma `leg` no formato legado esperado pelo endpoint `/mtm/run` da API Python (mantendo o contrato atual do backend, sem mexer no Render).
- Calcular `optionPremiumCurrent` via `/pricing/option-premium` quando houver leg de opção (lógica preservada).
- Montar payload `hedgeOrder` no shape legado e chamar `/mtm/run` com `positions`.
- Persistir resultados via `saveMtm.mutateAsync` (lógica preservada).
- Mensagens de erro: "Dados de mercado ausentes" / "Nenhuma operação ativa".

### 3. Tabela "Operações Ativas — Inputs" (linhas ~1211–1251)
- Trocar a fonte de `orders` (hedge_orders) por `activeOpsForMtm = operations.filter(status ∈ {ACTIVE, PARTIALLY_CLOSED})`.
- Renderizar uma linha por operação D24, usando:
  - `op.id` como chave de `physicalPrices`
  - `op.warehouses?.display_name` (praça)
  - `(op as any).commodity` (com label PT)
  - `op.volume_sacks`
  - `(op as any).origination_price_brl`
- Render condicional passa a depender de `activeOpsForMtm.length`.

### 4. Botões "Calcular MTM" (linhas 1123 e 1198)
- Substituir `disabled={calculating || !orders?.length}` por `disabled={calculating || !activeOpsForMtm.length}`.

### 5. STATUS_BADGE (linhas ~405–417)
Adicionar 3 entradas D24:
- `ACTIVE` → "Ativa", verde
- `PARTIALLY_CLOSED` → "Parcial. Encerrada", laranja outline
- `CLOSED` → "Encerrada", secondary

(Os legados em PT permanecem para compatibilidade com operações antigas.)

## Notas técnicas
- `useHedgeOrders` continua importado e usado pela tabela "Resultado MTM" (mapeia metadados via `orders?.find(o => o.operation_id === r.operation_id)` para praça/commodity/datas em `displayResults`). Como essa tabela é alimentada por `mtmSnapshots` (cache) ou pelo resultado de `/mtm/run`, e ambos retornam `operation_id`, o `find` simplesmente devolverá `undefined` para operações D24, caindo nos fallbacks `'—'` já existentes. Aceitável nesta fatia — a aba volta a funcionar e os metadados da tabela de resultado podem ser migrados em iteração futura.
- Triggers de DB já garantem que operações com `orders` abertas estão em `ACTIVE`/`PARTIALLY_CLOSED`, então o filtro por status é suficiente.
- `d24Orders` invalidação não é crítica aqui (cálculo MTM é manual via botão), mas a queryKey `['d24-orders-active']` permite invalidação futura se necessário.

## Fora de escopo
- Migrar a tabela "Resultado MTM" para usar `operations` em vez de `orders` legados (segue funcional com fallbacks).
- Refatorar `snapshotResults` (depende de `orders?.length` apenas como guard, não bloqueia exibição depois de calcular).
- Remover `useHedgeOrders` do arquivo.
