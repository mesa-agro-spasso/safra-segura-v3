import { useState } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Archive, ChevronDown, ChevronRight, Check } from 'lucide-react';
import InsuranceOptionFormDialog from '@/components/market/InsuranceOptionFormDialog';
import {
  useInsuranceOptions, useLatestOptionQuotes, useOptionQuoteHistory,
  useCreateOptionQuote, useRetireInsuranceOption,
  formatStrike, formatPremium, formatDateBr, unitLabel, todayISO,
  COMMODITY_LABEL, BENCHMARK_LABEL,
  type InsuranceOption,
} from '@/hooks/useInsuranceOptions';

const QuoteHistory = ({ option }: { option: InsuranceOption }) => {
  const { data: history = [], isLoading } = useOptionQuoteHistory(option.id);
  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Carregando histórico...</p>;
  if (history.length === 0) return <p className="text-xs text-muted-foreground py-2">Nenhuma cotação registrada.</p>;
  return (
    <div className="py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Pregão</TableHead>
            <TableHead className="text-xs">Prêmio</TableHead>
            <TableHead className="text-xs">Registrado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="text-xs">{formatDateBr(q.trade_date)}</TableCell>
              <TableCell className="text-xs font-medium">{formatPremium(q)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const QuoteRow = ({ option, expanded, onToggle }: {
  option: InsuranceOption; expanded: boolean; onToggle: () => void;
}) => {
  const { data: latest = {} } = useLatestOptionQuotes();
  const createQuote = useCreateOptionQuote();
  const [premium, setPremium] = useState('');
  const [tradeDate, setTradeDate] = useState(todayISO());

  const quote = latest[option.id];
  const today = todayISO();
  const hasToday = quote?.trade_date?.slice(0, 10) === today;

  const handleSave = async () => {
    const p = parseFloat(premium.replace(',', '.'));
    if (!Number.isFinite(p) || p <= 0) { toast.error('Prêmio inválido'); return; }
    if (!tradeDate) { toast.error('Informe a data do pregão'); return; }
    try {
      await createQuote.mutateAsync({ option, premium: p, trade_date: tradeDate });
      toast.success('Cotação registrada');
      setPremium('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar');
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="w-8">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          {option.label}
          <span className="ml-2 text-xs text-muted-foreground">
            {BENCHMARK_LABEL[option.benchmark]} · {COMMODITY_LABEL[option.commodity]}
          </span>
        </TableCell>
        <TableCell>{quote ? formatPremium(quote) : '—'}</TableCell>
        <TableCell>
          {!quote ? (
            <span className="inline-flex rounded-full border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning))]">
              Nunca cotada
            </span>
          ) : hasToday ? (
            <span className="text-xs text-muted-foreground">Pregão {formatDateBr(quote.trade_date)}</span>
          ) : (
            <span
              title={`Última cotação: ${formatDateBr(quote.trade_date)}`}
              className="inline-flex rounded-full border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning))]"
            >
              Sem cotação hoje · última {formatDateBr(quote.trade_date)}
            </span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type="number"
                step={option.benchmark === 'cbot' ? '0.0001' : '0.01'}
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="h-8 w-40 pr-24"
                placeholder="Novo prêmio"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                {unitLabel(option.benchmark)}
              </span>
            </div>
            <div className="w-36">
              <DateInput value={tradeDate} onChange={setTradeDate} />
            </div>
            <Button size="sm" className="h-8" onClick={handleSave} disabled={createQuote.isPending}>
              <Check className="mr-1 h-3.5 w-3.5" /> Registrar
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30">
            <QuoteHistory option={option} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const MarketOpcoes = () => {
  const { data: options = [], isLoading } = useInsuranceOptions();
  const retire = useRetireInsuranceOption();
  const [formOpen, setFormOpen] = useState(false);
  const [toRetire, setToRetire] = useState<InsuranceOption | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = todayISO();

  const handleRetire = async () => {
    if (!toRetire) return;
    try {
      await retire.mutateAsync(toRetire);
      toast.success('Opção aposentada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aposentar');
    } finally {
      setToRetire(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Opções</h2>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Cadastrar opção
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Opções cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma opção ativa. Clique em "Cadastrar opção".
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opção</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Benchmark</TableHead>
                      <TableHead>Futuro</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Strike</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {options.map((o) => {
                      const expired = o.expiry_date < today;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.label}</TableCell>
                          <TableCell>{COMMODITY_LABEL[o.commodity]}</TableCell>
                          <TableCell>{BENCHMARK_LABEL[o.benchmark]}</TableCell>
                          <TableCell>{o.futures_ticker}</TableCell>
                          <TableCell className="uppercase">{o.option_type}</TableCell>
                          <TableCell>{formatStrike(o)}</TableCell>
                          <TableCell>
                            {formatDateBr(o.expiry_date)}
                            {expired && (
                              <span className="ml-2 inline-flex rounded-full border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning))]">
                                Vencida
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setToRetire(o)}>
                              <Archive className="mr-1 h-3.5 w-3.5" /> Aposentar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cotação do dia</CardTitle>
            </CardHeader>
            <CardContent>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre uma opção para registrar cotações.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Opção</TableHead>
                      <TableHead>Último prêmio</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Registrar cotação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {options.map((o) => (
                      <QuoteRow
                        key={o.id}
                        option={o}
                        expanded={expanded === o.id}
                        onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <InsuranceOptionFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!toRetire} onOpenChange={(o) => !o && setToRetire(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aposentar "{toRetire?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A opção sai da lista de ativas, mas não é apagada: há cotações históricas
              apontando para ela, e preços já gerados dependem desse rastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetire}>Aposentar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MarketOpcoes;
