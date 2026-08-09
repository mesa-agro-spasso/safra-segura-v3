import { useMemo, useState } from 'react';
import { ChevronRight, Shield, PowerOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DateInput } from '@/components/ui/date-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PricingCombination, Warehouse } from '@/types';
import { effectiveValue, type CockpitOverrides, type OverridesMap } from '@/lib/cockpitPayload';
import { StickyTableScroll, STICKY_HEAD } from '@/components/cockpit/StickyTableScroll';


const COMMODITY_LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };
const PERIOD_LABELS: Record<string, string> = {
  monthly: 'ao mês', mensal: 'ao mês', yearly: 'ao ano', anual: 'ao ano',
};

/** Colunas congeladas à esquerda (praça e commodity). */
const STICKY_PRACA = 'sticky left-0 z-20 bg-card w-40 min-w-[10rem]';
const STICKY_COMMODITY = 'sticky left-40 z-20 bg-card w-24 min-w-[6rem] shadow-[inset_-1px_0_0_hsl(var(--border))]';

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
  onChange: (comboId: string, field: keyof CockpitOverrides, value: number | string | boolean | null) => void;
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

/** Célula de data. Sem validação no frontend: a API decide e descarta com motivo. */
function DateCell({
  combo,
  field,
  overrides,
  pending,
  disabled,
  fallback,
  onChange,
}: Omit<CellProps, 'inherited'> & { fallback?: string | null }) {
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const own = effectiveValue(combo, overrides, field) as string | null | undefined;
  const shown = own ?? fallback ?? '';

  return (
    <DateInput
      value={shown}
      disabled={disabled}
      onChange={(v) => onChange(combo.id, field, v === '' ? null : v)}
      className={cn('h-7 w-[8.5rem] text-xs', markClass(edited, pending))}
    />
  );
}

function SwitchCell({
  combo,
  field,
  overrides,
  pending,
  onChange,
}: Omit<CellProps, 'inherited'>) {
  const edited = !!overrides && Object.prototype.hasOwnProperty.call(overrides, field);
  const checked = !!(effectiveValue(combo, overrides, field) ?? false);

  return (
    <div className={cn('inline-flex items-center rounded px-1 py-0.5', markClass(edited, pending))}>
      <Switch checked={checked} onCheckedChange={(v) => onChange(combo.id, field, v)} />
    </div>
  );
}

export interface ParametersCardProps {
  combos: PricingCombination[];
  warehouseMap: Record<string, Warehouse>;
  overrides: OverridesMap;
  pendingMap: PendingMap;
  onChange: (comboId: string, field: keyof CockpitOverrides, value: number | string | boolean | null) => void;
  /** Abre o modal de seguro da combinação. Grava direto no cadastro. */
  onEditInsurance?: (combo: PricingCombination) => void;
  /** Combinações inativas — escondidas por padrão, reativáveis em um clique. */
  inactive?: PricingCombination[];
  /** Escreve a coluna `active` de pricing_combinations. */
  onToggleActive?: (id: string, active: boolean) => void;
}

const COLUMN_COUNT = 19;


export function ParametersCard({ combos, warehouseMap, overrides, pendingMap, onChange, onEditInsurance, inactive = [], onToggleActive }: ParametersCardProps) {
  /** Todos os grupos nascem fechados: o cockpit é para ajuste pontual. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** Filtro de exibição por commodity. Não altera payload nem cálculo. */
  const [commodity, setCommodity] = useState<string>('all');
  /** Lista de inativas: fechada por padrão para não poluir a visão do dia. */
  const [showInactive, setShowInactive] = useState(false);

  const commodities = useMemo(
    () => Array.from(new Set(combos.map((c) => c.commodity))).sort(),
    [combos],
  );

  const visibleCombos = useMemo(
    () => (commodity === 'all' ? combos : combos.filter((c) => c.commodity === commodity)),
    [combos, commodity],
  );

  const groups = useMemo(() => {
    const map = new Map<string, PricingCombination[]>();
    visibleCombos.forEach((c) => {
      const list = map.get(c.warehouse_id) ?? [];
      list.push(c);
      map.set(c.warehouse_id, list);
    });
    return Array.from(map.entries())
      .map(([warehouseId, rows]) => ({
        warehouseId,
        name: warehouseMap[warehouseId]?.display_name ?? warehouseId,
        rows,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleCombos, warehouseMap]);

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const HEAD = cn(STICKY_HEAD, 'border-b border-border');

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <button
          type="button"
          onClick={() => setCommodity('all')}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs',
            commodity === 'all' ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground',
          )}
        >
          Todas
        </button>
        {commodities.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCommodity(c)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs',
              commodity === c ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground',
            )}
          >
            {COMMODITY_LABELS[c] ?? c}
          </button>
        ))}
      </div>
      <StickyTableScroll maxHeightClass="max-h-[560px]">
        <Table
          unstyledWrapper
          className="border-separate border-spacing-0 [&_tbody_td]:border-b [&_tbody_td]:border-border"
        >
        <TableHeader>
          <TableRow>
            <TableHead className={cn(STICKY_PRACA, HEAD, 'z-40')}>Praça</TableHead>
            <TableHead className={cn(STICKY_COMMODITY, HEAD, 'left-40 z-40')}>Commodity</TableHead>
            <TableHead className={HEAD}>Ticker</TableHead>
            <TableHead className={HEAD}>Juros</TableHead>
            <TableHead className={HEAD}>Período</TableHead>
            <TableHead className={HEAD}>Armazenagem</TableHead>
            <TableHead className={HEAD}>Tipo</TableHead>
            <TableHead className={HEAD}>Recepção</TableHead>
            <TableHead className={HEAD}>Corretagem</TableHead>
            <TableHead className={HEAD}>Mesa (%)</TableHead>
            <TableHead className={HEAD}>Quebra</TableHead>
            <TableHead className={HEAD}>Desc. adicional</TableHead>
            <TableHead className={HEAD}>Basis alvo</TableHead>
            <TableHead className={HEAD}>À vista</TableHead>
            <TableHead className={HEAD}>Pagamento</TableHead>
            <TableHead className={HEAD}>Recepção do grão</TableHead>
            <TableHead className={HEAD}>Venda</TableHead>
            <TableHead className={HEAD}>Seguro</TableHead>
            <TableHead className={HEAD}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const isOpen = !!open[group.warehouseId];
            const hasPending = group.rows.some(
              (r) => Object.keys(pendingMap[r.id] ?? {}).length > 0,
            );

            return [
              <TableRow key={`h-${group.warehouseId}`} className="bg-muted/40 hover:bg-muted/60">
                <TableCell colSpan={COLUMN_COUNT} className="p-0">
                  <button
                    type="button"
                    onClick={() => toggle(group.warehouseId)}
                    aria-expanded={isOpen}
                    className="flex w-full text-left"
                  >
                    <span className="sticky left-0 z-20 flex w-fit items-center gap-2 px-4 py-2 text-xs font-medium">
                      <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
                      <span>{group.name}</span>
                      <span className="text-muted-foreground">
                        {group.rows.length} {group.rows.length === 1 ? 'combinação' : 'combinações'}
                      </span>
                      {hasPending && (
                        <span className="rounded border border-amber-500 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">
                          edições não recalculadas
                        </span>
                      )}
                    </span>
                  </button>
                </TableCell>
              </TableRow>,
              ...(isOpen
                ? group.rows.map((combo) => {
                    const wh = warehouseMap[combo.warehouse_id];
                    const ov = overrides[combo.id];
                    const pf = pendingMap[combo.id] ?? {};
                    const isLongBasis = (combo.pricing_method ?? 'LONG_BASIS') === 'LONG_BASIS';
                    const inheritedBrokerage =
                      combo.benchmark === 'cbot' ? wh?.brokerage_per_contract_cbot : wh?.brokerage_per_contract_b3;
                    const periodRaw = wh?.interest_rate_period ?? null;
                    const isSpot = !!(effectiveValue(combo, ov, 'is_spot') ?? false);
                    const paymentDate = (effectiveValue(combo, ov, 'payment_date') as string | null) ?? null;

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
                        <TableCell className={cn(STICKY_PRACA, 'text-xs font-medium whitespace-nowrap')}>
                          {wh?.display_name ?? combo.warehouse_id}
                        </TableCell>
                        <TableCell className={cn(STICKY_COMMODITY, 'text-xs')}>
                          {COMMODITY_LABELS[combo.commodity] ?? combo.commodity}
                        </TableCell>
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
                        <TableCell>
                          <SpotCell combo={combo} overrides={ov} pending={!!pf.is_spot} onChange={onChange} />
                        </TableCell>
                        <TableCell>
                          <DateCell
                            combo={combo}
                            field="payment_date"
                            overrides={ov}
                            pending={!!pf.payment_date}
                            disabled={isSpot}
                            onChange={onChange}
                          />
                        </TableCell>
                        <TableCell>
                          <DateCell
                            combo={combo}
                            field="grain_reception_date"
                            overrides={ov}
                            pending={!!pf.grain_reception_date}
                            disabled={!!combo.grain_already_delivered}
                            fallback={combo.grain_already_delivered ? null : isSpot ? null : paymentDate}
                            onChange={onChange}
                          />
                        </TableCell>
                        <TableCell>
                          <DateCell
                            combo={combo}
                            field="sale_date"
                            overrides={ov}
                            pending={!!pf.sale_date}
                            onChange={onChange}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-7 gap-1 whitespace-nowrap text-xs',
                              combo.insurance_option_id && 'border-primary text-primary',
                            )}
                            onClick={() => onEditInsurance?.(combo)}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            {combo.insurance_option_id
                              ? `${((combo.insurance_coverage_pct ?? 0) * 100).toFixed(0)}%`
                              : 'Configurar'}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 whitespace-nowrap text-xs text-muted-foreground"
                            onClick={() => onToggleActive?.(combo.id, false)}
                            title="Desativar combinação"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                            Desativar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                : []),
            ];
          })}
          {visibleCombos.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-center text-sm text-muted-foreground py-8">
                Nenhuma combinação ativa.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        </Table>
      </StickyTableScroll>

      {inactive.length > 0 && (
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            aria-expanded={showInactive}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', showInactive && 'rotate-90')} />
            Inativas ({inactive.length})
          </button>
          {showInactive && (
            <div className="max-h-64 overflow-auto border-t border-border">
              <Table unstyledWrapper>
                <TableBody>
                  {inactive.map((combo) => (
                    <TableRow key={combo.id}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {warehouseMap[combo.warehouse_id]?.display_name ?? combo.warehouse_id}
                      </TableCell>
                      <TableCell className="text-xs">
                        {COMMODITY_LABELS[combo.commodity] ?? combo.commodity}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{combo.ticker}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {combo.pricing_method === 'TARGET_PRICE' ? 'Preço alvo' : 'Long basis'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onToggleActive?.(combo.id, true)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reativar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
