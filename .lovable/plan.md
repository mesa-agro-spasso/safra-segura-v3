

# MTM Tabs + Summary Chart

Single file change: `src/pages/MTM.tsx`

## Changes

### 1. Add imports (line 1 area)
- `Tabs, TabsContent, TabsList, TabsTrigger` from `@/components/ui/tabs`
- `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell` from `recharts`
- `Switch` from `@/components/ui/switch`

### 2. Add derived data after existing `useMemo` blocks (after line 65)
- `summary` — aggregates totals for physical, futures, NDF, option, overall, volume, per-sack
- `chartByOperation` state (boolean toggle)
- `chartDataConsolidated` — array of 5 bars (Físico, Futuros, NDF, Opção, Total)
- `chartDataByOperation` — array per operation with all leg values

### 3. Restructure return block (lines 180–413)
- Keep header (title, status dots, calculate button) **outside** tabs
- Wrap remaining content in `<Tabs defaultValue="marcacao">`
- **Tab "Marcação"**: existing filters, results table, active operations table (unchanged content)
- **Tab "Resumo"**: summary cards (count, total, per-sack), breakdown table by leg with % column, bar chart with consolidated/per-operation toggle via Switch
- Detail dialog stays **outside** tabs (unchanged)

### Technical notes
- `recharts` is already in dependencies
- No other files changed

