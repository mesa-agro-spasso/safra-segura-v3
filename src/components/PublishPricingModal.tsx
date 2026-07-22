import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import type { PricingSnapshot } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { ALL_COLUMNS, type InsuranceMap } from '@/components/ExportPricingModal';

const DEFAULT_KEYS = new Set([
  'warehouse',
  'commodity',
  'grain_reception_date',
  'payment_date',
  'sale_date',
  'origination_price_brl',
]);

// Map internal column keys → public site keys. Site relies on `praca` and `commodity`
// to build its filters, so these mappings must remain stable.
const PUBLIC_KEY_MAP: Record<string, string> = {
  warehouse: 'praca',
  commodity: 'commodity',
  ticker: 'ticker',
  grain_reception_date: 'recepcao',
  payment_date: 'pagamento',
  sale_date: 'venda',
  target_basis_brl: 'basis_alvo',
  futures_price_brl: 'futuros_brl',
  exchange_rate: 'cambio',
  origination_price_brl: 'preco_originacao',
  insurance_adjusted_price_brl: 'preco_seguro',
  additional_discount_brl: 'desconto',
  trade_date: 'trade_date',
  benchmark: 'benchmark',
};

const PUBLIC_URL = 'https://spasso-public-table.pages.dev';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PricingSnapshot[];
  warehouseMap: Record<string, string>;
  insuranceMap?: InsuranceMap;
  activeCommodity?: string;
}

export function PublishPricingModal({ open, onOpenChange, rows, warehouseMap, insuranceMap }: Props) {
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter((c) => DEFAULT_KEYS.has(c.key)).map((c) => c.key)),
  );
  const [publishing, setPublishing] = useState(false);

  // Reset selection when the modal opens so users always see the sensible default.
  useEffect(() => {
    if (open) {
      setSelectedCols(new Set(ALL_COLUMNS.filter((c) => DEFAULT_KEYS.has(c.key)).map((c) => c.key)));
    }
  }, [open]);

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePublish = async () => {
    const cols = ALL_COLUMNS.filter((c) => selectedCols.has(c.key));
    if (cols.length === 0) {
      toast.error('Selecione ao menos uma coluna');
      return;
    }
    if (rows.length === 0) {
      toast.error('Nenhuma linha para publicar');
      return;
    }

    // Ensure `commodity` and `praca` always exist in rows (site uses them for filters),
    // even if the user unchecked them. They still appear in `columns` only if selected.
    const alwaysInclude: Array<{ srcKey: string; publicKey: string }> = [
      { srcKey: 'warehouse', publicKey: 'praca' },
      { srcKey: 'commodity', publicKey: 'commodity' },
    ];

    const columns = cols.map((c) => ({
      key: PUBLIC_KEY_MAP[c.key] ?? c.key,
      label: c.label,
    }));

    const payloadRows = rows.map((r) => {
      const obj: Record<string, string> = {};
      for (const c of cols) {
        const pk = PUBLIC_KEY_MAP[c.key] ?? c.key;
        obj[pk] = c.getValue(r, warehouseMap, insuranceMap);
      }
      for (const extra of alwaysInclude) {
        if (!(extra.publicKey in obj)) {
          const col = ALL_COLUMNS.find((c) => c.key === extra.srcKey);
          if (col) obj[extra.publicKey] = col.getValue(r, warehouseMap, insuranceMap);
        }
      }
      return obj;
    });

    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-pricing-table', {
        body: { columns, rows: payloadRows },
      });
      if (error) {
        // functions.invoke wraps non-2xx into FunctionsHttpError; try to surface upstream message.
        let msg = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.text === 'function') {
            const body = await ctx.text();
            const parsed = JSON.parse(body);
            if (parsed?.error) msg = parsed.error;
          }
        } catch { /* keep default msg */ }
        throw new Error(msg);
      }
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success('Tabela publicada com sucesso!', {
        description: PUBLIC_URL,
        action: {
          label: 'Abrir site',
          onClick: () => window.open(PUBLIC_URL, '_blank', 'noopener'),
        },
        duration: 8000,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar Tabela de Preços</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Publica no site público (sem login). Respeita o filtro de commodity ativo na tela.
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Colunas</Label>
              <div className="flex gap-2">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelectedCols(new Set(ALL_COLUMNS.map((c) => c.key)))}
                >
                  Todas
                </button>
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setSelectedCols(new Set())}
                >
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedCols.has(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'linha será publicada' : 'linhas serão publicadas'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancelar
          </Button>
          <Button onClick={handlePublish} disabled={publishing || rows.length === 0}>
            <Globe className="mr-2 h-4 w-4" />
            {publishing ? 'Publicando...' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
