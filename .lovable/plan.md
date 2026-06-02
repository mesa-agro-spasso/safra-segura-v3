# Camada de Seguro — Tabela de Preços

Funcionalidade EXTERNA: não toca no clique do preço (continua usando `origination_price_brl`) nem em `GeneratePricingModal`/Edge Function. Todo cálculo de preço ajustado e custo de seguro vem do endpoint `POST /pricing/insurance-layer`. Frontend só converte cobertura % → decimal.

## 1. `src/hooks/useInsuranceSnapshots.ts` (novo)

- `useInsuranceSnapshots(snapshotIds: string[])`
  - React Query, key `['insurance-snapshots', ...ids.sort()]`.
  - `supabase.from('insurance_snapshots').select('*').in('pricing_snapshot_id', snapshotIds)`.
  - Retorna `Record<string, InsuranceSnapshotRow>` por `pricing_snapshot_id`.
  - `enabled: snapshotIds.length > 0`.

- `useApplyInsuranceLayer()`
  - Mutation: `supabase.from('insurance_snapshots').upsert(rows, { onConflict: 'pricing_snapshot_id' })`.
  - `onSuccess`: invalida `['insurance-snapshots']`.
  - `onError`: `toast.error(err.message)`.

## 2. `src/components/InsuranceLayerModal.tsx` (novo)

Props: `{ open, onOpenChange, rows }` — `rows` é o `allRows` completo (não filtrado).

Estado:
- `existing = useInsuranceSnapshots(rows.map(r => r.id))`.
- Globais: `globalPremiumSoja`, `globalPremiumMilho` (BRL/sc, opcionais), `globalCoverage` (default `'25'`).
- Por linha (`Map<id, {enabled, premiumStr, coverageStr}>`):
  - se `existing[r.id]` → `enabled / premium_brl / coverage_pct*100`;
  - senão → `enabled=true`, `premium = r.insurance_json?.atm?.premium_brl ?? ''`, `coverage = globalCoverage`.

UI:
- Inputs globais: "Preço seguro Soja", "Preço seguro Milho", "Cobertura %". Mudar global = set em massa (prêmio aplica só na commodity correspondente; cobertura aplica em todas).
- `Collapsible` "Ajustar por linha": cada linha mostra praça / ticker / commodity + `Switch` enabled + input prêmio + input cobertura %.

Botão "Aplicar":
1. `items = rows.map(r => ({ pricing_snapshot_id: r.id, base_price_brl: r.origination_price_brl, premium_brl: Number(premiumStr||0), coverage_pct: Number(coverageStr||0)/100, enabled }))`.
2. `const { results } = await callApi('/pricing/insurance-layer', { items })`.
3. Para cada `result`, **localizar a linha original por id** (não por índice) e só então montar o upsert:
   ```ts
   const upsertRows = results.map((result) => {
     const r = rows.find((row) => row.id === result.pricing_snapshot_id);
     if (!r) return null; // pular results sem linha correspondente
     return {
       pricing_snapshot_id: result.pricing_snapshot_id,
       enabled: result.enabled,
       premium_brl: result.premium_brl,
       coverage_pct: result.coverage_pct,
       insurance_cost_brl: result.insurance_cost_brl,
       adjusted_price_brl: result.adjusted_price_brl,
       premium_source:
         result.premium_brl === Number(r.insurance_json?.atm?.premium_brl)
           ? 'theoretical'
           : 'manual',
       created_by: user.id,
       created_at: new Date().toISOString(),
     };
   }).filter(Boolean);
   ```
4. `await applyMutation.mutateAsync(upsertRows)`; `toast.success`; `onOpenChange(false)`.

Imports: `callApi` de `@/lib/api`, `user` de `useAuth()`.

## 3. `src/pages/PricingTable.tsx` (editar)

- Novo botão "Aplicar Seguro" no header ao lado de "Gerar Tabela" → abre `InsuranceLayerModal` com `rows={allRows}`.
- `const insuranceMap = useInsuranceSnapshots(allRows.map(r => r.id))`.
- Nova coluna "Preço c/ Seguro" logo após "Preço Originação":
  - `enabled` → `R$ <adjusted_price_brl.toFixed(2)>` + badge pequeno `<coverage_pct*100>%`;
  - existe mas `!enabled` → `—`;
  - ausente → `—`.
- Modal de detalhe: nova seção "Seguro aplicado" quando `insuranceMap[detailSnap.id]` existe — Status, Prêmio usado, Cobertura, Custo seguro, Preço ajustado, Fonte (`theoretical`→Teórico, `manual`→Manual). DISTINTA da seção "Seguro" atual (níveis teóricos ATM/OTM).

## NÃO fazer
- Não alterar criação de operação / clique no preço de originação.
- Não calcular `adjusted_price_brl` ou `insurance_cost_brl` no frontend.
- Não tocar na Edge Function nem no `GeneratePricingModal`.

## Arquivos
- criar `src/hooks/useInsuranceSnapshots.ts`
- criar `src/components/InsuranceLayerModal.tsx`
- editar `src/pages/PricingTable.tsx`
