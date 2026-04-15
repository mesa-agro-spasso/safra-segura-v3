

# Add "Data de Venda" column to Financial table

## Overview
Single file change in `src/pages/Financial.tsx`. Fetch `sale_date` from `pricing_snapshots` and display it as a new column.

## Changes

### 1. Interface — add `sale_date` to `PaymentRow` (line 35)
Add `sale_date?: string | null;` to the interface.

### 2. Query — add `pricing_snapshot_id` to operations select (line 76)
Change select to `'id, commodity, warehouse_id, volume_sacks, pricing_snapshot_id'`.

### 3. Query — batch fetch pricing_snapshots (after line 94, before the return map)
```ts
const snapIds = [...new Set((ops ?? []).map((o: any) => o.pricing_snapshot_id).filter(Boolean))];
const { data: snaps } = await supabase
  .from('pricing_snapshots')
  .select('id, sale_date')
  .in('id', snapIds.length ? snapIds : ['__none__']);
const snapsMap = Object.fromEntries((snaps ?? []).map((s: any) => [s.id, s]));
```

### 4. Query — add `sale_date` to mapped result (line 104)
Add: `sale_date: snapsMap[op?.pricing_snapshot_id]?.sale_date ?? null,`

### 5. Table header (line 197–198)
Add `<TableHead>Data de Venda</TableHead>` after "Data Prevista".

### 6. Table body (after the scheduled_date cell, line 211)
Add `<TableCell>{fmtDate(r.sale_date)}</TableCell>` after the Data Prevista cell.

### What does NOT change
No other files, no other logic, no other columns.

