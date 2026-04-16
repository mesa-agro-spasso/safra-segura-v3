

# OperationsMTM — Reorder Tabs, Merge MTM, Load Snapshots, Tabbed Op Dialog

Single file: `src/pages/OperationsMTM.tsx`

## Changes

### 1. Reorder tabs (line 272-278)
- Change `defaultValue` to `"operacoes"`
- Replace TabsList with 3 tabs: Operações, MTM, Resumo (remove Resultado)

### 2. Add `snapshotResults` and `displayResults` (after line 141, before `handleCalculate`)
- `snapshotResults` useMemo: loads latest mtmSnapshot per operation_id as result objects
- `const displayResults = results ?? snapshotResults;`

### 3. Update `filteredResults` (lines 89-97)
- Use `displayResults` instead of `results`

### 4. Update `summary` (lines 99-109)
- Use `displayResults` instead of `results`

### 5. Update `chartDataByOperation` (lines 122-136)
- Use `displayResults` instead of `results`

### 6. Replace tabs "marcacao" (lines 280-342) and "resultado" (lines 344-444) with single "mtm" tab
- Results section first (with inline filters), then active operations + calculate button below
- Uses `filteredResults` and `displayResults`

### 7. Replace Operations detail dialog (lines 679-735)
- Tabbed dialog with `max-w-2xl`, scrollable
- Tab "detalhes": existing content (identification, pricing, dates, linked orders)
- Tab "mtm_op": MTM snapshot for that operation (market snapshot + result breakdown)
- Looks up `opMtmSnapshot` from `mtmSnapshots`

