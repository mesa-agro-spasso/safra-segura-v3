

# Unified Operations/MTM Page

Create `src/pages/OperationsMTM.tsx` merging both pages, update routing and sidebar. Three files modified, one created.

## Changes

### 1. Create `src/pages/OperationsMTM.tsx`
- Combine all imports, hooks, state, and useMemo from both `MTM.tsx` and `Operations.tsx`
- Two hook calls for hedge orders: one filtered `{ status: 'EXECUTED' }` (for MTM), one unfiltered (for operations dialog)
- Add `selectedOperation` state (for operations detail dialog) and `ordersForSelectedOperation` memo
- Copy `STATUS_BADGE` constant and `fmtDate` helper from Operations.tsx
- Header: title "Operações / MTM", status dots, **no calculate button**
- `<Tabs defaultValue="marcacao">` with 4 tabs:
  - **marcacao**: active operations table with physical price inputs + Calcular MTM button (moved here)
  - **resultado**: collapsible filters + results table (click opens MTM detail dialog)
  - **operacoes**: full operations table from Operations.tsx (click opens operations detail dialog)
  - **resumo**: summary cards, breakdown table, chart with toggle
- Two dialogs outside tabs: MTM detail dialog + Operations detail dialog

### 2. `src/App.tsx`
- Add `import OperationsMTM from './pages/OperationsMTM'`
- Add route `<Route path="/operacoes-mtm" element={<OperationsMTM />} />` after `/ordens`
- Keep existing `/operacoes` and `/mtm` routes

### 3. `src/components/AppSidebar.tsx`
- Replace items array: remove separate Operações and MTM entries, add single `{ title: 'Operações / MTM', url: '/operacoes-mtm', icon: TrendingUp }`
- Remove `Layers` from lucide-react import

