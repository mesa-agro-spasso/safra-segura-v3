

# MTM Enhancement — Upsert, Filters, Layout Reorder

No database migration needed (constraint already exists).

## File Changes

### 1. `src/types/index.ts`
Add `snapshot_date: string;` to `MtmSnapshot` interface after `calculated_at` (line 123).

### 2. `src/hooks/useMtmSnapshots.ts`
- Replace `useMtmSnapshots` to order by `snapshot_date desc, calculated_at desc`
- Replace `useSaveMtmSnapshot` to use `.upsert()` with `onConflict: 'operation_id,snapshot_date'`, injecting today's date as `snapshot_date`
- Update `Omit` to exclude `'id' | 'calculated_at' | 'snapshot_date'`

### 3. `src/pages/MTM.tsx`
- Add imports: `useMemo`, `Select` components, `Filter` icon
- Add filter state: `filterWarehouse`, `filterCommodity`, `filtersExpanded`
- Add derived data via `useMemo`: `lastMtmCalculated`, `lastMarketUpdate`, `uniqueWarehouses`, `uniqueDates`, `filteredResults`
- Reorder return block: header with status indicators and calculate button, collapsible filters section, **results table first**, active operations table second, detail dialog unchanged
- Use `filteredResults` instead of `results` in results table
- Show commodity as "Soja"/"Milho" in results table
- Remove `console.log('DEBUG order'...)` line (line 58)

