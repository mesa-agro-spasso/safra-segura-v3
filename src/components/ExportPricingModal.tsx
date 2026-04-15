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
  const [format, setFormat] = useState<'xlsx' | 'pdf' | 'mobile'>('xlsx');
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
      } else if (format === 'pdf') {
        await exportPdf(cols, rows, warehouseMap);
      } else if (format === 'mobile') {
        await exportMobilePng(cols, rows, warehouseMap);
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
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'xlsx' | 'pdf' | 'mobile')} className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                <Label htmlFor="fmt-xlsx" className="text-sm cursor-pointer">Excel (.xlsx)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <Label htmlFor="fmt-pdf" className="text-sm cursor-pointer">PDF</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mobile" id="fmt-mobile" />
                <Label htmlFor="fmt-mobile" className="text-sm cursor-pointer">Celular (PNG)</Label>
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
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function getDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

async function exportXlsx(cols: ExportColumn[], rows: PricingSnapshot[], wm: Record<string, string>) {
  const sep = ';';
  const header = cols.map((c) => c.label).join(sep);
  const body = rows.map((r) => cols.map((c) => c.getValue(r, wm).replace(/;/g, ',')).join(sep));
  const csv = '\uFEFF' + [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `tabela_precos_${getDateStr()}.csv`);
}

async function exportPdf(cols: ExportColumn[], rows: PricingSnapshot[], wm: Record<string, string>) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const grouped: Record<string, PricingSnapshot[]> = {};
  for (const r of rows) {
    const key = r.commodity;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const commodityMeta: Record<string, { label: string; icon: string; color: string }> = {
    soybean: { label: 'SOJA', icon: '🌾', color: '#5a7a3a' },
    corn: { label: 'MILHO', icon: '🌽', color: '#b8860b' },
  };

  let sections = '';
  for (const [commodity, cRows] of Object.entries(grouped)) {
    const meta = commodityMeta[commodity] ?? { label: commodity.toUpperCase(), icon: '📦', color: '#555' };
    const tickers = [...new Set(cRows.map((r) => r.ticker))].join(' · ');
    const fxInfo = commodity === 'soybean' && cRows[0]?.exchange_rate
      ? ` · USD ${cRows[0].exchange_rate.toFixed(4)}`
      : '';

    const headerRow = cols.map((c) => `<th>${c.label}</th>`).join('');
    const bodyRows = cRows.map((r, i) => {
      const cells = cols.map((c) => `<td>${c.getValue(r, wm)}</td>`).join('');
      return `<tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">${cells}</tr>`;
    }).join('');

    sections += `
      <div class="section">
        <div class="section-header">
          <span class="section-title"><span class="icon">${meta.icon}</span> <span style="color:${meta.color};font-weight:700;letter-spacing:0.5px">${meta.label}</span></span>
          <span class="section-subtitle">${tickers}${fxInfo}</span>
        </div>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Tabela de Preços</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #333; background: #fff; padding: 40px 36px;
  }
  .brand {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 28px; padding-bottom: 14px; border-bottom: 2px solid #e5e7eb;
  }
  .brand h1 { font-size: 26px; font-weight: 700; color: #111; letter-spacing: -0.3px; }
  .brand .meta { font-size: 14px; color: #999; }
  .section { background: #fafafa; border-radius: 10px; padding: 0; margin-bottom: 24px; overflow: hidden; border: 1px solid #e5e7eb; }
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 22px; background: #fff; border-bottom: 1px solid #eee;
  }
  .section-title { font-size: 20px; display: flex; align-items: center; gap: 8px; }
  .icon { font-size: 24px; }
  .section-subtitle { font-size: 15px; color: #888; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f5f5f5; }
  th {
    padding: 12px 18px; font-size: 14px; font-weight: 600; color: #888;
    text-align: left; text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 1px solid #e5e7eb;
  }
  td {
    padding: 14px 18px; font-size: 16px; color: #333; font-weight: 500;
    border-bottom: 1px solid #f0f0f0;
  }
  .row-even { background: #fff; }
  .row-odd { background: #fafafa; }
  tr:last-child td { border-bottom: none; }
  @media print {
    body { padding: 20px; }
    .section { break-inside: avoid; }
  }
</style></head><body>
  <div class="brand">
    <h1>Safra Segura — Tabela de Preços</h1>
    <span class="meta">Gerado em ${dateStr}</span>
  </div>
  ${sections}
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Popup bloqueado. Permita popups para exportar PDF.');
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

async function exportMobilePng(cols: ExportColumn[], rows: PricingSnapshot[], wm: Record<string, string>) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const grouped: Record<string, PricingSnapshot[]> = {};
  for (const r of rows) {
    if (!grouped[r.commodity]) grouped[r.commodity] = [];
    grouped[r.commodity].push(r);
  }

  const commodityMeta: Record<string, { label: string; icon: string; bg: string; color: string }> = {
    soybean: { label: 'SOJA', icon: '🌾', bg: '#e8f5e9', color: '#2e7d32' },
    corn: { label: 'MILHO', icon: '🌽', bg: '#fff8e1', color: '#f57f17' },
  };

  let cards = '';
  for (const [commodity, cRows] of Object.entries(grouped)) {
    const meta = commodityMeta[commodity] ?? { label: commodity.toUpperCase(), icon: '📦', bg: '#f5f5f5', color: '#555' };
    const tickers = [...new Set(cRows.map((r) => r.ticker))].join(' · ');

    cards += `<div style="margin-bottom:32px;">
      <div style="background:${meta.bg};padding:20px 28px;border-radius:16px 16px 0 0;display:flex;align-items:center;gap:12px;">
        <span style="font-size:32px;">${meta.icon}</span>
        <span style="font-size:28px;font-weight:800;color:${meta.color};letter-spacing:0.5px;">${meta.label}</span>
        <span style="font-size:18px;color:#888;margin-left:auto;">${tickers}</span>
      </div>`;

    for (const row of cRows) {
      const fields = cols.map((c) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:18px;color:#888;font-weight:500;">${c.label}</span>
          <span style="font-size:22px;color:#222;font-weight:700;">${c.getValue(row, wm)}</span>
        </div>`
      ).join('');

      cards += `<div style="background:#fff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:2px;">
        ${fields}
      </div>`;
    }

    cards += `</div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff;
    padding: 40px 32px;
  }
  .header {
    text-align: center;
    margin-bottom: 36px;
    padding-bottom: 20px;
    border-bottom: 3px solid #e5e7eb;
  }
  .header h1 {
    font-size: 36px;
    font-weight: 800;
    color: #111;
    margin-bottom: 8px;
  }
  .header .meta {
    font-size: 18px;
    color: #999;
  }
</style></head><body>
  <div class="header">
    <h1>Safra Segura — Tabela de Preços</h1>
    <div class="meta">Gerado em ${dateStr}</div>
  </div>
  ${cards}
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1px;border:none;';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise((r) => setTimeout(r, 300));

    const bodyEl = iframeDoc.body;
    iframe.style.height = `${bodyEl.scrollHeight}px`;
    await new Promise((r) => setTimeout(r, 100));

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(bodyEl, {
      width: 1080,
      scale: 1,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `tabela_precos_mobile_${getDateStr()}.png`);
          resolve();
        } else {
          reject(new Error('Falha ao gerar PNG'));
        }
      }, 'image/png');
    });
  } finally {
    document.body.removeChild(iframe);
  }
}
