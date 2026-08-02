import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { useConvertedPrices } from '@/hooks/useConvertedPrices';
import type { MarketData } from '@/types';

/**
 * Card de mercado do cockpit — SOMENTE LEITURA.
 * Mesmos dados, mesmo corte de vencidos e mesma quantidade de tickers da aba
 * Mercado → Bolsa. Editar cotação continua sendo lá.
 */
function fmt(v: number | null | undefined, digits = 2): string {
  return v == null ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 text-left">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-sm font-medium">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function CbotTable({ rows, brl }: { rows: MarketData[]; brl: Map<string, number> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground px-2 py-2">Sem dados.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Preço (USD/bu)</TableHead>
          <TableHead className="text-right">Preço (R$/sc)</TableHead>
          <TableHead className="text-right">NDF Estimado</TableHead>
          <TableHead className="text-right">Spread</TableHead>
          <TableHead className="text-right">Atualizado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.ticker}>
            <TableCell className="font-medium text-xs">{row.ticker}</TableCell>
            <TableCell className="text-xs">{row.exp_date ?? '-'}</TableCell>
            <TableCell className="text-right tabular-nums text-xs">{fmt(row.price)}</TableCell>
            <TableCell className="text-right tabular-nums text-xs">{fmt(brl.get(row.ticker))}</TableCell>
            <TableCell className="text-right tabular-nums text-xs">{fmt(row.ndf_estimated, 4)}</TableCell>
            <TableCell className="text-right tabular-nums text-xs">{fmt(row.ndf_spread, 4)}</TableCell>
            <TableCell
              className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}
            >
              {getHoursAgo(row.updated_at)}h · {row.source}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MarketCard() {
  const { data: marketData, isLoading } = useMarketData();
  const { data: parameters } = usePricingParameters();

  const sojaQty = parameters?.find((p) => p.id === 'soybean_cbot')?.ticker_count ?? 8;
  const cornCbotQty = parameters?.find((p) => p.id === 'corn_cbot')?.ticker_count ?? 8;
  const b3Qty = parameters?.find((p) => p.id === 'corn_b3')?.ticker_count ?? 6;

  const todayIso = new Date().toISOString().split('T')[0];
  const notExpired = (m: MarketData) => !!m.exp_date && m.exp_date >= todayIso;
  const byExp = (a: MarketData, b: MarketData) => (a.exp_date ?? '').localeCompare(b.exp_date ?? '');

  const soybeanRows = useMemo(
    () => (marketData?.filter((m) => m.commodity === 'SOJA' && notExpired(m) && m.price != null) ?? []).sort(byExp).slice(0, sojaQty),
    [marketData, sojaQty],
  );
  const cornCbotRows = useMemo(
    () => (marketData?.filter((m) => m.commodity === 'MILHO_CBOT' && notExpired(m) && m.price != null) ?? []).sort(byExp).slice(0, cornCbotQty),
    [marketData, cornCbotQty],
  );
  const cornB3Rows = useMemo(
    () => (marketData?.filter((m) => m.commodity === 'MILHO' && notExpired(m)) ?? []).sort(byExp).slice(0, b3Qty),
    [marketData, b3Qty],
  );

  const fxRow = marketData?.find((m) => m.ticker === 'USD/BRL');
  const soybeanBrl = useConvertedPrices(soybeanRows, 'soybean');
  const cornCbotBrl = useConvertedPrices(cornCbotRows, 'corn');

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando mercado…</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded border border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">Dólar / Real (USD/BRL)</span>
        <span className="text-sm font-semibold tabular-nums">
          {fmt(fxRow?.price, 4)}
          {fxRow && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              {getHoursAgo(fxRow.updated_at)}h · {fxRow.source}
            </span>
          )}
        </span>
      </div>

      <Section title="Soja CBOT" defaultOpen>
        <CbotTable rows={soybeanRows} brl={soybeanBrl} />
      </Section>
      <Section title="Milho CBOT">
        <CbotTable rows={cornCbotRows} brl={cornCbotBrl} />
      </Section>
      <Section title="Milho B3">
        {cornB3Rows.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-2">Sem dados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Preço (BRL/saca)</TableHead>
                <TableHead className="text-right">Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cornB3Rows.map((row) => (
                <TableRow key={row.ticker}>
                  <TableCell className="font-medium text-xs">{row.ticker}</TableCell>
                  <TableCell className="text-xs">{row.exp_date ?? '-'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmt(row.price)}</TableCell>
                  <TableCell
                    className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}
                  >
                    {getHoursAgo(row.updated_at)}h · {row.source}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
