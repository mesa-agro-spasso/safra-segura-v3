## Objetivo

Deixar os dois fluxos de encerramento (simples e block trade) com a **mesma linguagem visual** (cards por leg), incluir **físico como leg em ambos**, e restaurar os **pré-preenchimentos** que foram perdidos.

## Diagnóstico do estado atual

**Encerramento simples** (`RegisterClosingModal` em `OperacoesD24.tsx`, ~3423-3642):
- Layout bonito com card por leg (futures/ndf/option). É a referência visual.
- ✗ **Não tem leg de físico** — só registra encerramento dos derivativos. O físico fica órfão (nem `physical_sales` nem `operations.physical_sale_price_brl_per_sack` são populados).
- ✗ **Preço dos derivativos não vem pré-preenchido** — campo "Preço real" sempre vazio, mesmo com `market_data` disponível e `getSuggestedExecutionPrices` já implementado para o block trade.

**Block trade** (`BlockTradeExecutionModal` em `ArmazensD24.tsx`, ~1911-2610):
- Step 1 usa tabela densa com inputs minúsculos (feio, conforme screenshot).
- Físico aparece como linhas de tabela, não como card consistente com o simples.
- ✗ Pré-preenchimento do **preço físico** só usa `batch.physical_sale_price_estimated_brl_per_sack`. Se o batch não tem estimativa, cai para `''` (campo zerado, conforme screenshot 0,00). Não cai no `latestPhysicalPrices` da praça/commodity, que está disponível no escopo.

## Plano de execução

### 1. Refatorar `RegisterClosingModal` (encerramento simples)

**Adicionar leg de físico** como mais um card (mesmo estilo dos demais):
- Sempre presente quando a operação tem volume aberto.
- Campos: Volume físico (sc) — pré-preenchido com `closingPlan.volume_sacks` ou volume aberto da operação; Preço físico (R$/sc) — pré-preenchido com último `physical_prices` da praça+commodity (via `useLatestPhysicalPrices`); Obs.
- Badge de cabeçalho do card: `físico` · `venda` · `BRL` (visualmente alinhado aos demais).
- Mostrar "Preço orig.: R$ X,XX/sc" e margem estimada como hint abaixo dos inputs (read-only).
- No submit: chamar a mesma RPC `execute_block_trade_physical` (ou criar variante single-op se a RPC não aceitar 1 operação — a inspecionar; se aceitar lista de 1, reaproveitar) para gravar atomicamente `physical_sales` + `operations.physical_sale_price_brl_per_sack`. **Sem cálculos novos no frontend.**

**Pré-preencher preços dos derivativos**:
- Importar `useMarketData` + `getSuggestedExecutionPrices` (já existe em `lib/blockTradeExecution.ts`).
- Aplicar a mesma lógica do block trade: para cada leg, se `market_data` tem o ticker, popular `price` (futures) ou `ndf_rate` (ndf) com a sugestão. Mostrar "Sugerido: X (TICKER)" abaixo do input.

**Validação**: bloquear botão "Confirmar" se o preço físico ≤ 0 (mesma regra do block trade).

### 2. Refatorar `BlockTradeExecutionModal` Step 1 (visual)

Trocar a estrutura atual (tabela densa de físico + lista compacta de instrumentos) por um **layout de cards igual ao simples**:

```text
┌─ Plano de Encerramento ────────────────────┐  (header, igual ao simples)
│ Volume · MTM Total · MTM/sc                │
└────────────────────────────────────────────┘

┌─ futures · sell (fechamento) · USD · ZSQ26 ┐
│ Contratos (read-only, total)               │
│ Preço (USD/bushel)  [pré: market_data]     │
│ Sugerido: 1062 (ZSQ26)                     │
└────────────────────────────────────────────┘

┌─ ndf · sell (fechamento) · BRL ────────────┐
│ Contratos (read-only)                      │
│ Taxa NDF (BRL/USD) [pré: market_data]      │
└────────────────────────────────────────────┘

┌─ físico · venda · BRL ─────────────────────┐
│ Tabela compacta por operação:              │
│   código · vol · orig · [preço físico]     │
│ Preço físico pré-preenchido por op com:    │
│   1º: batch.physical_sale_price_estimated  │
│   2º: latestPhysicalPrices(praça,commod)   │
│   3º: orig (fallback)                      │
└────────────────────────────────────────────┘

[Resultado estimado]   [Cancelar] [Revisar →]
```

Notas:
- O preço por instrumento continua **único para o batch** (decisão já validada). Mostrado como card único, não tabela.
- O físico fica como **um único card** com tabela interna por operação (preço físico é por-op, não por-batch).
- Mantém Step 2 (revisão) como está — ele já está bem estruturado.

**Restaurar pré-preenchimento do físico** com fallback em cascata:
```ts
const fallback = batch.physical_sale_price_estimated 
  ?? latestPhysicalPrices.find(praça+commodity)?.price 
  ?? op.origination_price_brl;
```
Mostrar microcopy: "Pré-preenchido com último preço físico da praça (DD/MM)" ou "estimativa do batch" para transparência.

### 3. Garantias

- Zero novo cálculo financeiro no frontend (regra core). Toda P&L continua via `previewRows` existente.
- Fluxos de gravação no banco intactos: simples → `orders` insert + (novo) `execute_block_trade_physical` com 1 op; block → mantém RPC + update batch.
- Atomicidade do físico mantida (RPC).
- Sem migração de schema. Apenas frontend.

### Arquivos afetados

- `src/pages/OperacoesD24.tsx` — refator do `RegisterClosingModal`: novo card físico + pré-preenchimento de preços de derivativos.
- `src/pages/ArmazensD24.tsx` — refator do Step 1 do `BlockTradeExecutionModal`: cards no lugar da tabela; cascade de fallback do preço físico.

### Detalhes técnicos

- Hook a importar em `OperacoesD24.tsx`: `useLatestPhysicalPrices` (já existe), `useMarketData` (já existe), `getSuggestedExecutionPrices` (já existe).
- A RPC `execute_block_trade_physical` recebe `p_sales: [{operation_id, volume_sacks, price_brl_per_sack, current_volume_sacks}]` — funciona com lista de 1.
- Volume físico no simples = `closingPlan.volume_sacks` (já existe no contexto da operação que abriu o modal).

### Fora de escopo

- Mudanças no Step 2 (revisão) do block trade.
- Mudanças nas RPCs ou no schema.
- Mudanças no fluxo de criação de operação ou de batch.
