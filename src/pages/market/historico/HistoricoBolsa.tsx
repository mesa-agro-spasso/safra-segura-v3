import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMarketHistory, useMarketHistoryTickers } from '@/hooks/useMarketHistory';

type CommodityKey = 'soybean' | 'corn';

const COMMODITY_OPTIONS: { value: CommodityKey; label: string }[] = [
  { value: 'soybean', label: 'Soja CBOT' },
  { value: 'corn', label: 'Milho CBOT' },
];

const PERIOD_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: '30', label: 'Últimos 30 dias', days: 30 },
  { value: '90', label: 'Últimos 90 dias', days: 90 },
  { value: '365', label: 'Último ano', days: 365 },
  { value: 'all', label: 'Tudo', days: null },
];

const chartConfig: ChartConfig = {
  price: { label: 'Preço', color: 'hsl(var(--primary))' },
};

const HistoricoBolsa = () => {
  const [commodity, setCommodity] = useState<CommodityKey>('soybean');
  const [period, setPeriod] = useState('90');
  const [ticker, setTicker] = useState<string | null>(null);

  const { data: tickers = [], isLoading: loadingTickers } = useMarketHistoryTickers(commodity);

  // Auto-select first ticker when commodity changes / data loads
  useEffect(() => {
    if (tickers.length > 0 && (!ticker || !tickers.some((t) => t.ticker === ticker))) {
      setTicker(tickers[0].ticker);
    }
    if (tickers.length === 0) setTicker(null);
  }, [tickers, ticker]);

  const periodDays = useMemo(
    () => PERIOD_OPTIONS.find((p) => p.value === period)?.days ?? null,
    [period],
  );
  const { data: rows = [], isLoading: loadingRows } = useMarketHistory(ticker, periodDays);

  const chartData = useMemo(
    () => rows.map((r) => ({ date: r.reference_date, price: Number(r.price) })),
    [rows],
  );

  const tableRows = useMemo(() => [...rows].reverse(), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Commodity</label>
          <Select value={commodity} onValueChange={(v) => setCommodity(v as CommodityKey)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMMODITY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ticker</label>
          <Select
            value={ticker ?? ''}
            onValueChange={(v) => setTicker(v)}
            disabled={loadingTickers || tickers.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={loadingTickers ? 'Carregando...' : 'Selecione'} />
            </SelectTrigger>
            <SelectContent>
              {tickers.map((t) => (
                <SelectItem key={t.ticker} value={t.ticker}>
                  {t.ticker}{t.exp_date ? ` · ${t.exp_date}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Série histórica {ticker ? `· ${ticker}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados para o ticker/período selecionado.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={32} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-price)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tabela</CardTitle>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem registros.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.reference_date}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.price).toFixed(4)}</TableCell>
                      <TableCell>{r.currency}</TableCell>
                      <TableCell>{r.price_unit ?? '-'}</TableCell>
                      <TableCell>{r.exp_date ?? '-'}</TableCell>
                      <TableCell>{r.source ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoBolsa;
