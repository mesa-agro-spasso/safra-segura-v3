import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateInput } from '@/components/ui/date-input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { pgErrorMessage } from '@/lib/pgError';

import { useMyLocations } from '@/hooks/useMyLocations';
import {
  usePhysicalPricePanel, useDailySeries, useQuotes, useQuoteCounts,
  useYesterdayWinner, useRepeatYesterday, triggerNormalize, getHoursAgo,
} from '@/hooks/usePhysicalPrices';
import { PhysicalQuoteDialog } from '@/components/market/PhysicalQuoteDialog';

const COMMODITY_LABEL: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };
const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', repeat_previous: 'Repetida' };

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const fmtBRL = (v: number | null | undefined) =>
  v == null ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FreshnessBadge({ referenceDate }: { referenceDate: string }) {
  const hours = getHoursAgo(`${referenceDate}T12:00:00`);
  if (hours > 72) return <Badge variant="destructive">Defasado ({Math.floor(hours / 24)}d)</Badge>;
  if (hours > 36) return <Badge className="bg-amber-500 text-black hover:bg-amber-500">Atenção ({Math.floor(hours / 24)}d)</Badge>;
  return <Badge variant="outline">Atual</Badge>;
}

/* ============================ A) PAINEL ============================ */

function PainelView({ onRegister }: { onRegister: (locationId: string, commodity: string) => void }) {
  const { data: rows = [], isLoading } = usePhysicalPricePanel();
  const { allLocations, locations } = useMyLocations();

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    allLocations.forEach((l) => { m[l.id] = l.name; });
    return m;
  }, [allLocations]);

  const myIds = useMemo(() => new Set(locations.map((l) => l.id)), [locations]);

  useEffect(() => { triggerNormalize(); }, []);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando painel…</p>;
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum preço canônico publicado ainda.</p>;
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Praça</TableHead>
            <TableHead>Commodity</TableHead>
            <TableHead className="text-right">Preço (R$/sc)</TableHead>
            <TableHead className="text-center">Referência</TableHead>
            <TableHead className="text-center">Situação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.location_id}-${r.commodity}`}>
              <TableCell className="font-medium">{nameById[r.location_id] ?? r.location_id}</TableCell>
              <TableCell>{COMMODITY_LABEL[r.commodity] ?? r.commodity}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtBRL(r.price_brl_per_sack)}</TableCell>
              <TableCell className="text-center">{fmtDate(r.reference_date)}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <FreshnessBadge referenceDate={r.reference_date} />
                  {r.pending && <Badge variant="secondary" className="text-[10px]">calculando VP</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <RepeatYesterdayButton
                    locationId={r.location_id}
                    commodity={r.commodity}
                    locationName={nameById[r.location_id] ?? r.location_id}
                    allowed={myIds.has(r.location_id)}
                  />
                  {myIds.has(r.location_id) && (
                    <Button variant="outline" size="sm" onClick={() => onRegister(r.location_id, r.commodity)}>
                      Nova cotação
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RepeatYesterdayButton({
  locationId, commodity, locationName, allowed,
}: { locationId: string; commodity: string; locationName: string; allowed: boolean }) {
  const { data: winner } = useYesterdayWinner(allowed ? locationId : null, allowed ? commodity : null);
  const repeat = useRepeatYesterday();
  const [open, setOpen] = useState(false);

  if (!allowed) return null;

  const confirm = async () => {
    if (!winner) return;
    try {
      await repeat.mutateAsync(winner);
      toast.success('Cotação de ontem repetida para hoje.');
      setOpen(false);
    } catch (err) {
      toast.error(pgErrorMessage(err));
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={!winner || repeat.isPending}
        onClick={() => setOpen(true)}
        title={winner ? 'Repetir cotação de ontem' : 'Sem cotação vencedora de ontem'}
      >
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Repetir ontem
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repetir cotação de ontem</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p>Será criada uma nova cotação para hoje em {locationName} ({COMMODITY_LABEL[commodity] ?? commodity}):</p>
                <p><span className="font-medium text-foreground">Comprador:</span> {winner?.buyer}</p>
                <p><span className="font-medium text-foreground">Preço:</span> R$ {fmtBRL(winner?.price_brl_per_sack)}/sc</p>
                <p><span className="font-medium text-foreground">Prazo preservado</span> a partir de hoje.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Repetir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* =========================== B) POR PRAÇA =========================== */

function PorPracaView() {
  const { locations } = useMyLocations();
  const [locationId, setLocationId] = useState('');
  const [commodity, setCommodity] = useState('soybean');
  const [showAll, setShowAll] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const daily = useDailySeries(locationId || null, commodity, start || undefined, end || undefined);
  const quotes = useQuotes(showAll ? (locationId || null) : null, commodity, start || undefined, end || undefined);

  const locationName = locations.find((l) => l.id === locationId)?.name ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Praça</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Commodity</Label>
          <Select value={commodity} onValueChange={setCommodity}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soybean">Soja</SelectItem>
              <SelectItem value="corn">Milho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Início</Label>
          <DateInput value={start} onChange={setStart} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fim</Label>
          <DateInput value={end} onChange={setEnd} />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch id="all-quotes" checked={showAll} onCheckedChange={setShowAll} />
          <Label htmlFor="all-quotes" className="text-sm">Todas as cotações</Label>
        </div>
        {locationId && (
          <div className="pb-1">
            <RepeatYesterdayButton
              locationId={locationId}
              commodity={commodity}
              locationName={locationName}
              allowed
            />
          </div>
        )}
      </div>

      {!showAll ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencedores diários (valor presente)</CardTitle></CardHeader>
          <CardContent>
            {daily.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (daily.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum preço diário no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Preço canônico (R$/sc)</TableHead>
                    <TableHead className="text-right">Calculado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(daily.data ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.reference_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(Number(d.price_brl_per_sack))}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(d.computed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Todas as cotações</CardTitle></CardHeader>
          <CardContent>
            {quotes.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (quotes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cotação no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead className="text-right">Nominal (R$/sc)</TableHead>
                    <TableHead className="text-center">Pagamento</TableHead>
                    <TableHead className="text-right">VP (R$/sc)</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(quotes.data ?? []).map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{fmtDate(q.reference_date)}</TableCell>
                      <TableCell className="font-medium">{q.buyer}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(Number(q.price_brl_per_sack))}</TableCell>
                      <TableCell className="text-center">{fmtDate(q.payment_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {q.present_value_brl == null
                          ? <Badge variant="secondary" className="text-[10px]">calculando</Badge>
                          : fmtBRL(Number(q.present_value_brl))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{SOURCE_LABEL[q.source] ?? q.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =========================== C) CALENDÁRIO =========================== */

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function CalendarioView({ onPickDay }: { onPickDay: (locationId: string, commodity: string, date: string) => void }) {
  const { locations } = useMyLocations();
  const now = new Date();
  const [locationId, setLocationId] = useState('');
  const [commodity, setCommodity] = useState('soybean');
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const { start, end } = monthBounds(cursor.year, cursor.month);
  const { data: counts = {} } = useQuoteCounts(locationId || null, commodity, start, end);

  const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Praça</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Commodity</Label>
          <Select value={commodity} onValueChange={setCommodity}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soybean">Soja</SelectItem>
              <SelectItem value="corn">Milho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>Anterior</Button>
          <span className="min-w-[150px] text-center text-sm font-medium">{MONTHS[cursor.month]} {cursor.year}</span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>Próximo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="pb-1 text-center text-xs text-muted-foreground">{w}</div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = counts[iso] ?? 0;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!locationId}
                  onClick={() => onPickDay(locationId, commodity, iso)}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center rounded-md border text-sm transition-colors',
                    count > 0
                      ? 'border-primary/40 bg-primary/10 hover:bg-primary/20'
                      : 'border-dashed border-border bg-muted/20 text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  <span className="font-medium">{day}</span>
                  <span className="text-[10px]">{count > 0 ? `${count} cotação${count > 1 ? 'ões' : ''}` : 'sem cotação'}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================== PÁGINA ============================== */

export default function MarketFisico() {
  const { locations } = useMyLocations();
  const [dialog, setDialog] = useState<{ open: boolean; locationId?: string; commodity?: 'soybean' | 'corn'; date?: string }>({ open: false });

  const openDialog = (locationId?: string, commodity?: string, date?: string) =>
    setDialog({ open: true, locationId, commodity: (commodity as 'soybean' | 'corn') ?? 'soybean', date: date ?? todayISO() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mercado Físico</h2>
          <p className="text-sm text-muted-foreground">
            Cotações por comprador e prazo; o preço canônico do dia é o valor presente vencedor.
          </p>
        </div>
        <Button onClick={() => openDialog()} disabled={locations.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Registrar cotação
        </Button>
      </div>

      <Tabs defaultValue="painel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="praca">Por praça</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>
        <TabsContent value="painel">
          <PainelView onRegister={(loc, com) => openDialog(loc, com)} />
        </TabsContent>
        <TabsContent value="praca"><PorPracaView /></TabsContent>
        <TabsContent value="calendario">
          <CalendarioView onPickDay={(loc, com, date) => openDialog(loc, com, date)} />
        </TabsContent>
      </Tabs>

      <PhysicalQuoteDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        locations={locations}
        defaultLocationId={dialog.locationId}
        defaultCommodity={dialog.commodity}
        defaultDate={dialog.date}
      />
    </div>
  );
}
