## Plan: Fix CSV export in ExportPricingModal

File: `src/components/ExportPricingModal.tsx`

### Goal
Fix the CSV export (the "xlsx" option) so it outputs a properly-formatted Brazilian CSV with raw numbers, correct headers, and proper null handling — without changing calculations, other export formats (PDF, mobile), or any other file.

### Changes in `ExportPricingModal.tsx`

1. **Header labels (CSV only):**
   - `target_basis_brl` → "Basis Alvo (R$)"
   - `futures_price_brl` → "Futuros (R$)" (currently "Futuros (BRL)")
   - `origination_price_brl` → "Preço Originação (R$)"
   - `insurance_adjusted_price_brl` → "Preço c/ Seguro (R$)"
   - `exchange_rate` → "Câmbio" (no change)
   - All other headers unchanged.

2. **Value cell formatting (CSV only, in `exportXlsx`):**
   - Strip the `R$ ` prefix from all currency values.
   - Convert decimal separator from `.` to `,` for all numeric values (currency columns and exchange rate).
   - Replace `-` (null indicator) with empty string.
   - Keep text/dates as-is (dates already in `DD/MM/YYYY` format).
   - Keep the `;` → `,` replacement inside values to avoid delimiter collisions.

3. **What stays the same:**
   - `getValue` functions in `ALL_COLUMNS` are **not** changed — PDF and mobile exports keep their current formatted text.
   - `exportPdf` and `exportMobilePng` are untouched.
   - No logic or calculation changes.

### Verification
Export a CSV, open in a spreadsheet, and confirm:
- Currency columns have headers ending in `(R$)`.
- Cells contain only numbers (e.g., `141,84`), no `R$ ` prefix.
- Semicolon (`;`) is the field delimiter.
- Empty cells for rows without insurance (no `-`).