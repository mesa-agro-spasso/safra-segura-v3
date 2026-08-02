import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PricingCombination, Warehouse } from '@/types';
import { effectiveValue, type CockpitOverrides } from '@/lib/cockpitPayload';

const COMMODITY_LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };
const PERIOD_LABELS: Record<string, string> = { monthly: 'ao mês', mensal: 'ao mês', yearly: 'ao ano', anual: 'ao ano' };

/** Converte texto digitado (vírgula ou ponto) em número. Sem aritmética financeira. */
function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

interface FieldProps {
  label: string;
  field: keyof CockpitOverrides;
  combo: PricingCombination;
  overrides: CockpitOverrides | undefined;
  origin: Record<string, string>;
  onChange: (field: keyof CockpitOverrides, value: number | string | null) => void;
}

function NumberField({ label, field, combo, overrides, origin, onChange }: FieldProps) {
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const value = effectiveValue(combo, overrides, field);
  const [text, setText] = useState<string>(toText(value));
  const inherited = !edited && origin[field] && origin[field] !== 'combination';

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
        {label}
        {inherited && <span className="text-[10px] text-muted-foreground/60">herdado</span>}
        {edited && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="editado" />}
      </Label>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(field, parseDecimal(e.target.value));
        }}
        inputMode="decimal"
        className={cn('h-8 text-sm', edited && 'border-primary ring-1 ring-primary/30')}
        placeholder="—"
      />
    </div>
  );
}

function StorageTypeField({ combo, overrides, origin, onChange }: Omit<FieldProps, 'label' | 'field'>) {
  const field: keyof CockpitOverrides = 'storage_cost_type';
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const value = (effectiveValue(combo, overrides, field) as string | null) ?? '';
  const inherited = !edited && origin[field] && origin[field] !== 'combination';

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
        Tipo de armazenagem
        {inherited && <span className="text-[10px] text-muted-foreground/60">herdado</span>}
        {edited && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="editado" />}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(field, v)}>
        <SelectTrigger className={cn('h-8 text-sm', edited && 'border-primary ring-1 ring-primary/30')}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Mensal</SelectItem>
          <SelectItem value="fixed">Fixo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export interface CockpitRowProps {
  combo: PricingCombination;
  warehouse: Warehouse | undefined;
  /** Preço a exibir (último lote ou resultado do recálculo). null = sem preço. */
  price: number | null;
  /** true quando o preço veio do último lote e ainda não houve recálculo nesta sessão. */
  priceStale: boolean;
  /** Motivo do descarte/pulo, quando houver. */
  issue: string | null;
  origin: Record<string, string>;
  overrides: CockpitOverrides | undefined;
  onChange: (comboId: string, field: keyof CockpitOverrides, value: number | string | null) => void;
}

export function CockpitRow({ combo, warehouse, price, priceStale, issue, origin, overrides, onChange }: CockpitRowProps) {
  const [open, setOpen] = useState(false);
  const dirty = !!overrides && Object.keys(overrides).length > 0;
  const handleChange = (field: keyof CockpitOverrides, value: number | string | null) =>
    onChange(combo.id, field, value);

  const periodRaw = warehouse?.interest_rate_period ?? null;
  const periodLabel = periodRaw ? PERIOD_LABELS[periodRaw] ?? periodRaw : '—';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('rounded border border-border', dirty && 'border-primary/50')}>
        <CollapsibleTrigger className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/40">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium truncate flex-1">
            {warehouse?.display_name ?? combo.warehouse_id}
          </span>
          <span className="text-xs text-muted-foreground w-16">
            {COMMODITY_LABELS[combo.commodity] ?? combo.commodity}
          </span>
          <span className="text-xs font-mono text-muted-foreground w-20">{combo.ticker}</span>
          <span className="w-44 text-right">
            {issue ? (
              <span className="text-xs text-yellow-500">{issue}</span>
            ) : price != null ? (
              <span className={cn('text-sm font-semibold', priceStale && dirty && 'opacity-40')}>
                R$ {price.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">sem preço no lote vigente</span>
            )}
          </span>
          {dirty && priceStale && (
            <Badge variant="outline" className="text-[10px] border-primary/60 text-primary">
              não recalculado
            </Badge>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border px-3 py-3 space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Custos</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberField label="Juros" field="interest_rate" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Período dos juros</Label>
                  <div className="h-8 flex items-center px-3 rounded border border-border bg-muted/30 text-sm text-muted-foreground">
                    {periodLabel} <span className="ml-1 text-[10px] text-muted-foreground/60">(armazém)</span>
                  </div>
                </div>
                <NumberField label="Armazenagem" field="storage_cost" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <StorageTypeField combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <NumberField label="Recepção" field="reception_cost" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <NumberField label="Corretagem" field="brokerage_per_contract" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <NumberField label="Mesa (%)" field="desk_cost_pct" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                <NumberField label="Quebra (mensal)" field="shrinkage_rate_monthly" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Preço</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {combo.pricing_method === 'LONG_BASIS' ? (
                  <>
                    <NumberField label="Basis alvo" field="target_basis" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                    <NumberField label="Desconto adicional" field="additional_discount_brl" combo={combo} overrides={overrides} origin={origin} onChange={handleChange} />
                  </>
                ) : (
                  <div className="col-span-2 text-xs text-muted-foreground">
                    Método Target Price: preço líquido alvo e desconto adicional não são ajustáveis aqui.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
