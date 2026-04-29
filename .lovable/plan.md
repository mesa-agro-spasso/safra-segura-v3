## Correções em `src/pages/OperacoesD24.tsx` (`NewOperationModal`)

Duas alterações pontuais, mesmo arquivo, mesmo componente.

---

### Correção 1 — `filteredSnapshots` (linhas 1092–1097)

Atualmente filtra apenas por `commodity` + `benchmark`. Vamos:
- adicionar filtro por `warehouse_id`;
- limitar ao(s) snapshot(s) de `created_at` mais recente.

**Antes:**
```typescript
const filteredSnapshots = useMemo(() => {
  if (!commodity) return [];
  return pricingSnapshots.filter(s =>
    s.commodity === commodity && s.benchmark.toLowerCase() === exchange.toLowerCase(),
  );
}, [pricingSnapshots, commodity, exchange]);
```

**Depois:**
```typescript
const filteredSnapshots = useMemo(() => {
  if (!commodity || !warehouseId) return [];
  const matching = pricingSnapshots.filter(s =>
    s.commodity === commodity &&
    s.benchmark.toLowerCase() === exchange.toLowerCase() &&
    s.warehouse_id === warehouseId,
  );
  if (!matching.length) return [];
  const latestDate = matching.reduce((latest, s) =>
    s.created_at > latest ? s.created_at : latest,
    matching[0].created_at,
  );
  return matching.filter(s => s.created_at === latestDate);
}, [pricingSnapshots, commodity, exchange, warehouseId]);
```

---

### Correção 2 — INSERT em `operations` dentro de `handleSave` (linhas 1168–1173)

O cast `(supabase as any).from('operations')` pode descartar o contexto autenticado em algumas versões do SDK, causando violação de RLS. Trocamos pela forma que preserva o client tipado/autenticado e melhoramos a mensagem de erro.

**Antes:**
```typescript
const { data, error } = await (supabase as any)
  .from('operations')
  .insert(payload as never)
  .select('id, display_code')
  .single();
if (error) throw error;
```

**Depois:**
```typescript
const { data, error } = await supabase
  .from('operations' as any)
  .insert(payload)
  .select('id, display_code')
  .single();
if (error) throw new Error(
  error.message ?? error.details ?? JSON.stringify(error)
);
```

---

### Restrições

- Nenhum outro arquivo tocado.
- Sem novos hooks, serviços ou Edge Functions.
- Sem mudanças de schema/RLS no banco.
