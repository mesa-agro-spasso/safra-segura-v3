import { forwardRef, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

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
import { useIsMobile } from '@/hooks/use-mobile';

import { useMyLocations } from '@/hooks/useMyLocations';
import {
  usePhysicalPricePanel, useDailySeries, useQuotes, useQuoteCounts,
  useYesterdayWinner, useRepeatYesterday, useDeleteQuote, triggerNormalize,
  businessDaysSince, isWeekendISO,
} from '@/hooks/usePhysicalPrices';
import { PhysicalQuoteDialog } from '@/components/market/PhysicalQuoteDialog';

const COMMODITY_LABEL: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };
const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', repeat_previous: 'Repetida' };
const ALL = 'all';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const fmtBRL = (v: number | null | undefined) =>
  v == null ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 0 dias úteis = atual (sem selo); 1–2 = atenção; 3+ = defasado. */
function freshnessLevel(referenceDate: string): 0 | 1 | 2 {
  const d = businessDaysSince(referenceDate);
  if (d >= 3) return 2;
  if (d >= 1) return 1;
  return 0;
}

function FreshnessBadge({ referenceDate }: { referenceDate: string }) {
  const days = businessDaysSince(referenceDate);
  const level = freshnessLevel(referenceDate);
  if (level === 0) return null;
  const label = `${days}d ${days === 1 ? 'útil' : 'úteis'}`;
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-normal',
        level === 1
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      {level === 1 ? 'Atenção' : 'Defasado'} ({label})
    </Badge>
  );
}

const CommoditySelect = forwardRef<
  HTMLButtonElement,
  { value: string; onChange: (v: string) => void; includeAll?: boolean; className?: string }
>(({ value, onChange, includeAll = true, className }, ref) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger ref={ref} className={className ?? 'w-[160px]'}><SelectValue /></SelectTrigger>
    <SelectContent>
      {includeAll && <SelectItem value={ALL}>Todas</SelectItem>}
      <SelectItem value="soybean">Soja</SelectItem>
      <SelectItem value="corn">Milho</SelectItem>
    </SelectContent>
  </Select>
));
CommoditySelect.displayName = 'CommoditySelect';

/* ============================ A) PAINEL ============================ */

function PainelView({ onRegister }: { onRegister: (locationId: string, commodity: string) => void }) {
  const { data: rows = [], isLoading } = usePhysicalPricePanel();
  const { allLocations, locations } = useMyLocations();
  const [commodity, setCommodity] = useState(ALL);
  const [locationId, setLocationId] = useState(ALL);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    allLocations.forEach((l) => { m[l.id] = l.name; });
    return m;
  }, [allLocations]);

  const myIds = useMemo(() => new Set(locations.map((l) => l.id)), [locations]);

  useEffect(() => { triggerNormalize(); }, []);

  const visible = useMemo(
    () => rows.filter(
      (r) => (commodity === ALL || r.commodity === commodity) && (locationId === ALL || r.location_id === locationId),
    ),
    [rows, commodity, locationId],
  );

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Praça</Label>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {allLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Commodity</Label>
        <CommoditySelect value={commodity} onChange={setCommodity} />
      </div>
    </div>
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando painel…</p>;

  return (
    <div className="space-y-4">
      {filterBar}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum preço canônico publicado para o filtro selecionado.</p>
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Praça</TableHead>
                <TableHead>Commodity</TableHead>
                <TableHead className="text-right">Valor presente (R$/sc)</TableHead>
                <TableHead className="text-center">Referência</TableHead>
                <TableHead className="text-center">Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const key = `${r.location_id}-${r.commodity}`;
                const isOpen = expanded === key;
                return (
                  <Fragment key={key}>
                    <TableRow>
                      <TableCell className="py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={isOpen ? 'Ocultar cotações' : 'Ver cotações'}
                          onClick={() => setExpanded(isOpen ? null : key)}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{nameById[r.location_id] ?? r.location_id}</TableCell>
                      <TableCell>{COMMODITY_LABEL[r.commodity] ?? r.commodity}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(r.price_brl_per_sack)}</TableCell>
                      <TableCell className="text-center">{fmtDate(r.reference_date)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <FreshnessBadge referenceDate={r.reference_date} />
                          {r.pending && <Badge variant="outline" className="text-[10px] font-normal">calculando VP</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {myIds.has(r.location_id) && (
                          <Button variant="outline" size="sm" onClick={() => onRegister(r.location_id, r.commodity)}>
                            Nova cotação
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-3">
                          <QuotesOfDay
                            locationId={r.location_id}
                            commodity={r.commodity}
                            referenceDate={r.reference_date}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>


/* =========================== B) POR PRAÇA =========================== */

function PorPracaView() {
  const { locations } = useMyLocations();
  const [locationId, setLocationId] = useState('');
  const [commodity, setCommodity] = useState(ALL);
  const [showAll, setShowAll] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const commodityFilter = commodity === ALL ? null : commodity;
  const isAll = commodity === ALL;

  const daily = useDailySeries(locationId || null, commodityFilter, start || undefined, end || undefined);
  const quotes = useQuotes(showAll ? (locationId || null) : null, commodityFilter, start || undefined, end || undefined);

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
          <CommoditySelect value={commodity} onChange={setCommodity} />
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
        {locationId && !isAll && (
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
                    {isAll && <TableHead>Commodity</TableHead>}
                    <TableHead className="text-right">Valor presente (R$/sc)</TableHead>
                    <TableHead className="text-right">Calculado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(daily.data ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.reference_date)}</TableCell>
                      {isAll && <TableCell>{COMMODITY_LABEL[d.commodity] ?? d.commodity}</TableCell>}
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Todas as cotações</CardTitle>
            <p className="text-xs text-muted-foreground">
              O preço nominal não é comparável entre prazos distintos; use o valor presente.
            </p>
          </CardHeader>
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
                    {isAll && <TableHead>Commodity</TableHead>}
                    <TableHead>Comprador</TableHead>
                    <TableHead className="text-right">Nominal (R$/sc)</TableHead>
                    <TableHead className="text-center">Pagamento</TableHead>
                    <TableHead className="text-right">Valor presente (R$/sc)</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(quotes.data ?? []).map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{fmtDate(q.reference_date)}</TableCell>
                      {isAll && <TableCell>{COMMODITY_LABEL[q.commodity] ?? q.commodity}</TableCell>}
                      <TableCell className="font-medium">{q.buyer}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(Number(q.price_brl_per_sack))}</TableCell>
                      <TableCell className="text-center">{fmtDate(q.payment_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {q.present_value_brl == null
                          ? <Badge variant="outline" className="text-[10px] font-normal">calculando</Badge>
                          : fmtBRL(Number(q.present_value_brl))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{SOURCE_LABEL[q.source] ?? q.source}</TableCell>
                      <TableCell className="text-right"><DeleteQuoteButton id={q.id} /></TableCell>
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

/** Exclusão de cotação (soft delete no backend), com confirmação. */
function DeleteQuoteButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteQuote();

  const confirm = async () => {
    try {
      await del.mutateAsync(id);
      toast.success('Cotação excluída');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir a cotação');
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        aria-label="Excluir cotação"
        onClick={() => setOpen(true)}
        disabled={del.isPending}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta cotação?</AlertDialogTitle>
          <AlertDialogDescription>
            A cotação sai das telas, mas fica preservada e auditada. A série diária é refeita pela API.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* =========================== C) CALENDÁRIO =========================== */

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setHours(12, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function CalendarioView({ onPickDay }: { onPickDay: (locationId: string, commodity: string, date: string) => void }) {
  const { locations } = useMyLocations();
  const isMobile = useIsMobile();
  const now = new Date();
  const [locationId, setLocationId] = useState('');
  const [commodity, setCommodity] = useState(ALL);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const commodityFilter = commodity === ALL ? null : commodity;
  const isAll = commodity === ALL;

  const monthRange = monthBounds(cursor.year, cursor.month);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const range = isMobile ? { start: isoOf(weekStart), end: isoOf(weekEnd) } : monthRange;

  const { data: counts = {} } = useQuoteCounts(locationId || null, commodityFilter, range.start, range.end);

  const today = todayISO();

  const cellClass = (iso: string) => {
    const entry = counts[iso];
    const total = entry?.total ?? 0;
    if (total > 0) return 'border-primary/40 bg-primary/10 hover:bg-primary/20';
    if (isWeekendISO(iso) || iso > today) {
      return 'border-dashed border-border bg-muted/20 text-muted-foreground hover:bg-muted/40';
    }
    // dias úteis sem cotação: pior nível entre as commodities exigidas
    const needed = isAll ? ['soybean', 'corn'] : [commodity];
    const missing = needed.filter((c) => !(entry?.byCommodity[c]));
    if (missing.length === 0) return 'border-primary/40 bg-primary/10 hover:bg-primary/20';
    const level = freshnessLevel(iso);
    if (level === 2) return 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20';
    if (level === 1) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20';
    return 'border-dashed border-border bg-background hover:bg-muted/40';
  };

  const cellLabel = (iso: string) => {
    const entry = counts[iso];
    const total = entry?.total ?? 0;
    if (total === 0) return 'sem cotação';
    if (isAll) {
      const s = entry?.byCommodity.soybean ?? 0;
      const c = entry?.byCommodity.corn ?? 0;
      return `${total} cotaç${total > 1 ? 'ões' : 'ão'} · S${s}/M${c}`;
    }
    return `${total} cotaç${total > 1 ? 'ões' : 'ão'}`;
  };

  const DayCell = ({ iso, day }: { iso: string; day: number }) => (
    <button
      key={iso}
      type="button"
      disabled={!locationId}
      onClick={() => onPickDay(locationId, isAll ? 'soybean' : commodity, iso)}
      className={cn(
        'flex h-24 flex-col items-center justify-center gap-1 rounded-md border text-sm transition-colors sm:h-28',
        iso === today && 'ring-2 ring-primary/50',
        cellClass(iso),
      )}
    >
      <span className="text-lg font-semibold">{day}</span>
      <span className="px-1 text-[11px] leading-tight">{cellLabel(iso)}</span>
    </button>
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();

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
          <CommoditySelect value={commodity} onChange={setCommodity} />
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1">
          {isMobile ? (
            <>
              <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>Anterior</Button>
              <span className="min-w-[150px] text-center text-sm font-medium">
                {fmtDate(isoOf(weekStart))} – {fmtDate(isoOf(weekEnd))}
              </span>
              <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>Próxima</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>Anterior</Button>
              <span className="min-w-[150px] text-center text-sm font-medium">{MONTHS[cursor.month]} {cursor.year}</span>
              <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>Próximo</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="pb-1 text-center text-xs text-muted-foreground">{w}</div>
            ))}
            {isMobile
              ? Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + i);
                  const iso = isoOf(d);
                  return <DayCell key={iso} iso={iso} day={d.getDate()} />;
                })
              : (
                <>
                  {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    return <DayCell key={iso} iso={iso} day={day} />;
                  })}
                </>
              )}
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
