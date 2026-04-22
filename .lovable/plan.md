

# Persistir `ndf_estimated_rate` no fluxo MTM

## 1. `src/types/index.ts`
Adicionar ao tipo `MtmSnapshot`:
```ts
ndf_estimated_rate?: number | null;
```

## 2. `src/pages/OperationsMTM.tsx` — `handleCalculate`
No payload do `saveMtm.mutateAsync`, adicionar:
```ts
ndf_estimated_rate: (r.ndf_estimated_rate as number) ?? null,
```

## 3. `src/pages/OperationsMTM.tsx` — `snapshotResults` useMemo
No objeto mapeado de cada `snap`, adicionar:
```ts
ndf_estimated_rate: snap.ndf_estimated_rate ?? null,
```

## 4. `src/pages/OperationsMTM.tsx` — dialog `detailResult`
Substituir a linha atual de "NDF estimado" por:
```tsx
<DetailRow
  label="NDF estimado"
  value={
    (detailResult.ndf_estimated_rate as number) != null
      ? `R$ ${(detailResult.ndf_estimated_rate as number).toFixed(4)}`
      : '—'
  }
/>
```

## Efeito
- Ao clicar "Calcular MTM", o valor é persistido em `mtm_snapshots.ndf_estimated_rate`.
- Ao recarregar a página, o valor é recuperado do banco e exibido no dialog.
- Snapshots antigos exibem "—" até serem recalculados.

## Pré-condições
- Coluna `ndf_estimated_rate numeric` já existe em `mtm_snapshots` (confirmado).
- `DetailRow` e `detailResult` já existem no componente.

## Fora de escopo
Qualquer outra lógica, query, campo ou seção do dialog.

