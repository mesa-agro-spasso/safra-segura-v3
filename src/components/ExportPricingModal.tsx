import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import type { PricingSnapshot } from '@/types';

export interface ExportColumn {
  key: string;
  label: string;
  defaultOn: boolean;
  getValue: (snap: PricingSnapshot, warehouseMap: Record<string, string>) => string;
}

const ALL_COLUMNS: ExportColumn[] = [
  { key: 'warehouse', label: 'Praça', defaultOn: true, getValue: (s, wm) => wm[s.warehouse_id] ?? s.warehouse_id },
  { key: 'commodity', label: 'Commodity', defaultOn: true, getValue: (s) => s.commodity === 'soybean' ? 'Soja' : 'Milho' },
  { key: 'ticker', label: 'Ticker', defaultOn: true, getValue: (s) => s.ticker },
  { key: 'grain_reception_date', label: 'Recepção', defaultOn: true, getValue: (s) => fmtDate(s.grain_reception_date) },
  { key: 'payment_date', label: 'Pagamento', defaultOn: true, getValue: (s) => fmtDate(s.payment_date) },
  { key: 'sale_date', label: 'Venda', defaultOn: true, getValue: (s) => fmtDate(s.sale_date) },
  { key: 'target_basis_brl', label: 'Basis Alvo', defaultOn: true, getValue: (s) => `R$ ${s.target_basis_brl.toFixed(2)}` },
  { key: 'futures_price_brl', label: 'Futuros (BRL)', defaultOn: true, getValue: (s) => `R$ ${s.futures_price_brl.toFixed(2)}` },
  { key: 'exchange_rate', label: 'Câmbio', defaultOn: true, getValue: (s) => s.exchange_rate?.toFixed(4) ?? '-' },
  { key: 'origination_price_brl', label: 'Preço Originação', defaultOn: true, getValue: (s) => `R$ ${s.origination_price_brl.toFixed(2)}` },
  { key: 'additional_discount_brl', label: 'Desconto', defaultOn: false, getValue: (s) => `R$ ${s.additional_discount_brl.toFixed(2)}` },
  { key: 'trade_date', label: 'Trade Date', defaultOn: false, getValue: (s) => fmtDate(s.trade_date) },
  { key: 'benchmark', label: 'Benchmark', defaultOn: false, getValue: (s) => s.benchmark?.toUpperCase() ?? '-' },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PricingSnapshot[];
  warehouseMap: Record<string, string>;
}

export function ExportPricingModal({ open, onOpenChange, rows, warehouseMap }: Props) {
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key))
  );
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    const cols = ALL_COLUMNS.filter((c) => selectedCols.has(c.key));
    if (cols.length === 0) {
      toast.error('Selecione ao menos uma coluna');
      return;
    }
    setExporting(true);
    try {
      if (format === 'xlsx') {
        await exportXlsx(cols, rows, warehouseMap);
      } else {
        await exportPdf(cols, rows, warehouseMap);
      }
      toast.success('Exportação concluída');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na exportação');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Tabela de Preços</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'xlsx' | 'pdf')} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                <Label htmlFor="fmt-xlsx" className="text-sm cursor-pointer">Excel (.xlsx)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <Label htmlFor="fmt-pdf" className="text-sm cursor-pointer">PDF</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Colunas</Label>
              <div className="flex gap-2">
                <button className="text-xs text-primary hover:underline" onClick={() => setSelectedCols(new Set(ALL_COLUMNS.map((c) => c.key)))}>Todas</button>
                <button className="text-xs text-muted-foreground hover:underline" onClick={() => setSelectedCols(new Set())}>Nenhuma</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{rows.length} linhas serão exportadas</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Export helpers ----

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportXlsx(cols: ExportColumn[], rows: PricingSnapshot[], wm: Record<string, string>) {
  // Build CSV with BOM for Excel compat
  const sep = ';';
  const header = cols.map((c) => c.label).join(sep);
  const body = rows.map((r) => cols.map((c) => c.getValue(r, wm).replace(/;/g, ',')).join(sep));
  const csv = '\uFEFF' + [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  downloadBlob(blob, `tabela_precos_${dateStr}.csv`);
}

async function exportPdf(cols: ExportColumn[], rows: PricingSnapshot[], wm: Record<string, string>) {
  // Build a simple HTML table and print to PDF via browser
  const header = cols.map((c) => `<th style="border:1px solid #333;padding:4px 8px;background:#1a1a2e;color:#e0e0e0;font-size:11px;text-align:left">${c.label}</th>`).join('');
  const body = rows.map((r) => {
    const cells = cols.map((c) => `<td style="border:1px solid #333;padding:4px 8px;font-size:10px">${c.getValue(r, wm)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const html = `
    <html><head><title>Tabela de Preços</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
      h2 { margin-bottom: 4px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #f0f0f0 !important; color: #222 !important; }
      @media print { body { margin: 10px; } }
    </style></head><body>
    <h2>Safra Segura — Tabela de Preços</h2>
    <p class="meta">Gerado em ${dateStr}</p>
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Popup bloqueado. Permita popups para exportar PDF.');
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
}
