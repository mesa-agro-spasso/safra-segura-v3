

# Add Operations page with details view

Five files changed, one new file created. All mechanical edits.

## Changes

### 1. `src/types/index.ts` — Add `OperationWithDetails` interface
Append new interface at end of file with warehouse and pricing snapshot joined fields.

### 2. `src/hooks/useOperations.ts` — Add `useOperationsWithDetails` hook
- Update import to include `OperationWithDetails`
- Add new hook that selects operations with joined `warehouses` and `pricing_snapshots` data

### 3. `src/pages/Operations.tsx` — New file
Full operations page with:
- Table listing all operations (praça, commodity, ticker, volume, price, dates, status)
- Status badges with color coding
- Click-to-open detail dialog showing identification, pricing, dates, and linked hedge orders

### 4. `src/components/AppSidebar.tsx` — Add sidebar entry
- Add `Layers` to lucide-react import
- Add `{ title: 'Operações', url: '/operacoes', icon: Layers }` between Ordens and MTM in items array

### 5. `src/App.tsx` — Add route
- Import `Operations` page
- Add `<Route path="/operacoes" element={<Operations />} />` after `/ordens`

