
# Adicionar "NDF estimado" na seção Snapshot de Mercado

## Mudança em `src/pages/OperationsMTM.tsx`

### Diálogo `detailResult` — seção "mercado" (~linha 738)
Adicionar `<DetailRow />` após "Câmbio spot" e antes de "Prêmio opção":
```tsx
<DetailRow 
  label="NDF estimado" 
  value={(detailResult.ndf_estimated_rate as number) != null 
    ? `R$ ${(detailResult.ndf_estimated_rate as number).toFixed(4)}` 
    : '—'} 
/>
```

## Efeito
Exibe a taxa NDF estimada (4 casas decimais) no snapshot de mercado do MTM, entre o câmbio spot e o prêmio de opção.

## Fora de escopo
Demais seções, queries, ou lógica de cálculo.
