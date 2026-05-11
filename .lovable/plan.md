# Plano: melhorias no gráfico de histórico de preço físico

Arquivo único: `src/components/market/PhysicalPriceHistoryDialog.tsx`

## Mudanças

### 1. Seletor de período
Adicionar um grupo de botões (ToggleGroup) acima do gráfico com as opções:
- `1m` — últimos 30 dias
- `6m` — últimos 6 meses
- `1a` — último 1 ano
- `5a` — últimos 5 anos
- `tudo` — todos os dados (default)

Estado local `period` (default `'tudo'`). Filtra o `history` por `reference_date >= hoje - período` para gerar o `chartData`.
A tabela abaixo do gráfico continua mostrando todo o histórico (não é afetada pelo seletor) — mantém consistência com o comportamento atual de edição.

### 2. Eixo Y dinâmico
Calcular `min` e `max` dos preços do `chartData` filtrado:
```
const prices = chartData.map(d => d.price);
const min = Math.min(...prices);
const max = Math.max(...prices);
const yMin = min * 0.9;
const yMax = max * 1.1;
```
Passar `domain={[yMin, yMax]}` no `<YAxis>`. Formatar tick com 2 casas (`tickFormatter={(v) => v.toFixed(2)}`).

Edge case: se `chartData` estiver vazio após o filtro, exibir mensagem "Sem dados no período selecionado" no lugar do gráfico (tabela continua visível).

## Sem mudanças
- Hooks de dados, schema, tabela de edição, navegação — tudo intacto.
- Apenas UI de visualização do gráfico.
