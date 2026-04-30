## Plano — 3 fixes em `src/pages/ArmazensD24.tsx`

Apenas um arquivo afetado. Sem novos imports externos além de UI primitives já existentes no projeto (Select, Popover, Checkbox) e ícone `Columns` do lucide-react.

### Imports adicionados (topo)
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select`
- `Popover, PopoverContent, PopoverTrigger` de `@/components/ui/popover`
- `Checkbox` de `@/components/ui/checkbox`
- Adicionar `Columns` ao import de `lucide-react`

### Fix 1 — Formatação defensiva da taxa de juros (`ConfigCard` › `costRow`)
Linha ~579: substituir o template literal único por uma IIFE que detecta se `interest_rate` está em decimal (`<= 1`) ou já em percentual (`> 1`) e formata com `.toFixed(2)%` mais o sufixo `(period)` quando houver.

### Fix 2 — Filtros na aba Posição
No componente principal (perto dos demais `useState`):
- `const [filterWarehouse, setFilterWarehouse] = useState<string>('all');`
- `const [filterCommodity, setFilterCommodity] = useState<string>('all');`

Após o `useMemo` de `rows`:
- `const filteredRows = useMemo(() => rows.filter(...), [rows, filterWarehouse, filterCommodity]);`
  - exclui se `filterWarehouse !== 'all'` e id diferente
  - exclui se `filterCommodity !== 'all'` e `r.commodities` não inclui o valor

Substituir todos os usos de `rows` na renderização da aba Posição (cards de resumo agregados, `rows.map`, `rows.length === 0`, `rows.filter(r => r.ops.length > 0).length`, somatórios `volumeTotal`/`mtmTotal`, etc.) por `filteredRows`. O `selectedRow` continua usando `rows` (sheet de detalhe não é filtrado).

Adicionar bloco de filtros logo no início do `<TabsContent value="posicao">`, antes do grid de cards de resumo:
```tsx
<div className="flex gap-3 flex-wrap">
  <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>...</Select>
  <Select value={filterCommodity} onValueChange={setFilterCommodity}>...</Select>
</div>
```
Opções de praça vêm de `warehouses`. Commodities fixas: Soja / Milho.

### Fix 3 — ColumnSelector na tabela "Posição por armazém"
Copiar localmente, no escopo do módulo (antes do componente principal), o mesmo padrão de `OperacoesD24.tsx` (linhas 444–502):
- `interface Col { key: string; label: string }`
- `function usePersistedColumns(storageKey, columns, defaultKeys?)` — persiste `Set<string>` em `localStorage`
- `const ColumnSelector` — Popover + Checkbox por coluna + botões "Todas" / "Nenhuma"

Definir constante:
```ts
const ARMAZEM_COLUMNS: Col[] = [
  { key: 'commodity', label: 'Commodity' },
  { key: 'op_ativas', label: 'Op. ativas' },
  { key: 'volume', label: 'Volume (sc)' },
  { key: 'mtm_total', label: 'MTM Total' },
  { key: 'breakeven', label: 'Break-even' },
  { key: 'mtm_sc', label: 'MTM/sc' },
  { key: 'fisico_alvo', label: 'Físico Alvo' },
  { key: 'prox_venc', label: 'Próx. venc.' },
  { key: 'status_mix', label: 'Status mix' },
];
```

No componente principal:
```ts
const armazemCols = usePersistedColumns('cols_armazens', ARMAZEM_COLUMNS);
```

No `<CardHeader>` do card "Posição por armazém" (linha ~283), envolver o `<CardTitle>` num flex e adicionar `<ColumnSelector ... />` à direita.

Coluna **Armazém** permanece sempre visível (fora do selector). Cada `<TableHead>` e `<TableCell>` correspondente às chaves acima passa a ser condicionalmente renderizada com `{armazemCols.visible.has('key') && (...)}`.

Atualizar `colSpan` da linha vazia (atualmente `colSpan={10}`, linha ~357) para `colSpan={1 + armazemCols.visible.size}`.

### Restrições mantidas
- Apenas `src/pages/ArmazensD24.tsx`
- `usePersistedColumns` e `ColumnSelector` definidos localmente (cópia do padrão de `OperacoesD24.tsx`), não importados
- Aba Configuração não tem mudança estrutural — apenas a IIFE em `costRow` para `interest_rate`
- Sheet de detalhe não é tocado
