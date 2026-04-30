## Fix: snapshotResults e chartDataByOperation sem dependência de `orders` legado

### Arquivo
- `src/pages/OperacoesD24.tsx` (único arquivo alterado)

### Mudança 1 — `snapshotResults` (linhas ~808-832)

Remover o guard `!orders?.length` e a dependência `orders` do `useMemo`. A montagem dos snapshots já depende exclusivamente de `mtmSnapshots`; o restante do corpo permanece idêntico.

- Antes: `if (!mtmSnapshots?.length || !orders?.length) return null;` + deps `[mtmSnapshots, orders]`
- Depois: `if (!mtmSnapshots?.length) return null;` + deps `[mtmSnapshots]`

### Mudança 2 — `chartDataByOperation` (linhas ~896-910)

Trocar o lookup em `orders` por lookup em `operations` (D24), para obter o `display_name` do armazém diretamente da operação:

- Antes: `const matched = orders?.find(o => o.operation_id === r.operation_id); const label = matched?.operation?.warehouses?.display_name ?? ...;` + deps `[displayResults, orders]`
- Depois: `const matched = (operations ?? []).find(op => op.id === (r.operation_id as string)); const label = matched?.warehouses?.display_name ?? ...;` + deps `[displayResults, operations]`

### Notas
- `getTargetProfit` (linha 848) ainda usa `orders` — fora do escopo desta correção, não tocar.
- Sem novos hooks, sem novas queries.

Aguardando aprovação.