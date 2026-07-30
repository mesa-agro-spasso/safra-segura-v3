import type { DiscardedCombination } from '@/types';

/** Reformata ISO YYYY-MM-DD para DD/MM/AAAA. Apenas troca de string — sem cálculo de data. */
function formatISODate(value: string | null | undefined): string {
  if (!value) return '—';
  const parts = value.slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

const COMMODITY_LABELS: Record<string, string> = {
  soybean: 'Soja',
  corn: 'Milho',
};

/** Texto do motivo em português, com fallback para o detail da API em códigos novos. */
function reasonText(item: DiscardedCombination): string {
  switch (item.reason) {
    case 'PAYMENT_DATE_BEFORE_TRADE_DATE':
      return `Data de pagamento vencida (${formatISODate(item.payment_date)}). Corrija o cadastro da combinação.`;
    case 'PAYMENT_DATE_AFTER_SALE_DATE':
      return `Pagamento (${formatISODate(item.payment_date)}) posterior à venda (${formatISODate(item.sale_date)}).`;
    case 'FX_MATURITY_NOT_AFTER_TRADE_DATE':
      return 'Data de venda não é posterior à data de negociação.';
    case 'FX_RATE_NOT_POSITIVE':
      return 'Câmbio resultante inválido. Verifique os parâmetros de câmbio.';
    case 'FX_PARAMETERS_UNAVAILABLE':
      return 'Parâmetros de câmbio indisponíveis. Tente novamente.';
    default:
      return item.detail?.trim() || item.reason;
  }
}

interface DiscardedCombinationsListProps {
  items: DiscardedCombination[];
}

export function DiscardedCombinationsList({ items }: DiscardedCombinationsListProps) {
  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.index}
          className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1"
        >
          <p className="text-xs font-semibold text-yellow-500">
            {[
              item.display_name ?? 'Praça não identificada',
              item.commodity ? COMMODITY_LABELS[item.commodity] ?? item.commodity : null,
              item.ticker,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground">{reasonText(item)}</p>
        </li>
      ))}
    </ul>
  );
}
