import {
  buildDreLines,
  readDreHeader,
  formatBrl,
  dreSign,
  dreAbs,
  commodityLabelPt,
  formatDateBrDre,
} from '@/lib/dre';

interface DreViewProps {
  /** Resposta da API (ou outputs_json de um snapshot). */
  outputs: Record<string, unknown> | null | undefined;
  warehouseName?: string | null;
}

/** Cascata DRE. Todo número vem de um campo da resposta — nada é calculado aqui. */
export function DreView({ outputs, warehouseName }: DreViewProps) {
  const lines = buildDreLines(outputs);
  const head = readDreHeader(outputs);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem resultado para exibir.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Praça: <span className="text-foreground">{warehouseName ?? head.warehouse ?? '—'}</span></span>
        <span>Commodity: <span className="text-foreground">{commodityLabelPt(head.commodity)}</span></span>
        <span>Ticker: <span className="text-foreground font-mono">{head.ticker ?? '-'}</span></span>
        <span>Negócio: <span className="text-foreground">{formatDateBrDre(head.tradeDate)}</span></span>
        <span>Recepção: <span className="text-foreground">{formatDateBrDre(head.receptionDate)}</span></span>
        <span>Pagamento: <span className="text-foreground">{formatDateBrDre(head.paymentDate)}</span></span>
        <span>Venda: <span className="text-foreground">{formatDateBrDre(head.saleDate)}</span></span>
        {head.futuresUsd != null && (
          <span>Futuros (US$): <span className="text-foreground tabular-nums">{head.futuresUsd.toFixed(4)}</span></span>
        )}
        {head.exchangeRate != null && (
          <span>Câmbio: <span className="text-foreground tabular-nums">{head.exchangeRate.toFixed(4)}</span></span>
        )}
      </div>

      <div className="rounded border border-border divide-y divide-border">
        {lines.map((l) => {
          const isTotal = l.kind === 'total';
          const isSubtotal = l.kind === 'subtotal';
          return (
            <div
              key={l.key}
              className={`flex items-center justify-between gap-4 px-3 py-2 text-sm ${
                isTotal
                  ? 'bg-primary/10 font-semibold'
                  : isSubtotal
                    ? 'bg-muted/50 font-medium'
                    : ''
              }`}
            >
              <span className={l.kind === 'cost' ? 'pl-4 text-muted-foreground' : ''}>
                {l.label}
                {l.hint && <span className="ml-2 text-xs text-muted-foreground">({l.hint})</span>}
              </span>
              <span className={`tabular-nums ${isTotal ? 'text-primary' : ''}`}>
                {dreSign(l.kind, l.value)} R$ {formatBrl(dreAbs(l.value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
