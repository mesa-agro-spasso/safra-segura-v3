import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, Filter, ArrowUpDown,
} from 'lucide-react';
import {
  useProducers, useDeleteProducer, useProducerOperationCounts,
  type ProducerOpCount,
} from '@/hooks/useProducers';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { ProducerFormDialog } from '@/components/producers/ProducerFormDialog';
import { ProducerOperationsList } from '@/components/producers/ProducerOperationsList';
import { ProducerDetailsDialog } from '@/components/producers/ProducerDetailsDialog';
import { StarRating } from '@/components/producers/StarRating';
import { toast } from 'sonner';
import type { Producer } from '@/types';
import { cn } from '@/lib/utils';

type SortKey =
  | 'full_name' | 'responsible_name' | 'warehouses' | 'credit_rating' | 'operations_count';
type SortDir = 'asc' | 'desc';

const TEXT_COLS: Array<{ key: SortKey; label: string; field: keyof Producer }> = [
  { key: 'full_name', label: 'Nome', field: 'full_name' },
  { key: 'responsible_name', label: 'Responsável', field: 'responsible_name' },
];

const Producers = () => {
  const { data: producers = [], isLoading } = useProducers();
  const { data: warehouses = [] } = useActiveArmazens();
  const { data: opCounts = {} } = useProducerOperationCounts();
  const del = useDeleteProducer();
  

  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [textFilters, setTextFilters] = useState<Record<string, string>>({});
  const [warehouseFilter, setWarehouseFilter] = useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = useState<Array<number | 'none'>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producer | null>(null);
  const [detailsOf, setDetailsOf] = useState<Producer | null>(null);

  const warehouseMap = useMemo(
    () => Object.fromEntries(warehouses.map((w) => [w.id, w.display_name])),
    [warehouses],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const getCount = (id: string): ProducerOpCount => opCounts[id] ?? { active: 0, total: 0 };

  const filtered = useMemo(() => {
    return producers.filter((p) => {
      for (const col of TEXT_COLS) {
        const f = textFilters[col.key];
        if (f && f.trim()) {
          const val = (p[col.field] as string | null) ?? '';
          if (!val.toLowerCase().includes(f.toLowerCase())) return false;
        }
      }
      if (warehouseFilter.length > 0) {
        const ids = p.warehouse_ids ?? [];
        if (!warehouseFilter.some((w) => ids.includes(w))) return false;
      }
      if (ratingFilter.length > 0) {
        const r = p.credit_rating;
        const matches = ratingFilter.some((rf) => rf === 'none' ? r === null : r === rf);
        if (!matches) return false;
      }
      return true;
    });
  }, [producers, textFilters, warehouseFilter, ratingFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: any; let bv: any;
      if (sortKey === 'warehouses') {
        av = (a.warehouse_ids ?? []).length;
        bv = (b.warehouse_ids ?? []).length;
      } else if (sortKey === 'operations_count') {
        av = getCount(a.id).total;
        bv = getCount(b.id).total;
      } else if (sortKey === 'credit_rating') {
        av = a.credit_rating; bv = b.credit_rating;
      } else {
        av = (a[sortKey as keyof Producer] as string | null) ?? '';
        bv = (b[sortKey as keyof Producer] as string | null) ?? '';
      }
      const aNull = av === null || av === '' || av === undefined;
      const bNull = bv === null || bv === '' || bv === undefined;
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (aNull && bNull) return 0;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'pt-BR') * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir, opCounts]);

  const SortIcon = ({ k }: { k: SortKey }) => (
    sortKey === k ? (
      sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />
    ) : <ArrowUpDown className="h-3 w-3 inline opacity-40" />
  );

  const TextHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <div className="flex items-center gap-1">
      <button onClick={() => handleSort(k)} className="hover:text-foreground flex items-center gap-1">
        {label} <SortIcon k={k} />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn('hover:text-foreground', textFilters[k] && 'text-primary')}>
            <Filter className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          <Input
            placeholder={`Filtrar ${label.toLowerCase()}…`}
            value={textFilters[k] ?? ''}
            onChange={(e) => setTextFilters({ ...textFilters, [k]: e.target.value })}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  const handleDelete = async (p: Producer) => {
    try {
      await del.mutateAsync(p.id);
      toast.success('Produtor excluído');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir');
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Produtores</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo produtor
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                {TEXT_COLS.map((c) => (
                  <TableHead key={c.key}><TextHeader k={c.key} label={c.label} /></TableHead>
                ))}
                <TableHead>
                  <button onClick={() => handleSort('operations_count')} className="hover:text-foreground flex items-center gap-1">
                    Operações <SortIcon k="operations_count" />
                  </button>
                </TableHead>

                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('warehouses')} className="hover:text-foreground flex items-center gap-1">
                      Praças <SortIcon k="warehouses" />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn('hover:text-foreground', warehouseFilter.length > 0 && 'text-primary')}>
                          <Filter className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 space-y-2 max-h-72 overflow-y-auto">
                        {warehouses.map((w) => (
                          <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={warehouseFilter.includes(w.id)}
                              onCheckedChange={(c) => setWarehouseFilter(c
                                ? [...warehouseFilter, w.id]
                                : warehouseFilter.filter((x) => x !== w.id))}
                            />
                            {w.display_name}
                          </label>
                        ))}
                        {warehouseFilter.length > 0 && (
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => setWarehouseFilter([])}>Limpar</Button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSort('credit_rating')} className="hover:text-foreground flex items-center gap-1">
                      Nota <SortIcon k="credit_rating" />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn('hover:text-foreground', ratingFilter.length > 0 && 'text-primary')}>
                          <Filter className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-3 space-y-2">
                        {[1, 2, 3].map((n) => (
                          <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={ratingFilter.includes(n)}
                              onCheckedChange={(c) => setRatingFilter(c
                                ? [...ratingFilter, n]
                                : ratingFilter.filter((x) => x !== n))}
                            />
                            {n} estrela{n > 1 ? 's' : ''}
                          </label>
                        ))}
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={ratingFilter.includes('none')}
                            onCheckedChange={(c) => setRatingFilter(c
                              ? [...ratingFilter, 'none']
                              : ratingFilter.filter((x) => x !== 'none'))}
                          />
                          Sem nota
                        </label>
                        {ratingFilter.length > 0 && (
                          <Button variant="ghost" size="sm" className="w-full" onClick={() => setRatingFilter([])}>Limpar</Button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && sorted.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {producers.length === 0 ? 'Nenhum produtor cadastrado.' : 'Nenhum produtor corresponde aos filtros.'}
                </TableCell></TableRow>
              )}
              {sorted.map((p) => {
                const isOpen = expandedId === p.id;
                const c = getCount(p.id);
                return (
                  <Collapsible key={p.id} open={isOpen} asChild>
                    <>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setDetailsOf(p)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <CollapsibleTrigger asChild>
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedId(isOpen ? null : p.id)}
                            >
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">{p.full_name ?? '—'}</TableCell>

                        <TableCell>{p.responsible_name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={c.active > 0 ? 'default' : 'secondary'} className="font-mono">
                            {c.active}/{c.total}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(p.warehouse_ids ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
                            {(p.warehouse_ids ?? []).map((wid) => (
                              <Badge key={wid} variant="secondary" className="text-xs">
                                {warehouseMap[wid] ?? wid}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StarRating value={p.credit_rating} readOnly />

                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir produtor?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {c.total > 0
                                      ? `Este produtor está vinculado a ${c.total} operação(ões). As operações continuarão existindo, mas perderão o vínculo.`
                                      : 'Esta ação não pode ser desfeita.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(p)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="p-0">
                            <ProducerOperationsList producerId={p.id} />
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProducerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        producer={editing}
      />
      <ProducerDetailsDialog
        open={!!detailsOf}
        onOpenChange={(o) => { if (!o) setDetailsOf(null); }}
        producer={detailsOf}
        onEdit={(p) => { setDetailsOf(null); setEditing(p); setFormOpen(true); }}
      />
    </div>
  );
};

export default Producers;
