## Correções no fluxo de fechamento de armazém

Três ajustes coordenados em `src/pages/ArmazensD24.tsx` e no componente `HedgePlanEditor` de `src/pages/OperacoesD24.tsx`. Referências de linha são aproximadas — usar a descrição funcional para localizar caso o código tenha mudado.

---

### Correção 1 — HedgePlanEditor inline no Sheet de detalhe do batch

**Onde:** `ArmazensD24.tsx`, Sheet "Detalhe do batch" (o segundo Sheet, controlado por `btSelectedBatch`), abaixo da tabela "Operações afetadas".

**O que fazer:**
- Exportar (ou extrair para `src/components/HedgePlanEditor.tsx`) o componente `HedgePlanEditor` hoje definido localmente em `OperacoesD24.tsx`, para reuso.
- Buscar as operações referenciadas em `btSelectedBatch.allocation_snapshot` via query (`operations` + `pricing_snapshots(*)` + `warehouses(display_name)`), com queryKey `['batch-operations', batchId]`.
- Para cada operação, renderizar um Card colapsável (Accordion) com `display_code` no header e dentro:
  - Se `operation.status === 'DRAFT'`: `<HedgePlanEditor>` totalmente editável.
  - Caso contrário: visualização read-only das pernas (lista) + nota "plano congelado após DRAFT".
- O save do editor já usa `UPDATE operations.hedge_plan` direto no Supabase (Correção 2 garante o handler funcional). O trigger `protect_hedge_plan_after_active` é a defesa server-side.
- Após salvar, invalidar `['operations-d24']`, `['closing-batches']` e `['batch-operations', batchId]`.

---

### Correção 2 — HedgePlanEditor: Volume USD da NDF + botão Salvar

**Onde:** componente `HedgePlanEditor` em `OperacoesD24.tsx`.

**Volume USD da NDF (inicialização):**
- Hoje o `useState` inicial mapeia `contracts: l.contracts` para todas as pernas. Para NDF, o backend grava o volume em `volume_units`, então o campo aparece zerado.
- Aplicar a mesma lógica do `RegisterExecutionModal`:
  ```ts
  contracts: l.instrument_type === 'ndf'
    ? (l.volume_units != null ? String(l.volume_units) : (l.contracts != null ? String(l.contracts) : ''))
    : (l.contracts != null ? String(l.contracts) : '')
  ```
- Em `buildLegPayload`, para NDF persistir o valor em `volume_units` (e em `contracts` para compatibilidade), preservando paridade com o RegisterExecutionModal.

**Botão Salvar:**
- O handler atual (`handleSavePlan`) exige `messages` populado para salvar — por isso parece "não funcionar". Remover essa dependência:
  - Sempre montar `plan: editLegs.map(buildLegPayload)`.
  - Se `messages` existir, incluir `order_message`/`confirmation_message`; caso contrário, preservar os existentes em `opD24.hedge_plan` (merge) ou omitir esses campos.
- Habilitar/exibir o botão **apenas** se `operation.status === 'DRAFT'`. Em outros status, esconder botão e marcar inputs read-only.
- Manter toast de sucesso e `onSaved()` para invalidar queries.

---

### Correção 3 — Mensagens de ordem no Sheet de detalhe do batch

**Onde:** mesmo Sheet do batch em `ArmazensD24.tsx`, abaixo da seção da Correção 1.

**O que fazer:**
- Nova seção "MENSAGEM DA ORDEM" agrupada por operação (header com `display_code`).
- Para cada operação do batch em status `DRAFT` ou `ACTIVE`, chamar `POST /operations/build-plan` via o helper `buildHedgePlan` em `src/services/d24Api.ts` (já usa `api-proxy`).
- Usar `useQueries` do React Query para paralelizar e cachear. QueryKey por operação: `['batch-build-plan', operationId, operation.updated_at]`.
- Renderizar dois blocos (`order_message` e `confirmation_message`) com `<pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-2 rounded-md">` + botão copiar (📋) — mesmo padrão visual já usado em `OperacoesD24.tsx`.
- Helper `copyToClipboard` reutilizado (extrair para `src/lib/utils.ts` se necessário).

---

### Regras observadas
- Zero cálculo financeiro no frontend (Volume USD apenas exibe valor já gravado; mensagens vêm da API).
- `orders` permanece imutável.
- `hedge_plan` editável apenas em DRAFT (validação client + trigger server `protect_hedge_plan_after_active`).
- `api-proxy` não é modificada (`/operations/build-plan` já está no whitelist).
- queryKeys existentes preservadas: `['operations-d24']`, `['closing-batches']`. Novas: `['batch-operations', batchId]`, `['batch-build-plan', opId, updatedAt]`.

### Arquivos afetados
- `src/pages/OperacoesD24.tsx` — exportar `HedgePlanEditor`, corrigir init NDF, corrigir Save, gating por status.
- `src/pages/ArmazensD24.tsx` — Sheet do batch: editor inline por operação + seção de mensagens.
- (opcional) `src/components/HedgePlanEditor.tsx` — extração para reuso limpo.
