import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PricingCombination, Warehouse } from '@/types';
import { effectiveValue, type CockpitOverrides, type OverridesMap } from '@/lib/cockpitPayload';

const COMMODITY_LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };
const PERIOD_LABELS: Record<string, string> = {
  monthly: 'ao mês', mensal: 'ao mês', yearly: 'ao ano', anual: 'ao ano',
};

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

export type PendingMap = Record<string, Partial<Record<keyof CockpitOverrides, true>>>;

interface CellProps {
  combo: PricingCombination;
  field: keyof CockpitOverrides;
  /** Valor herdado do armazém, usado quando a combinação não tem valor próprio. */
  inherited: number | string | null | undefined;
  overrides: CockpitOverrides | undefined;
  pending: boolean;
  disabled?: boolean;
  onChange: (comboId: string, field: keyof CockpitOverrides, value: number | string | null) => void;
}

/** Classe da marca: âmbar enquanto não recalculado, primária depois de aplicado. */
function markClass(edited: boolean, pending: boolean) {
  if (!edited) return '';
  if (pending) return 'border-2 border-amber-500 bg-amber-500/15 text-foreground';
  return 'border-2 border-primary';
}

function NumberCell({ combo, field, inherited, overrides, pending, disabled, onChange }: CellProps) {
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const own = effectiveValue(combo, overrides, field);
  const shown = own ?? inherited ?? null;
  const [text, setText] = useState<string>(toText(shown));

  return (
    <Input
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        onChange(combo.id, field, parseDecimal(e.target.value));
      }}
      inputMode="decimal"
      className={cn('h-7 w-24 text-xs tabular-nums', markClass(edited, pending))}
      placeholder="—"
    />
  );
}

function StorageTypeCell({ combo, inherited, overrides, pending, onChange }: Omit<CellProps, 'field'>) {
  const field: keyof CockpitOverrides = 'storage_cost_type';
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const own = effectiveValue(combo, overrides, field) as string | null | undefined;
  const value = (own ?? (inherited as string | null) ?? '') || '';

  return (
    <Select value={value} onValueChange={(v) => onChange(combo.id, field, v)}>
      <SelectTrigger className={cn('h-7 w-28 text-xs', markClass(edited, pending))}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">Mensal</SelectItem>
        <SelectItem value="fixed">Fixo</SelectItem>
      </SelectContent>
    </Select>
  );
}

export interface ParametersCardProps {
  combos: PricingCombination[];
  warehouseMap: Record<string, Warehouse>;
  overrides: OverridesMap;
  pendingMap: PendingMap;
  onChange: (comboId: string, field: keyof CockpitOverrides, value: number | string | null) => void;
}

export function ParametersCard({ combos, warehouseMap, overrides, pendingMap, onChange }: ParametersCardProps) {
  return (
    <div className="overflow-auto max-h-[480px]">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>Praça</TableHead>
            <TableHead>Commodity</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead>Juros</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Armazenagem</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Recepção</TableHead>
            <TableHead>Corretagem</TableHead>
            <TableHead>Mesa (%)</TableHead>
            <TableHead>Quebra</TableHead>
            <TableHead>Desc. adicional</TableHead>
            <TableHead>Basis alvo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combos.map((combo) => {
            const wh = warehouseMap[combo.warehouse_id];
            const ov = overrides[combo.id];
            const pf = pendingMap[combo.id] ?? {};
            const isLongBasis = (combo.pricing_method ?? 'LONG_BASIS') === 'LONG_BASIS';
            const inheritedBrokerage =
              combo.benchmark === 'cbot' ? wh?.brokerage_per_contract_cbot : wh?.brokerage_per_contract_b3;
            const periodRaw = wh?.interest_rate_period ?? null;

            const cell = (
              field: keyof CockpitOverrides,
              inherited: number | string | null | undefined,
              disabled?: boolean,
            ) => (
              <NumberCell
                key={field}
                combo={combo}
                field={field}
                inherited={inherited}
                overrides={ov}
                pending={!!pf[field]}
                disabled={disabled}
                onChange={onChange}
              />
            );

            return (
              <TableRow key={combo.id}>
                <TableCell className="text-xs font-medium whitespace-nowrap">
                  {wh?.display_name ?? combo.warehouse_id}
                </TableCell>
                <TableCell className="text-xs">{COMMODITY_LABELS[combo.commodity] ?? combo.commodity}</TableCell>
                <TableCell className="font-mono text-xs">{combo.ticker}</TableCell>
                <TableCell>{cell('interest_rate', wh?.interest_rate)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {periodRaw ? PERIOD_LABELS[periodRaw] ?? periodRaw : '—'}
                </TableCell>
                <TableCell>{cell('storage_cost', wh?.storage_cost)}</TableCell>
                <TableCell>
                  <StorageTypeCell
                    combo={combo}
                    inherited={wh?.storage_cost_type}
                    overrides={ov}
                    pending={!!pf.storage_cost_type}
                    onChange={onChange}
                  />
                </TableCell>
                <TableCell>{cell('reception_cost', wh?.reception_cost)}</TableCell>
                <TableCell>{cell('brokerage_per_contract', inheritedBrokerage)}</TableCell>
                <TableCell>{cell('desk_cost_pct', wh?.desk_cost_pct)}</TableCell>
                <TableCell>{cell('shrinkage_rate_monthly', wh?.shrinkage_rate_monthly)}</TableCell>
                <TableCell>{cell('additional_discount_brl', null, !isLongBasis)}</TableCell>
                <TableCell>{cell('target_basis', null, !isLongBasis)}</TableCell>
              </TableRow>
            );
          })}
          {combos.length === 0 && (
            <TableRow>
              <TableCell colSpan={13} className="text-center text-sm text-muted-foreground py-8">
                Nenhuma combinação ativa.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
