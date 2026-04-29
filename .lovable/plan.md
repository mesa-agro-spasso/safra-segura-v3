# Plano — Nova tela `OperacoesD24.tsx` (revisado)

## Escopo
Criar `src/pages/OperacoesD24.tsx` (arquivo novo) e adicionar import + rota `/operacoes-d24` em `src/App.tsx` (única alteração fora do arquivo novo). Nenhum hook ou serviço novo — tudo reutilizado.

## Estrutura de alto nível
```text
OperacoesD24
├── Header (título + StatusDot último MTM/mercado)
└── Tabs
    ├── Operações  → ColumnSelector + filtro Ativas/Encerradas/Todas + "Nova Operação"
    ├── MTM        → disclaimer + tabela resultados (ColumnSelector) + "Calcular MTM" + inputs físico
    └── Resumo     → 3 cards + tabela por perna (ColumnSelector) + gráfico recharts toggle
```

## Componente local `ColumnSelector`
Popover com ícone `Columns` (lucide), checkboxes por coluna, botões "Todas"/"Nenhuma".
Estado em `Set<string>`, persistido em `localStorage` por chave (`cols_operacoes`, `cols_mtm`, `cols_resumo`). Coluna "Ações" fica fora do seletor (sempre visível).

## Aba Operações
- Fonte: `useOperationsWithDetails`.
- Sort/badges: `STATUS_ORDER` e `STATUS_BADGE` copiados de `OperationsMTM.tsx`.
- Colunas (default ON): `praca, commodity, ticker, volume, preco_orig, trade_date, payment_date, reception_date, sale_date, status`.
- Linha → `Sheet right sm:max-w-2xl` com `Tabs Detalhes | MTM`:
  - **Detalhes**: identificação, precificação (do `pricing_snapshots`), datas, ordens vinculadas (`useHedgeOrders` filtrado por `operation_id`).
  - **MTM**: snapshot mais recente do `useMtmSnapshots` para a operação, ou mensagem vazia.
- Coluna **Ações** fixa: botão "Encerrar" se `status === 'HEDGE_CONFIRMADO'`.

## Modal Nova Operação
Disclaimer fixo no topo. Campos: Praça (`useActiveArmazens`), Commodity (`soybean|cbot` / `corn|b3`), Volume sacas, Preço originação R$/sc, Snapshot referência (`usePricingSnapshots` filtrado por commodity+benchmark), Trade date (default hoje), Notas. Snapshot auto-preenche `payment_date / grain_reception_date / sale_date` (editáveis depois).

**Botão "Gerar Plano"**:
1. Monta `OperationIn` com `status='DRAFT', hedge_plan=[]`, `origination_price_brl` do form.
2. Monta `PricingSnapshotIn`: `ticker`, `payment_date`, `futures_price_usd` (`outputs_json.futures_price_usd`), `futures_price_brl` (coluna direta), `exchange_rate` (`exchange_rate ?? outputs_json.exchange_rate`).
3. `buildHedgePlan(op, ps)` → exibe `plan[]`, `order_message`, `confirmation_message`.

**Botão "Confirmar e Salvar"** — INSERT direto via `(supabase as any).from('operations').insert({...})` com **todos** os campos obrigatórios:
```ts
{
  warehouse_id,
  commodity,
  exchange,
  volume_sacks,
  origination_price_brl,            // ← obrigatório, vem do form
  trade_date,
  payment_date,
  grain_reception_date,
  sale_date,
  status: 'DRAFT',
  pricing_snapshot_id,
  notes,
  hedge_plan: plan,                 // JSONB do buildHedgePlan
  created_by: user.id,
}
```
Toast com `display_code ?? id.slice(0,8)`, fecha modal, invalida `['operations_with_details']` e `['operations']`.

## Modal Encerramento (Block Closing)
Disclaimer fixo no topo. Campos: Volume a encerrar (default `volume_sacks`), Estratégia (`PROPORTIONAL` default / `MAX_PROFIT` / `MAX_LOSS`).

**Botão "Calcular Proposta"**:
1. Filtra `operations` por mesmo `warehouse_id` + `commodity`, status `HEDGE_CONFIRMADO`.
2. Para cada operação, junta as `hedge_orders` correspondentes com `status='EXECUTED'` (do `useHedgeOrders()` carregado).
3. **Conversão `HedgeOrder → OrderIn[]` via flatMap das legs** (instrument_type vem da leg, não da ordem):
   ```ts
   const existingOrders: OrderIn[] = hedgeOrdersDaOperacao.flatMap(ho =>
     ((ho.executed_legs ?? ho.legs) as any[]).map(leg => ({
       operation_id: ho.operation_id,
       instrument_type: leg.leg_type,
       direction: leg.direction,
       currency: leg.currency ?? 'USD',
       contracts: leg.contracts ?? 0,
       volume_units: leg.volume_units ?? 0,
       executed_at: ho.executed_at ?? new Date().toISOString(),
       executed_by: ho.executed_by ?? '',
       is_closing: false,
       ticker: leg.ticker,
       price: leg.price,
       ndf_rate: leg.ndf_rate,
     }))
   );
   ```
4. Monta `OperationSummaryIn[]` com `operation_id, display_code, volume_sacks, existing_orders, mtm_total_brl` (do snapshot mais recente em `useMtmSnapshots`).
5. `allocateClosingBatch({ warehouse_id, commodity, exchange, target_volume_sacks, strategy, operations })`.
6. Renderiza tabela `proposals` (display_code, volume_to_close, allocation_reason, mtm_at_allocation) e blocos amarelos para `warnings`.

**Botão "Confirmar Encerramento"** (Fase 4): toast "Funcionalidade de persistência será implementada na Fase 5" + fecha modal. Sem persistência.

## Aba MTM
Resultados: `results` state (após cálculo) ou `snapshotResults` derivados de `useMtmSnapshots` (latest por `operation_id`).

Disclaimer amarelo fixo no topo.

Colunas (default ON): `operacao, commodity, praca, trade_date, sale_date, mtm_total, mtm_per_sack, breakeven, fisico_alvo`.

Tabela inputs abaixo: linha por `useHedgeOrders({ status: 'EXECUTED' })`, preço físico R$/sc com `sessionStorage['mtm_physical_prices']` (mesma chave do OperationsMTM).

**"Calcular MTM"**: copiar `handleCalculate` de `OperationsMTM.tsx` literal — `BUSHELS_PER_SACK`, `sigmaMap`, prêmio de opção via `callApi('/pricing/option-premium', ...)`, `callApi('/mtm/run', { positions })`, persistência via `useSaveMtmSnapshot`.

**Fórmulas D20 (autorizadas)**:
```ts
calcBreakeven       = (physical - mtm_per_sack) * (1 + executionSpread)
calcTargetPhysical  = (physical - mtm_per_sack + targetProfit) * (1 + executionSpread)
```
Fallback: `physicalPrices` vazio → usa `r.market_snapshot.physical_price_current`.
`executionSpread` e `targetProfit` (por commodity) de `usePricingParameters`.

**Dialog detalhe MTM**: copiar 7 seções colapsáveis (`identificacao, datas, mercado, entrada, custos, basis, resultado`), incluindo conversão USD/bu→BRL/sc via `/utils/convert-price` (state `convertedLegPrices`).

## Aba Resumo
3 cards (Operações Ativas, Resultado Total, Resultado por Saca, com cor por sinal). Tabela por perna (Físico/Futuros/NDF/Opção/Total) com colunas (default ON): `perna, valor, pct`. Gráfico recharts `BarChart` com `Switch` Por perna ↔ Por operação.

## `src/App.tsx`
```tsx
import OperacoesD24 from "./pages/OperacoesD24";
// dentro do bloco protegido, ao lado de /operacoes-mtm:
<Route path="/operacoes-d24" element={<OperacoesD24 />} />
```

## Restrições
- Sem importar `OperationsMTM.tsx` ou `Orders.tsx` (replicar código).
- Sem nova Edge Function. `callApi` para `/mtm/run`, `/pricing/option-premium`, `/utils/convert-price`.
- Sem cálculo local exceto break-even e físico alvo (D20).
- `sessionStorage` apenas para `mtm_physical_prices`. ColumnSelector → `localStorage`.
- Casts `as any` / `as never` permitidos onde tipos do Supabase não cobrem colunas D24.

## Riscos
1. `useHedgeOrders` consulta `hedge_orders` (paridade com OrdensD24/OperationsMTM); fora do escopo trocar para `orders`.
2. Modal de encerramento Fase 4 não persiste — esperado pelo escopo.
3. Triggers existentes preenchem `display_code` e `updated_at` da operação automaticamente.

Após aprovação, gero o arquivo completo `OperacoesD24.tsx` e o diff de `App.tsx`.
