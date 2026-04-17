

# OperationsMTM Dialog: seções colapsáveis + custos/basis

## 1. `src/hooks/useOperations.ts`
Adicionar `outputs_json` ao select do `useOperationsWithDetails`:
```ts
.select('*, warehouses(display_name), pricing_snapshots(trade_date, payment_date, grain_reception_date, sale_date, ticker, origination_price_brl, futures_price_brl, exchange_rate, outputs_json)')
```
Atualizar também o tipo `OperationWithDetails` em `src/types/index.ts` para incluir `outputs_json: Record<string, unknown>` (mantém o restante).

## 2. `src/pages/OperationsMTM.tsx` — dialog `detailResult`

### Estado novo (no componente do dialog ou no pai que renderiza)
```ts
const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
  identificacao: true, datas: true, mercado: true, resultado: true,
  custos: false, basis: false,
});
const toggleSection = (key: string) => setExpandedSections(v => ({ ...v, [key]: !v[key] }));
```

### Helper local
Componente `CollapsibleSection({ sectionKey, label, children })` que renderiza `<Separator />` + botão chevron `▾/▸` e mostra `children` quando expandido.

### Refatoração do corpo do dialog
Envolver cada bloco existente em `<CollapsibleSection>`:
- **identificacao** — Operação, Commodity, Volume
- **datas** — Entrada, Pagamento, Recepção, Saída
- **mercado** — Futuros atual, Físico atual, Câmbio spot, Prêmio opção
- **resultado** — Físico, Futuros, NDF, Opção, Total, Por Saca, Break-even, Físico alvo, Exposição Total

### Novas seções (colapsadas por default)
Ler de `matchedOrder.operation.pricing_snapshots.outputs_json`:
```ts
const outputsJson = (matchedOrder?.operation?.pricing_snapshots?.outputs_json as Record<string, any>) ?? {};
const costs = outputsJson.costs ?? {};
const engineResult = outputsJson.engine_result ?? {};
```

- **custos** — Financeiro, Armazenagem, Corretagem, Custo de mesa, Total (todos R$/sc, 4 decimais)
- **basis** — Target basis, Purchased basis, Breakeven basis (todos R$/sc, 4 decimais)

Formatador: `(v) => typeof v === 'number' ? v.toFixed(4) : '—'` com prefixo `R$ `.

## Pré-condições
- `Separator` já importado (`@/components/ui/separator`)
- Dialog `detailResult` já existe e tem acesso a `matchedOrder`
- `useState` já importado

## Fora de escopo
- Lógica de cálculo MTM, queries, demais dialogs/colunas, estilos globais.

