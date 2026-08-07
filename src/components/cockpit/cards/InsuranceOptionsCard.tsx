import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { StickyTableScroll, STICKY_HEAD } from '@/components/cockpit/StickyTableScroll';
import { cn } from '@/lib/utils';
import {
  useInsuranceOptions,
  useLatestOptionQuotes,
  useCreateOptionQuote,
  formatStrike,
  formatPremium,
  formatDateBr,
  unitLabel,
  todayISO,
  COMMODITY_LABEL,
  BENCHMARK_LABEL,
  type InsuranceOption,
} from '@/hooks/useInsuranceOptions';

/**
 * Card de opções do cockpit: mostra o prêmio mais recente e REGISTRA cotação.
 * Não cadastra opção — isso vive em Mercado > Opções.
 * Registrar sempre INSERE: a cotação anterior pode ter formado um preço já gerado.
 */

export interface InsuranceOptionsCardProps {
  /** Avisa o cockpit que uma cotação foi gravada (trava o Publicar até recalcular). */
  onQuoteRegistered?: () => void;
}

function parseDecimal(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function InsuranceOptionsCard({ onQuoteRegistered }: InsuranceOptionsCardProps) {
  const { data: options, isLoading } = useInsuranceOptions();
  const { data: latestQuotes } = useLatestOptionQuotes();
  const createQuote = useCreateOptionQuote();

  const [registering, setRegistering] = useState<InsuranceOption | null>(null);
  const [premium, setPremium] = useState('');
  const [tradeDate, setTradeDate] = useState(todayISO());

  const openRegister = (opt: InsuranceOption) => {
    setRegistering(opt);
    setPremium('');
    setTradeDate(todayISO());
  };

  const handleSave = async () => {
    if (!registering) return;
    const value = parseDecimal(premium);
    if (value == null || value <= 0) {
      toast.error('Informe o prêmio.');
      return;
    }
    if (!tradeDate) {
      toast.error('Informe a data do pregão.');
      return;
    }
    try {
      await createQuote.mutateAsync({ option: registering, premium: value, trade_date: tradeDate });
      toast.success('Cotação registrada.');
      setRegistering(null);
      onQuoteRegistered?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar cotação');
    }
  };

  const HEAD = cn(STICKY_HEAD, 'border-b border-border');

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <StickyTableScroll maxHeightClass="max-h-[420px]">
        <Table unstyledWrapper className="border-separate border-spacing-0 [&_tbody_td]:border-b [&_tbody_td]:border-border">
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>Opção</TableHead>
              <TableHead className={HEAD}>Mercado</TableHead>
              <TableHead className={HEAD}>Tipo</TableHead>
              <TableHead className={HEAD}>Strike</TableHead>
              <TableHead className={HEAD}>Vencimento</TableHead>
              <TableHead className={HEAD}>Prêmio mais recente</TableHead>
              <TableHead className={HEAD}>Pregão</TableHead>
              <TableHead className={HEAD}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options?.map((o) => {
              const quote = latestQuotes?.[o.id];
              const hasToday = quote?.trade_date === todayISO();
              return (
                <TableRow key={o.id}>
                  <TableCell className="text-xs font-medium">{o.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {COMMODITY_LABEL[o.commodity]} · {BENCHMARK_LABEL[o.benchmark]}
                  </TableCell>
                  <TableCell className="text-xs uppercase">{o.option_type}</TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">{formatStrike(o)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateBr(o.expiry_date)}</TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                    {quote ? formatPremium(quote) : '—'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {hasToday ? (
                      <span className="text-muted-foreground">{formatDateBr(quote!.trade_date)}</span>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        {quote ? `${formatDateBr(quote.trade_date)} — sem cotação hoje` : 'sem cotação'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openRegister(o)}>
                      Registrar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && (options?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma opção ativa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </StickyTableScroll>

      <p className="px-1 text-xs text-muted-foreground">
        Aqui só se registra a cotação do dia. Para criar ou aposentar uma opção,{' '}
        <Link to="/mercado/opcoes" className="inline-flex items-center gap-1 text-primary hover:underline">
          Mercado &gt; Opções <ExternalLink className="h-3 w-3" />
        </Link>
        .
      </p>

      <Dialog open={!!registering} onOpenChange={(o) => { if (!o) setRegistering(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar cotação</DialogTitle>
            <DialogDescription>
              {registering?.label} — cada registro é uma nova cotação; nada é sobrescrito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Prêmio ({registering ? unitLabel(registering.benchmark) : ''})</Label>
              <Input
                value={premium}
                inputMode="decimal"
                placeholder={registering?.benchmark === 'cbot' ? 'ex: 1,0255' : 'ex: 3,50'}
                onChange={(e) => setPremium(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pregão</Label>
              <DateInput value={tradeDate} onChange={(v) => setTradeDate(v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistering(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createQuote.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
