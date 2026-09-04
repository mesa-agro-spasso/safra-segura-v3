# Exibir método de precificação — somente leitura, cinco arquivos

Tarefa de exibição. Nenhum controle novo que altere `pricing_method`; nenhum cálculo; nenhuma mudança de query, payload ou backend.

## Verificações feitas no código atual (antes do plano)

- `PriceTableCard.tsx:125` tem `colSpan={10}` numa tabela de 10 colunas — é este colSpan que precisa virar 11 (a tarefa citava "PricingTable.tsx:125", mas o arquivo correto é o card do cockpit).
- `PricingTable.tsx` (rota '/') NÃO tem nenhum `colSpan`: o estado vazio é um `<p>` fora da tabela (linha 343). Nada a ajustar lá. A tabela tem 12 `<TableHead>` (349–360) e 12 `<TableCell>` por linha (379–441), literais em paralelo.
- `ParametersCard.tsx:300` já deriva `isLongBasis` (com fallback 'LONG_BASIS'); será reutilizado.
- `ParametersCard.tsx:467`: a seção "Inativas" JÁ tem coluna de método, com grafias divergentes ('Preço alvo'/'Long basis'). A tabela de linhas ATIVAS (20 colunas, `COLUMN_COUNT = 20`) não tem coluna de método.
- `ExportPricingModal.tsx`: `ALL_COLUMNS` em :17–35, `FORMATTED_DEFAULT_KEYS` em :51–58 confirmados.

## Parte 1 — módulo de rótulos (arquivo novo)

`src/lib/pricingMethodLabel.ts`:

```ts
export const PRICING_METHOD_LABELS: Record<string, string> = {
  LONG_BASIS: 'Long Basis',
  TARGET_PRICE: 'Target Price',
};
export function pricingMethodLabel(value: unknown): string {
  return typeof value === 'string' ? PRICING_METHOD_LABELS[value] ?? '-' : '-';
}
```

Todo rótulo de método nas superfícies novas sai daqui. Zero ternário inline de método nos arquivos tocados.

## Parte 2 — Cockpit

### `ParametersCard.tsx`
- Coluna nova "Método" na tabela de linhas ativas, logo após "Commodity" (coluna 3). Célula: texto `text-xs`, via `pricingMethodLabel(combo.pricing_method)`.
- `COLUMN_COUNT` 20 → 21 (usado pelos dois colSpan de grupo e do estado vazio).
- Linha 300 (`isLongBasis`) permanece — reutilizada, sem duplicar.
- Seção "Inativas" (linha 467): substituir o ternário `'Preço alvo'/'Long basis'` por `pricingMethodLabel(combo.pricing_method)`. A coluna já existe lá; só troca a fonte do rótulo.

### `PriceTableCard.tsx`
- Coluna nova "Método" após "Commodity", nas duas listas paralelas (head e célula).
- Célula: `pricingMethodLabel(combo.pricing_method)` — fonte é sempre `combo.pricing_method`, nunca calcResults nem snapshot. Vale com e sem recálculo (a célula é fixa da combinação, independe de `source`).
- `colSpan` do estado vazio: 10 → 11.
- Estilo: texto `text-xs` simples, mesmo padrão das células não-numéricas do card.

## Parte 3 — Tabela de Preços (`/`)

`PricingTable.tsx`:
- `<TableHead>` nova "Método" na posição 3 (após Commodity), dentro do bloco 349–360.
- `<TableCell>` nova na MESMA posição (após a célula de Commodity, ~linha 386), lendo pela precedência obrigatória:

```ts
const method = pricingMethodLabel(outputs?.pricing_method ?? inputs?.pricing_method)
```

onde `outputs = snap.outputs_json`, `inputs = snap.inputs_json` (já desestruturados no map). Sem método em nenhum dos dois JSONB → '-', render normal.
- Sem colSpan a ajustar (estado vazio é `<p>` fora da tabela) — verificado.

## Parte 4 — Exportação (`ExportPricingModal.tsx`)

- Nova entrada em `ALL_COLUMNS` (posição após 'commodity'): `{ key: 'pricing_method', label: 'Método', defaultOn: true, getValue: (s) => pricingMethodLabel((s.outputs_json as any)?.pricing_method ?? (s.inputs_json as any)?.pricing_method) }`.
- NÃO incluir em `FORMATTED_DEFAULT_KEYS` (PNG formatado só traz se marcado manualmente).
- NÃO tocar em `CSV_HEADER_OVERRIDES` nem `CSV_NUMERIC_KEYS`.

## Posição e estilo (escolha única, coerente nas 4 superfícies)

Coluna "Método" sempre imediatamente após "Commodity". Texto simples `text-xs` (PriceTableCard/ParametersCard) e texto padrão na página `/`; sem badge, sem cor — é governança interna, não destaque.

## Escopo negativo respeitado

Não tocar em: types, hooks de query, cockpitPayload, Settings, SimulationPanel, dre.ts, dreExport.ts, api-proxy, backend, schema, filtros/agrupamento/ordenação, células editáveis.

## Critérios de aceite

1. ParametersCard: toda linha ativa (e a seção Inativas) mostra o método.
2. PriceTableCard: toda linha mostra o método, com e sem recálculo.
3. Tabela da página '/' com coluna de método na mesma posição em head e corpo (12→13 cabeçalhos, 12→13 células).
4. colSpan real ajustado (PriceTableCard 10→11; ParametersCard via COLUMN_COUNT 21; PricingTable não tem colSpan — verificado).
5. Exportar: checkbox "Método" ligado por padrão, sai em CSV e PDF; PNG formatado só se marcado.
6. Snapshot sem pricing_method nos dois JSONB → '-'.
7. Rótulos somente de `pricingMethodLabel.ts`.
8. Nenhum controle de edição de método introduzido.
9. Diff em exatamente cinco arquivos.
