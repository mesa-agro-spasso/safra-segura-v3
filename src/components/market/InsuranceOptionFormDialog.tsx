import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DateInput } from '@/components/ui/date-input';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCreateInsuranceOption, useFuturesTickers, VALID_PAIRS, unitLabel, formatDateBr,
  type Benchmark, type Commodity,
} from '@/hooks/useInsuranceOptions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsuranceOptionFormDialog({ open, onOpenChange }: Props) {
  const create = useCreateInsuranceOption();

  const [label, setLabel] = useState('');
  const [benchmark, setBenchmark] = useState<Benchmark>('cbot');
  const [commodity, setCommodity] = useState<Commodity>('soybean');
  const [ticker, setTicker] = useState('');
  const [optionType, setOptionType] = useState<'call' | 'put'>('call');
  const [strike, setStrike] = useState('');
  const [expiry, setExpiry] = useState('');
  const [tickerOpen, setTickerOpen] = useState(false);
  const [tickerSearch, setTickerSearch] = useState('');

  const allowedCommodities = VALID_PAIRS[benchmark];
  const { data: futures = [], isLoading: loadingFutures } = useFuturesTickers(benchmark, commodity);
  const selectedFuture = futures.find((f) => f.ticker === ticker);

  const handleBenchmark = (v: string) => {
    const b = v as Benchmark;
    setBenchmark(b);
    // B3 só aceita milho — o banco recusa qualquer outro par.
    if (!VALID_PAIRS[b].includes(commodity)) setCommodity(VALID_PAIRS[b][0]);
    setStrike('');
    setTicker('');
  };

  const handleCommodity = (v: string) => {
    setCommodity(v as Commodity);
    setTicker('');
  };

  const pickFuture = (f: { ticker: string; exp_date: string | null }) => {
    setTicker(f.ticker);
    // Vencimento do contrato é sugestão: a mesa pode editar depois.
    if (f.exp_date) setExpiry(f.exp_date.slice(0, 10));
    setTickerOpen(false);
    setTickerSearch('');
  };

  const useFreeTicker = () => {
    setTicker(tickerSearch.trim().toUpperCase());
    setTickerOpen(false);
    setTickerSearch('');
  };

  const reset = () => {
    setLabel(''); setTicker(''); setStrike(''); setExpiry('');
    setOptionType('call'); setBenchmark('cbot'); setCommodity('soybean');
    setTickerSearch('');
  };

  const handleSubmit = async () => {
    const s = parseFloat(strike.replace(',', '.'));
    if (!label.trim()) { toast.error('Informe o nome da opção'); return; }
    if (!ticker.trim()) { toast.error('Informe o ticker do futuro'); return; }
    if (!Number.isFinite(s) || s <= 0) { toast.error('Strike inválido'); return; }
    if (!expiry) { toast.error('Informe o vencimento'); return; }
    try {
      await create.mutateAsync({
        label: label.trim(),
        commodity,
        benchmark,
        futures_ticker: ticker.trim().toUpperCase(),
        option_type: optionType,
        strike: s,
        expiry_date: expiry,
      });
      toast.success('Opção cadastrada');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar opção</DialogTitle>
          <DialogDescription>
            A unidade do strike segue o benchmark: CBOT em US$/bushel, B3 em R$/saca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Call soja Jul/26 12,20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Benchmark</Label>
              <Select value={benchmark} onValueChange={handleBenchmark}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbot">CBOT</SelectItem>
                  <SelectItem value="b3">B3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Commodity</Label>
              <Select value={commodity} onValueChange={(v) => setCommodity(v as Commodity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedCommodities.map((c) => (
                    <SelectItem key={c} value={c}>{c === 'soybean' ? 'Soja' : 'Milho'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ticker do futuro</Label>
              <Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="ZSN26" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={optionType} onValueChange={(v) => setOptionType(v as 'call' | 'put')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="put">Put</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Strike ({unitLabel(benchmark)})</Label>
              <div className="relative">
                <Input
                  type="number"
                  step={benchmark === 'cbot' ? '0.0001' : '0.01'}
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  className="pr-24"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {unitLabel(benchmark)}
                </span>
              </div>
            </div>
            <div>
              <Label>Vencimento</Label>
              <DateInput value={expiry} onChange={setExpiry} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InsuranceOptionFormDialog;
