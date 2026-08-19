import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RefreshCw, Edit2, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useMarketData, useUpsertMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { useConvertedPrices } from '@/hooks/useConvertedPrices';
import {
  fetchQuotes,
  getCurrentFxFromDb,
  persistFX,
  persistSoybean,
  persistCornCBOT,
  persistCornB3,
  confirmB3Update,
  loadB3FromDb,
  type MarketWriteDeps,
  type B3CornQuote,
  type B3SavedPrice,
} from '@/lib/marketWrites';
import type { MarketData } from '@/types';

/**
 * Card de mercado do cockpit — EDITÁVEL.
 *
 * Diferente do resto do cockpit: a edição de cotação grava IMEDIATAMENTE em
 * `market_data` (tabela compartilhada), exatamente como na aba Mercado → Bolsa.
 * Toda a escrita vem de `src/lib/marketWrites.ts`, compartilhado com a aba —
 * nenhuma regra é reimplementada aqui.
 *
 * Qualquer gravação avisa o cockpit (`onQuoteChanged`) para travar o Publicar
 * até o próximo recálculo.
 */
function fmt(v: number | null | undefined, digits = 2): string {
  return v == null ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Section({
  title,
  action,
  defaultOpen,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-medium">{title}</span>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export interface MarketCardProps {
  /** Chamado após QUALQUER gravação de cotação (manual ou fetch automático). */
  onQuoteChanged: (tickers: string[]) => void;
  /** Muda a cada recálculo: limpa as marcas âmbar das cotações. */
  clearMarksKey?: number;
}

export function MarketCard({ onQuoteChanged, clearMarksKey = 0 }: MarketCardProps) {
  const { data: marketData, isLoading } = useMarketData();
  const { data: parameters } = usePricingParameters();
  const upsertMarket = useUpsertMarketData();
  const queryClient = useQueryClient();
  const deps: MarketWriteDeps = { upsert: upsertMarket.mutateAsync, queryClient };

  const sojaQty = parameters?.find((p) => p.id === 'soybean_cbot')?.ticker_count ?? 8;
  const cornCbotQty = parameters?.find((p) => p.id === 'corn_cbot')?.ticker_count ?? 8;
  const b3Qty = parameters?.find((p) => p.id === 'corn_b3')?.ticker_count ?? 6;

  const [fetchingOp, setFetchingOp] = useState<'all' | 'markets' | 'fx' | null>(null);
  const [confirmingB3, setConfirmingB3] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number | null>(null);
  const [editValid, setEditValid] = useState(true);
  /** Tickers gravados nesta sessão desde o último recálculo (marca âmbar). */
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const [b3Tickers, setB3Tickers] = useState<B3CornQuote[]>([]);
  const [b3Prices, setB3Prices] = useState<Record<string, B3SavedPrice>>({});

  useEffect(() => { setTouched(new Set()); }, [clearMarksKey]);

  useEffect(() => {
    loadB3FromDb()
      .then(({ tickers, prices }) => { setB3Tickers(tickers); setB3Prices(prices); })
      .catch(() => { /* B3 aparece vazio; a aba Mercado reporta o erro */ });
  }, []);

  const dataMap = useMemo(() => {
    const m: Record<string, MarketData> = {};
    marketData?.forEach((md) => { m[md.ticker] = md; });
    return m;
  }, [marketData]);

  const markTouched = (tickers: string[]) => {
    setTouched((prev) => {
      const next = new Set(prev);
      tickers.forEach((t) => next.add(t));
      return next;
    });
    onQuoteChanged(tickers);
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const notExpired = (m: { exp_date?: string | null }) => !!m.exp_date && m.exp_date >= todayIso;
  const byExp = (a: { exp_date?: string | null }, b: { exp_date?: string | null }) =>
    (a.exp_date ?? '').localeCompare(b.exp_date ?? '');

  const soybeanRows = useMemo(
    () => (marketData?.filter((m) => m.commodity === 'SOJA' && notExpired(m) && m.price != null) ?? []).sort(byExp).slice(0, sojaQty),
    [marketData, sojaQty],
  );
  const cornCbotRows = useMemo(
    () => (marketData?.filter((m) => m.commodity === 'MILHO_CBOT' && notExpired(m) && m.price != null) ?? []).sort(byExp).slice(0, cornCbotQty),
    [marketData, cornCbotQty],
  );
  const visibleB3 = useMemo(
    () => b3Tickers.filter(notExpired).slice(0, b3Qty),
    [b3Tickers, b3Qty],
  );

  const fxRow = dataMap['USD/BRL'];
  const soybeanBrl = useConvertedPrices(soybeanRows, 'soybean');
  const cornCbotBrl = useConvertedPrices(cornCbotRows, 'corn');

  // ---- Gravação manual (mesma mecânica da aba Mercado) ----

  const handleManualSave = async (ticker: string) => {
    const price = editValue;
    if (price === null || !editValid) { toast.error('Valor inválido'); return; }
    const existing = dataMap[ticker];
    try {
      await upsertMarket.mutateAsync({
        ticker,
        commodity: existing?.commodity ?? 'UNKNOWN',
        price,
        currency: existing?.currency ?? 'BRL',
        source: 'manual',
      });
      markTouched([ticker]);
      toast.success(`${ticker} gravado em market_data`);
      setEditingTicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleB3Save = async (ticker: string, expDate: string) => {
    const price = editValue;
    if (price === null || !editValid) { toast.error('Valor inválido'); return; }
    try {
      await upsertMarket.mutateAsync({
        ticker,
        commodity: 'MILHO',
        price,
        currency: 'BRL',
        source: 'manual',
        price_unit: 'brl_per_sack',
        raw_price: price,
        raw_unit: 'brl_per_sack',
        exp_date: expDate,
        exchange_rate: null,
        ndf_spot: null,
        ndf_estimated: null,
        ndf_spread: null,
        ndf_override: null,
      });
      setB3Prices((prev) => ({
        ...prev,
        [ticker]: { price, updated_at: new Date().toISOString(), source: 'manual' },
      }));
      markTouched([ticker]);
      toast.success(`${ticker} gravado em market_data`);
      setEditingTicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  // ---- Fetch automático (yfinance), idêntico à aba Mercado ----

  const runB3 = async () => {
    const { tickers, prices } = await persistCornB3(deps, b3Qty);
    setB3Tickers(tickers);
    setB3Prices(prices);
    return tickers.map((t) => t.ticker);
  };

  const handleFetchAll = async () => {
    setFetchingOp('all');
    try {
      const result = await fetchQuotes(Math.max(sojaQty, cornCbotQty));
      await persistFX(deps, result);
      await persistSoybean(deps, result);
      await persistCornCBOT(deps, result);
      const b3 = await runB3();
      markTouched([
        'USD/BRL',
        ...(result.soybean_cbot ?? []).map((s) => s.ticker),
        ...(result.corn_cbot ?? []).map((c) => c.ticker),
        ...b3,
      ]);
      toast.success('Cotações atualizadas — gravadas em market_data');
    } catch (err) {
      toast.error(`Erro ao atualizar: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchMarkets = async () => {
    setFetchingOp('markets');
    try {
      const fxOverride = await getCurrentFxFromDb();
      const result = await fetchQuotes(Math.max(sojaQty, cornCbotQty), fxOverride);
      await persistSoybean(deps, result);
      await persistCornCBOT(deps, result);
      const b3 = await runB3();
      markTouched([
        ...(result.soybean_cbot ?? []).map((s) => s.ticker),
        ...(result.corn_cbot ?? []).map((c) => c.ticker),
        ...b3,
      ]);
      toast.success('Mercados atualizados (câmbio preservado)');
    } catch (err) {
      toast.error(`Erro ao atualizar mercados: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  /** Só o dólar: nenhum future é tocado (nem soja, nem milho CBOT, nem B3). */
  const handleFetchFxOnly = async () => {
    setFetchingOp('fx');
    try {
      const result = await fetchQuotes(Math.max(sojaQty, cornCbotQty));
      await persistFX(deps, result);
      markTouched(['USD/BRL']);
      toast.success('Câmbio atualizado — gravado em market_data');
    } catch (err) {
      toast.error(`Erro ao atualizar câmbio: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  /** Renova o carimbo dos tickers B3 sem alterar preço (mesma lógica da aba Mercado). */
  const handleConfirmB3 = async () => {
    setConfirmingB3(true);
    try {
      const tickers = visibleB3.map((t) => t.ticker);
      const now = await confirmB3Update(tickers);
      setB3Prices((prev) => {
        const updated = { ...prev };
        tickers.forEach((t) => {
          if (updated[t]) updated[t] = { ...updated[t], updated_at: now };
        });
        return updated;
      });
      markTouched(tickers);
      toast.success('Atualização B3 confirmada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar');
    } finally { setConfirmingB3(false); }
  };


  // ---- Células ----

  const editCell = (
    ticker: string,
    current: number | null | undefined,
    onSave: () => void,
    precision: 2 | 4 = 4,
  ) => {
    if (editingTicker === ticker) {
      return (
        <div className="flex gap-1 items-center justify-end">
          <NumericInput
            precision={precision}
            value={editValue}
            onChange={setEditValue}
            onValidityChange={setEditValid}
            showError={false}
            className="h-7 w-28"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') setEditingTicker(null); }}
          />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={!editValid} onClick={onSave}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => { setEditingTicker(ticker); setEditValue(current ?? null); setEditValid(true); }}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    );
  };

  const priceClass = (ticker: string) =>
    cn('text-right tabular-nums text-xs', touched.has(ticker) && 'text-amber-500 font-semibold');

  const CbotTable = ({ rows, brl }: { rows: MarketData[]; brl: Map<string, number> }) => {
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
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ticker}>
              <TableCell className="font-medium text-xs">{row.ticker}</TableCell>
              <TableCell className="text-xs">{row.exp_date ?? '-'}</TableCell>
              <TableCell className={priceClass(row.ticker)}>{fmt(row.price)}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">{fmt(brl.get(row.ticker))}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">{fmt(row.ndf_estimated, 4)}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">{fmt(row.ndf_spread, 4)}</TableCell>
              <TableCell
                className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}
              >
                {getHoursAgo(row.updated_at)}h · {row.source}
              </TableCell>
              <TableCell className="text-right">
                {editCell(row.ticker, row.price, () => handleManualSave(row.ticker))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando mercado…</p>;

  return (
    <div className="space-y-2 w-full min-w-0">
      <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-px" />
        <span>
          Cotação grava <strong>na hora</strong> em <code>market_data</code> — vale para todo mundo,
          inclusive na aba Mercado. Recarregar a página não desfaz. Depois de mexer, é preciso
          recalcular antes de publicar.
        </span>
      </div>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={fetchingOp !== null}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${fetchingOp ? 'animate-spin' : ''}`} />
              Atualizar cotações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleFetchAll}>Atualizar tudo (inclui câmbio)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleFetchMarkets}>Atualizar mercados (preserva o câmbio)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleFetchFxOnly}>Atualizar só o câmbio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">Dólar / Real (USD/BRL)</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold tabular-nums', touched.has('USD/BRL') && 'text-amber-500')}>
            {fmt(fxRow?.price, 4)}
          </span>
          {fxRow && (
            <span className="text-[11px] text-muted-foreground">
              {getHoursAgo(fxRow.updated_at)}h · {fxRow.source}
            </span>
          )}
          {editCell('USD/BRL', fxRow?.price, () => handleManualSave('USD/BRL'))}
        </div>
      </div>

      <Section title="Soja CBOT" defaultOpen>
        <CbotTable rows={soybeanRows} brl={soybeanBrl} />
      </Section>
      <Section title="Milho CBOT">
        <CbotTable rows={cornCbotRows} brl={cornCbotBrl} />
      </Section>
      <Section
        title="Milho B3 (manual)"
        action={
          visibleB3.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleConfirmB3}
              disabled={confirmingB3}
            >
              <Check className="mr-1.5 h-3 w-3" />
              {confirmingB3 ? 'Confirmando…' : 'Confirmar atualização'}
            </Button>
          ) : undefined
        }
      >
        {visibleB3.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-2">Sem dados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Preço (BRL/saca)</TableHead>
                <TableHead className="text-right">Atualizado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleB3.map((t) => {
                const saved = b3Prices[t.ticker];
                return (
                  <TableRow key={t.ticker}>
                    <TableCell className="font-medium text-xs">{t.ticker}</TableCell>
                    <TableCell className="text-xs">{t.exp_date}</TableCell>
                    <TableCell className={priceClass(t.ticker)}>{fmt(saved?.price)}</TableCell>
                    <TableCell
                      className={`text-right text-xs ${saved?.updated_at && getHoursAgo(saved.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}
                    >
                      {saved?.updated_at ? `${getHoursAgo(saved.updated_at)}h · ${saved.source}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editCell(t.ticker, saved?.price, () => handleB3Save(t.ticker, t.exp_date), 2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
