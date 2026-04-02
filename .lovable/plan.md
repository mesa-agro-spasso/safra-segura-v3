

# Plano revisado — Gerar Tabela com resolução de basis

Nenhuma alteração estrutural ao plano anterior. Apenas confirmação dos dois pontos e detalhamento da função de resolução de basis.

## Ponto 1 — Confirmado

Mapeamento de commodity para chave do `basis_config`:
- Ticker com `commodity = SOJA` → acessa `basis_config.soybean`
- Ticker com `commodity = MILHO_CBOT` → acessa `basis_config.corn`

## Ponto 2 — Função de resolução recursiva de basis

A função `resolveBasis` recebe o warehouse, a chave da commodity (`soybean` | `corn`), e um mapa de todos os warehouses. Resolve recursivamente até encontrar um `fixed`, com limite de profundidade para evitar loops infinitos.

```text
resolveBasis(warehouseId, commodityKey, warehouseMap, depth=0)
  if depth > 5 → throw "Ciclo detectado"
  config = warehouseMap[warehouseId].basis_config[commodityKey]
  if !config → return null (warehouse sem basis para essa commodity)
  if config.mode === "fixed" → return config.value
  if config.mode === "reference_delta"
    refBasis = resolveBasis(config.reference_warehouse_id, commodityKey, warehouseMap, depth+1)
    if refBasis === null → return null
    return refBasis + config.delta_brl
```

Com os dados reais:
- Alta Floresta soja: resolve matupa (fixed -30) + delta -1 = **-31**
- Alta Floresta milho: resolve matupa (fixed -25) + delta -1.5 = **-26.5**
- Sede Madcap: basis_config vazio → **excluída** das combinations (sem basis = sem pricing)

## Arquivos

Mesmo plano anterior — dois arquivos:
- **`src/components/GeneratePricingModal.tsx`** — novo. Contém a função `resolveBasis`, o modal com DatePickers e seleção de tickers, e a lógica de montagem do payload completo.
- **`src/pages/PricingTable.tsx`** — atualizado. Remove `handleGenerate` inline, substitui pelo modal.

## Regras mantidas

- Zero cálculo financeiro no frontend — `resolveBasis` é apenas lookup/soma de configuração, não pricing
- Warehouses sem `basis_config` para a commodity são silenciosamente ignorados
- `exchange_rate` vem do registro USD/BRL em market_data
- Commodity enviada à API: `soybean` / `corn` (não `SOJA` / `MILHO_CBOT`)

