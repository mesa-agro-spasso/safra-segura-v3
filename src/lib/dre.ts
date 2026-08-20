/**
 * Leitura da resposta de /pricing/table em formato DRE (cascata).
 * ZERO cálculo: cada linha é um campo da resposta, exibido como veio.
 */

export type DreKind = 'base' | 'add' | 'cost' | 'subtotal' | 'adjust' | 'total';

export interface DreLine {
  key: string;
  label: string;
  /** Valor bruto do campo da resposta (nunca derivado). */
  value: number;
  kind: DreKind;
  hint?: string;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const COST_LINES: { key: string; label: string }[] = [
  { key: 'storage_brl', label: 'Armazenagem' },
  { key: 'shrinkage_brl', label: 'Quebra técnica' },
  { key: 'reception_brl', label: 'Recepção' },
  { key: 'financial_brl', label: 'Custo financeiro' },
  { key: 'brokerage_brl', label: 'Corretagem' },
  { key: 'insurance_brl', label: 'Seguro' },
  { key: 'desk_cost_brl', label: 'Desk' },
];

export interface DreHeader {
  futuresUsd: number | null;
  exchangeRate: number | null;
  benchmark: string | null;
  ticker: string | null;
  commodity: string | null;
  warehouse: string | null;
  tradeDate: string | null;
  paymentDate: string | null;
  saleDate: string | null;
  receptionDate: string | null;
}

export function readDreHeader(outputs: Record<string, unknown> | null | undefined): DreHeader {
  const o = (outputs ?? {}) as Record<string, any>;
  return {
    futuresUsd: num(o.futures_price_usd),
    exchangeRate: num(o.exchange_rate),
    benchmark: typeof o.benchmark === 'string' ? o.benchmark : null,
    ticker: typeof o.ticker === 'string' ? o.ticker : null,
    commodity: typeof o.commodity === 'string' ? o.commodity : null,
    warehouse: typeof o.display_name === 'string' ? o.display_name : null,
    tradeDate: (o.trade_date_used ?? o.trade_date ?? null) as string | null,
    paymentDate: (o.payment_date ?? null) as string | null,
    saleDate: (o.sale_date ?? null) as string | null,
    receptionDate: (o.grain_reception_date ?? null) as string | null,
  };
}

/** Linhas da cascata, na ordem de exibição. Campo ausente = linha ausente. */
export function buildDreLines(outputs: Record<string, unknown> | null | undefined): DreLine[] {
  const o = (outputs ?? {}) as Record<string, any>;
  const costs = (o.costs ?? {}) as Record<string, any>;
  const lines: DreLine[] = [];

  const futures = num(o.futures_price_brl);
  if (futures != null) {
    lines.push({ key: 'futures', label: 'Futuros (R$/sc)', value: futures, kind: 'base' });
  }

  const basis = num(o.target_basis_brl);
  if (basis != null) {
    lines.push({ key: 'basis', label: 'Basis alvo', value: basis, kind: 'add' });
  }

  const gross = num(o.gross_price_brl);
  if (gross != null) {
    lines.push({ key: 'gross', label: 'Preço bruto', value: gross, kind: 'subtotal' });
  }

  for (const c of COST_LINES) {
    const v = num(costs[c.key]);
    if (v != null) lines.push({ key: c.key, label: c.label, value: v, kind: 'cost' });
  }

  const discount = num(o.additional_discount_brl);
  if (discount != null) {
    lines.push({ key: 'discount', label: 'Desconto adicional', value: discount, kind: 'cost' });
  }

  const beforeFloor = num(o.price_before_floor_brl);
  if (beforeFloor != null) {
    lines.push({
      key: 'before_floor',
      label: 'Preço antes do arredondamento',
      value: beforeFloor,
      kind: 'subtotal',
    });
  }

  const floorAdj = num(o.floor_adjustment_brl);
  if (floorAdj != null) {
    const inc = num(o.rounding_increment_used);
    lines.push({
      key: 'floor_adjustment',
      label: 'Ajuste de arredondamento',
      value: floorAdj,
      kind: 'adjust',
      hint: inc != null ? `incremento ${formatBrl(inc)}` : undefined,
    });
  }

  const final = num(o.origination_price_brl);
  if (final != null) {
    lines.push({ key: 'final', label: 'Preço final', value: final, kind: 'total' });
  }

  return lines;
}

export function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Sinal exibido ao lado da linha — apresentação, não operação. */
export function dreSign(kind: DreKind, value: number): string {
  if (kind === 'cost') return '−';
  if (kind === 'add') return '+';
  if (kind === 'adjust') return value < 0 ? '−' : '+';
  return '';
}

export function dreAbs(value: number): number {
  return value < 0 ? -value : value;
}

export const commodityLabelPt = (c: string | null | undefined) =>
  c === 'soybean' ? 'Soja' : c === 'corn' ? 'Milho' : c ?? '-';

export const formatDateBrDre = (d: string | null | undefined) => {
  if (!d) return '-';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};
