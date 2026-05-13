import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Edit2, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouses, useUpsertWarehouse, useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingCombinations, useUpsertPricingCombination, useTogglePricingCombinationActive, useDeletePricingCombination } from '@/hooks/usePricingCombinations';
import { useMarketData } from '@/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { usePricingParameters, useUpdatePricingParameter } from '@/hooks/usePricingParameters';
import type { Warehouse, PricingCombination, PricingParameter } from '@/types';

const emptyWarehouse: Partial<Warehouse> & { id: string } = {
  id: '', display_name: '', city: '', state: '', type: 'ARMAZEM', active: true,
  basis_config: {}, abbr: '',
  interest_rate: null, interest_rate_period: 'monthly',
  storage_cost: null, storage_cost_type: 'fixed',
  reception_cost: null,
  brokerage_per_contract_cbot: null, brokerage_per_contract_b3: null,
  desk_cost_pct: null, shrinkage_rate_monthly: null,
};

function WarehousesTab() {
  const { data: warehouses, isLoading } = useWarehouses();
  const upsertWarehouse = useUpsertWarehouse();
  const [editing, setEditing] = useState<(Partial<Warehouse> & { id: string }) | null>(null);
  const [open, setOpen] = useState(false);
  const [abbrError, setAbbrError] = useState('');

  const queryClient = useQueryClient();
  const isExisting = !!editing?.id && !!warehouses?.some((w) => w.id === editing.id);

  const handleDelete = async () => {
    if (!editing?.id) return;
    try {
      const { error } = await supabase.from('warehouses').delete().eq('id', editing.id);
      if (error) throw error;
      toast.success('Armazém excluído');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setOpen(false);
      setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir';
      if (msg.includes('foreign key') || msg.includes('violates') || msg.includes('23503')) {
        toast.error('Não é possível excluir: existem registros vinculados a este armazém.');
      } else {
        toast.error(msg);
      }
    }
  };

  const handleSave = async () => {
    if (!editing?.id || !editing?.display_name) { toast.error('ID e nome são obrigatórios'); return; }
    const abbr = editing.abbr ?? '';
    if (!/^[A-Z]{2,5}$/.test(abbr)) {
      setAbbrError('2 a 5 letras maiúsculas');
      return;
    }
    setAbbrError('');
    try {
      await upsertWarehouse.mutateAsync({
        id: editing.id, display_name: editing.display_name,
        city: editing.city ?? null, state: editing.state ?? null,
        type: editing.type ?? 'ARMAZEM', active: editing.active ?? true,
        basis_config: editing.basis_config ?? {}, abbr,
        interest_rate: editing.interest_rate ?? null,
        interest_rate_period: editing.interest_rate_period ?? 'monthly',
        storage_cost: editing.storage_cost ?? null,
        storage_cost_type: editing.storage_cost_type ?? 'fixed',
        reception_cost: editing.reception_cost ?? null,
        brokerage_per_contract_cbot: editing.brokerage_per_contract_cbot ?? null,
        brokerage_per_contract_b3: editing.brokerage_per_contract_b3 ?? null,
        desk_cost_pct: editing.desk_cost_pct ?? null,
        shrinkage_rate_monthly: editing.shrinkage_rate_monthly ?? null,
      });
      toast.success('Armazém salvo'); setOpen(false); setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.error(`Abreviação '${abbr}' já está em uso por outro armazém`);
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAbbrError(''); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ...emptyWarehouse })}><Plus className="mr-2 h-4 w-4" /> Novo Armazém</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id && warehouses?.some((w) => w.id === editing.id) ? 'Editar Armazém' : 'Novo Armazém'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

                {/* Identificação */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ID (slug)</Label>
                    <Input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                      disabled={!!warehouses?.some((w) => w.id === editing.id)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input value={editing.display_name ?? ''} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Abreviação</Label>
                    <Input value={editing.abbr ?? ''} onChange={(e) => { setEditing({ ...editing, abbr: e.target.value.toUpperCase() }); setAbbrError(''); }}
                      placeholder="Ex: CON" maxLength={5} />
                    <p className="text-[10px] text-muted-foreground">2 a 5 letras maiúsculas.</p>
                    {abbrError && <p className="text-[10px] text-destructive">{abbrError}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Input value={editing.state ?? ''} onChange={(e) => setEditing({ ...editing, state: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Input value={editing.type ?? ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  <Label className="text-xs">Ativo</Label>
                </div>

                {/* Basis Config */}
                <div className="border rounded-md p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basis por Commodity (BRL/saca)</p>
                  {(['soybean', 'corn'] as const).map((commodity) => {
                    const label = commodity === 'soybean' ? 'Soja (CBOT)' : 'Milho (B3)';
                    const cfg = (editing.basis_config as any)?.[commodity];
                    const isRef = cfg?.mode === 'reference_delta';
                    return (
                      <div key={commodity} className="space-y-1">
                        <Label className="text-xs font-medium">{label}</Label>
                        {!isRef ? (
                          <>
                            <Input type="number" step="any" placeholder={commodity === 'soybean' ? 'ex: -29' : 'ex: -25'}
                              value={cfg?.value ?? ''}
                              onChange={(e) => setEditing({
                                ...editing,
                                basis_config: {
                                  ...(editing.basis_config ?? {}),
                                  [commodity]: { mode: 'fixed', value: e.target.value === '' ? null : Number(e.target.value) },
                                },
                              })} />
                            <button type="button" className="text-[10px] text-primary hover:underline"
                              onClick={() => setEditing({
                                ...editing,
                                basis_config: {
                                  ...(editing.basis_config ?? {}),
                                  [commodity]: { mode: 'reference_delta', reference_warehouse_id: '', delta_brl: 0 },
                                },
                              })}>
                              Usar referência de outro armazém
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Armazém referência</Label>
                                <Select value={cfg?.reference_warehouse_id ?? ''}
                                  onValueChange={(v) => setEditing({
                                    ...editing,
                                    basis_config: {
                                      ...(editing.basis_config ?? {}),
                                      [commodity]: { ...cfg, reference_warehouse_id: v },
                                    },
                                  })}>
                                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                  <SelectContent>
                                    {warehouses?.filter((w) => w.id !== editing.id).map((w) => (
                                      <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Delta (BRL/saca)</Label>
                                <Input type="number" step="any" placeholder="ex: -1"
                                  value={cfg?.delta_brl ?? ''}
                                  onChange={(e) => setEditing({
                                    ...editing,
                                    basis_config: {
                                      ...(editing.basis_config ?? {}),
                                      [commodity]: { ...cfg, delta_brl: e.target.value === '' ? 0 : Number(e.target.value) },
                                    },
                                  })} />
                              </div>
                            </div>
                            <button type="button" className="text-[10px] text-primary hover:underline"
                              onClick={() => setEditing({
                                ...editing,
                                basis_config: {
                                  ...(editing.basis_config ?? {}),
                                  [commodity]: { mode: 'fixed', value: null },
                                },
                              })}>
                              Usar valor fixo
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Custos padrão */}
                <div className="border rounded-md p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custos Padrão do Armazém</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Custo armazenagem (R$/sc)</Label>
                      <Input type="number" step="any" placeholder="ex: 3.5"
                        value={editing.storage_cost ?? ''}
                        onChange={(e) => setEditing({ ...editing, storage_cost: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo armazenagem</Label>
                      <Select value={editing.storage_cost_type ?? 'fixed'}
                        onValueChange={(v) => setEditing({ ...editing, storage_cost_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixo (R$/saca)</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Taxa de juros (%)</Label>
                      <Input type="number" step="any" placeholder="ex: 1.4"
                        value={editing.interest_rate ?? ''}
                        onChange={(e) => setEditing({ ...editing, interest_rate: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Período</Label>
                      <Select value={editing.interest_rate_period ?? 'monthly'}
                        onValueChange={(v) => setEditing({ ...editing, interest_rate_period: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal (a.m.)</SelectItem>
                          <SelectItem value="yearly">Anual (a.a.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Corretagem CBOT (USD/contrato)</Label>
                      <Input type="number" step="any" placeholder="ex: 15"
                        value={editing.brokerage_per_contract_cbot ?? ''}
                        onChange={(e) => setEditing({ ...editing, brokerage_per_contract_cbot: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Corretagem B3 (BRL/contrato)</Label>
                      <Input type="number" step="any" placeholder="ex: 12"
                        value={editing.brokerage_per_contract_b3 ?? ''}
                        onChange={(e) => setEditing({ ...editing, brokerage_per_contract_b3: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo mesa (%)</Label>
                      <Input type="number" step="any" placeholder="ex: 0.003"
                        value={editing.desk_cost_pct ?? ''}
                        onChange={(e) => setEditing({ ...editing, desk_cost_pct: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quebra mensal (%)</Label>
                      <Input type="number" step="any" placeholder="ex: 0.003"
                        value={editing.shrinkage_rate_monthly ?? ''}
                        onChange={(e) => setEditing({ ...editing, shrinkage_rate_monthly: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo recepção (R$/sc)</Label>
                      <Input type="number" step="any" placeholder="ex: 0"
                        value={editing.reception_cost ?? ''}
                        onChange={(e) => setEditing({ ...editing, reception_cost: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full">Salvar</Button>

                {isExisting && (
                  <div className="border-t pt-4 mt-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir Armazém
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir armazém?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação é permanente. O armazém <strong>{editing?.display_name}</strong> será removido.
                            Se houver operações, ordens ou outros registros vinculados, a exclusão falhará.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Armazéns</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Abreviação</TableHead><TableHead>Cidade</TableHead><TableHead>Estado</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {warehouses?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.display_name}</TableCell>
                    <TableCell className="font-mono text-xs">{(w as any).abbr ?? '-'}</TableCell>
                    <TableCell>{w.city ?? '-'}</TableCell><TableCell>{w.state ?? '-'}</TableCell>
                    <TableCell>{w.type}</TableCell><TableCell>{w.active ? '✅ Ativo' : '❌ Inativo'}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => { setEditing({ ...w } as Partial<Warehouse> & { id: string }); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const emptyCombination: Partial<PricingCombination> = {
  warehouse_id: '', commodity: 'soybean', benchmark: 'cbot', ticker: '', exp_date: null,
  sale_date: '', payment_date: null, is_spot: false, grain_reception_date: null,
  target_basis: 0, additional_discount_brl: 0, active: true,
  interest_rate: null, storage_cost: null, storage_cost_type: null, reception_cost: null,
  brokerage_per_contract: null, desk_cost_pct: null, shrinkage_rate_monthly: null,
};

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const date = value ? new Date(value + 'T12:00:00') : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : 'Selecione'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : null)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CombinationsTab() {
  const { data: combinations, isLoading } = usePricingCombinations();
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const upsert = useUpsertPricingCombination();
  const toggleActive = useTogglePricingCombinationActive();
  const deleteCombination = useDeletePricingCombination();
  const [editing, setEditing] = useState<Partial<PricingCombination> | null>(null);
  const [open, setOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);

  const warehouseMap = useMemo(() => {
    const m: Record<string, string> = {};
    warehouses?.forEach((w) => { m[w.id] = w.display_name; });
    return m;
  }, [warehouses]);

  const filtered = useMemo(() => {
    if (!combinations) return [];
    return showActiveOnly ? combinations.filter((c) => c.active) : combinations;
  }, [combinations, showActiveOnly]);

  const handleSave = async () => {
    if (!editing?.warehouse_id || !editing?.ticker || !editing?.sale_date) {
      toast.error('Armazém, ticker e data de venda são obrigatórios'); return;
    }
    try {
      await upsert.mutateAsync(editing);
      toast.success('Combinação salva'); setOpen(false); setEditing(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao salvar'); }
  };

  const numField = (label: string, key: keyof PricingCombination, placeholder = 'Herdar do armazém') => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" step="any" placeholder={placeholder}
        value={editing?.[key] != null ? String(editing[key]) : ''}
        onChange={(e) => setEditing({ ...editing!, [key]: e.target.value === '' ? null : Number(e.target.value) })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
          <Label className="text-xs">Apenas ativos</Label>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCostsOpen(false); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing({ ...emptyCombination }); setCostsOpen(false); }}>
              <Plus className="mr-2 h-4 w-4" /> Nova Combinação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.id ? 'Editar Combinação' : 'Nova Combinação'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Armazém</Label>
                    <Select value={editing.warehouse_id ?? ''} onValueChange={(v) => setEditing({ ...editing, warehouse_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Commodity</Label>
                    <Select value={editing.commodity ?? 'soybean'} onValueChange={(v) => {
                      const updates: Record<string, unknown> = { ...editing, commodity: v, ticker: '' };
                      if (v === 'soybean' && editing.benchmark === 'b3') updates.benchmark = 'cbot';
                      setEditing(updates as typeof editing);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="soybean">Soja (soybean)</SelectItem><SelectItem value="corn">Milho (corn)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Benchmark</Label>
                    <Select value={editing.benchmark ?? 'cbot'} onValueChange={(v) => setEditing({ ...editing, benchmark: v, ticker: '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cbot">CBOT</SelectItem>
                        {(editing.commodity ?? 'soybean') !== 'soybean' && <SelectItem value="b3">B3</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ticker</Label>
                    <Select value={editing.ticker ?? ''} onValueChange={(v) => setEditing({ ...editing, ticker: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o ticker" /></SelectTrigger>
                      <SelectContent>
                        {marketData
                          ?.filter((m) => {
                            const commodity = editing.commodity ?? 'soybean';
                            const benchmark = editing.benchmark ?? 'cbot';
                            if (commodity === 'soybean' && benchmark === 'cbot') return m.commodity === 'SOJA';
                            if (commodity === 'corn' && benchmark === 'cbot') return m.commodity === 'MILHO_CBOT';
                            if (commodity === 'corn' && benchmark === 'b3') return m.commodity === 'MILHO';
                            return false;
                          })
                          .sort((a, b) => (a.exp_date ?? '').localeCompare(b.exp_date ?? ''))
                          .map((m) => (
                            <SelectItem key={m.ticker} value={m.ticker}>{m.ticker}{m.exp_date ? ` (${m.exp_date})` : ''}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Exp Date (opcional — fallback market_data)</Label>
                  <Input value={editing.exp_date ?? ''} onChange={(e) => setEditing({ ...editing, exp_date: e.target.value || null })} placeholder="2026-08-14" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DateField label="Data de venda" value={editing.sale_date ?? null} onChange={(v) => setEditing({ ...editing, sale_date: v ?? '' })} />
                  <DateField label="Recepção de grão (opcional)" value={editing.grain_reception_date ?? null} onChange={(v) => setEditing({ ...editing, grain_reception_date: v })} />
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_spot ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_spot: v, payment_date: v ? null : editing.payment_date })} />
                  <Label className="text-xs">Spot (pagamento = próxima terça)</Label>
                </div>

                {!editing.is_spot && (
                  <DateField label="Data de pagamento" value={editing.payment_date ?? null} onChange={(v) => setEditing({ ...editing, payment_date: v })} />
                )}

                <div className="grid grid-cols-2 gap-3">
                  {numField('Target Basis', 'target_basis', '0')}
                  {numField('Desconto adicional (BRL)', 'additional_discount_brl', '0')}
                </div>

                <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between text-xs text-muted-foreground">
                      Sobrescrever custos do armazém
                      <ChevronDown className={cn('h-4 w-4 transition-transform', costsOpen && 'rotate-180')} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      {numField('Taxa de juros', 'interest_rate')}
                      {numField('Custo armazenagem', 'storage_cost')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo armazenagem</Label>
                        <Select value={editing.storage_cost_type ?? 'inherit'} onValueChange={(v) => setEditing({ ...editing, storage_cost_type: v === 'inherit' ? null : v })}>
                          <SelectTrigger><SelectValue placeholder="Herdar do armazém" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">Herdar do armazém</SelectItem>
                            <SelectItem value="fixed">Fixo (R$/saca)</SelectItem>
                            <SelectItem value="monthly">Mensal (R$/mês)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {numField('Custo recepção', 'reception_cost')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {numField('Corretagem/contrato', 'brokerage_per_contract')}
                      {numField('Custo mesa (%)', 'desk_cost_pct')}
                    </div>
                    {numField('Quebra mensal (%)', 'shrinkage_rate_monthly')}
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex items-center gap-2">
                  <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  <Label className="text-xs">Ativa</Label>
                </div>

                <Button onClick={handleSave} className="w-full" disabled={upsert.isPending}>Salvar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Combinações ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Armazém</TableHead><TableHead>Commodity</TableHead><TableHead>Ticker</TableHead>
                    <TableHead>Benchmark</TableHead><TableHead>Venda</TableHead><TableHead>Pagamento</TableHead>
                    <TableHead>Basis</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className={cn(!c.active && 'opacity-50')}>
                      <TableCell className="font-medium">{warehouseMap[c.warehouse_id] || c.warehouse_id}</TableCell>
                      <TableCell>{c.commodity}</TableCell>
                      <TableCell>{c.ticker}</TableCell>
                      <TableCell>{c.benchmark}</TableCell>
                      <TableCell>{c.sale_date}</TableCell>
                      <TableCell>{c.is_spot ? '📍 Spot' : c.payment_date ?? '-'}</TableCell>
                      <TableCell>{c.target_basis}</TableCell>
                      <TableCell>
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: c.id, active: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...c }); setOpen(true); setCostsOpen(false); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir combinação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação é permanente. A combinação {warehouseMap[c.warehouse_id] || c.warehouse_id} / {c.commodity} / {c.ticker} será removida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => {
                                    try {
                                      await deleteCombination.mutateAsync(c.id);
                                      toast.success('Combinação excluída');
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
                                    }
                                  }}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma combinação {showActiveOnly ? 'ativa ' : ''}cadastrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ParametersTab() {
  const { data: parameters, isLoading } = usePricingParameters();
  const updateParameter = useUpdatePricingParameter();
  const [values, setValues] = useState<Record<string, string>>({});

  const getLabel = (id: string) => id === 'soybean_cbot' ? 'Soja CBOT' : 'Milho B3';

  const handleSave = async (id: string) => {
    const raw = values[id];
    if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
    const sigma = parseFloat(raw);
    if (isNaN(sigma) || sigma <= 0 || sigma > 2) { toast.error('Sigma deve ser entre 0 e 2 (ex: 0.25)'); return; }
    try {
      const currentParam = parameters?.find(p => p.id === id);
      await updateParameter.mutateAsync({ id, sigma, target_profit_brl_per_sack: currentParam?.target_profit_brl_per_sack ?? 2.0, execution_spread_pct: currentParam?.execution_spread_pct ?? 0.05 });
      toast.success(`Sigma ${getLabel(id)} atualizado`);
      setValues((v) => { const n = { ...v }; delete n[id]; return n; });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Volatilidade Implícita (sigma)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Usado no modelo Black-76 para precificação teórica de opções. Valor decimal — ex: 0.25 = 25%.</p>
          {parameters?.map((p) => (
            <div key={p.id} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{getLabel(p.id)}</Label>
                <Input type="number" step="0.01" placeholder={`ex: ${p.sigma}`}
                  value={values[p.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">Atual: {(p.sigma * 100).toFixed(0)}%</p>
              </div>
              <Button size="sm" onClick={() => handleSave(p.id)} disabled={updateParameter.isPending}>
                Salvar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Lucro Alvo por Saca</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Preço físico alvo = break-even + lucro alvo. Usado na aba MTM para mostrar o preço do físico necessário para atingir o lucro desejado.</p>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Lucro alvo (R$/sc)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={String(parameters?.[0]?.target_profit_brl_per_sack ?? 2.0)}
                value={values['target_profit'] ?? (parameters?.[0]?.target_profit_brl_per_sack ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, target_profit: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Atual: R$ {(parameters?.[0]?.target_profit_brl_per_sack ?? 2.0).toFixed(2)}/sc</p>
            </div>
            <Button
              size="sm"
              disabled={updateParameter.isPending}
              onClick={async () => {
                const raw = values['target_profit'];
                if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
                const val = parseFloat(raw);
                if (isNaN(val) || val < 0) { toast.error('Valor deve ser >= 0'); return; }
                try {
                  for (const p of parameters ?? []) {
                    await updateParameter.mutateAsync({ id: p.id, sigma: p.sigma, target_profit_brl_per_sack: val, execution_spread_pct: p.execution_spread_pct ?? 0.05 });
                  }
                  toast.success('Lucro alvo atualizado');
                  setValues((v) => { const n = { ...v }; delete n['target_profit']; return n; });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
                }
              }}
            >
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Spread de Execução</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Folga aplicada ao break-even e ao físico alvo para compensar o deslizamento na execução das ordens. Valor decimal — ex: 0.05 = 5%.</p>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Spread de execução (decimal)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={String(parameters?.[0]?.execution_spread_pct ?? 0.05)}
                value={values['execution_spread'] ?? (parameters?.[0]?.execution_spread_pct ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, execution_spread: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Atual: {((parameters?.[0]?.execution_spread_pct ?? 0.05) * 100).toFixed(0)}%</p>
            </div>
            <Button
              size="sm"
              disabled={updateParameter.isPending}
              onClick={async () => {
                const raw = values['execution_spread'];
                if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
                const val = parseFloat(raw);
                if (isNaN(val) || val < 0 || val > 1) { toast.error('Valor deve ser entre 0 e 1 (ex: 0.05 para 5%)'); return; }
                try {
                  for (const p of parameters ?? []) {
                    await updateParameter.mutateAsync({
                      id: p.id,
                      sigma: p.sigma,
                      target_profit_brl_per_sack: p.target_profit_brl_per_sack,
                      execution_spread_pct: val,
                    });
                  }
                  toast.success('Spread de execução atualizado');
                  setValues((v) => { const n = { ...v }; delete n['execution_spread']; return n; });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
                }
              }}
            >
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Quantidade de Contratos por Mercado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Define quantos vencimentos (tickers) são buscados e exibidos nas tabelas de Soja CBOT, Milho CBOT e Milho B3.</p>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Soja & Milho CBOT</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max="24"
                placeholder={String(parameters?.[0]?.cbot_ticker_count ?? 5)}
                value={values['cbot_qty'] ?? (parameters?.[0]?.cbot_ticker_count ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, cbot_qty: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Atual: {parameters?.[0]?.cbot_ticker_count ?? 5}</p>
            </div>
            <Button
              size="sm"
              disabled={updateParameter.isPending}
              onClick={async () => {
                const raw = values['cbot_qty'];
                if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
                const val = parseInt(raw, 10);
                if (isNaN(val) || val < 1 || val > 24) { toast.error('Valor entre 1 e 24'); return; }
                try {
                  for (const p of parameters ?? []) {
                    await updateParameter.mutateAsync({ id: p.id, sigma: p.sigma, cbot_ticker_count: val });
                  }
                  toast.success('Quantidade CBOT atualizada');
                  setValues((v) => { const n = { ...v }; delete n['cbot_qty']; return n; });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
                }
              }}
            >Salvar</Button>
          </div>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Milho B3</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max="24"
                placeholder={String(parameters?.[0]?.b3_corn_ticker_count ?? 10)}
                value={values['b3_qty'] ?? (parameters?.[0]?.b3_corn_ticker_count ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, b3_qty: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Atual: {parameters?.[0]?.b3_corn_ticker_count ?? 10}</p>
            </div>
            <Button
              size="sm"
              disabled={updateParameter.isPending}
              onClick={async () => {
                const raw = values['b3_qty'];
                if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
                const val = parseInt(raw, 10);
                if (isNaN(val) || val < 1 || val > 24) { toast.error('Valor entre 1 e 24'); return; }
                try {
                  for (const p of parameters ?? []) {
                    await updateParameter.mutateAsync({ id: p.id, sigma: p.sigma, b3_corn_ticker_count: val });
                  }
                  toast.success('Quantidade Milho B3 atualizada');
                  setValues((v) => { const n = { ...v }; delete n['b3_qty']; return n; });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
                }
              }}
            >Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlcadasTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [thresholdX, setThresholdX] = useState('');
  const [thresholdY, setThresholdY] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: policy, isLoading } = useQuery({
    queryKey: ['approval-policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_policies')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (policy) {
      setThresholdX(String(policy.threshold_x_tons));
      setThresholdY(String(Number(policy.threshold_x_tons) + Number(policy.threshold_y_tons)));
    }
  }, [policy]);

  const isAdmin = profile?.is_admin === true;

  const handleSave = async () => {
    if (!policy) return;
    const x = Number(thresholdX);
    const y = Number(thresholdY);
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
      toast.error('Os valores devem ser números maiores ou iguais a zero');
      return;
    }
    if (y <= x) {
      toast.error('O limite da Faixa 2 deve ser maior que o da Faixa 1');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('approval_policies')
        .update({ threshold_x_tons: x, threshold_y_tons: y - x })
        .eq('id', policy.id);
      if (error) throw error;
      toast.success('Alçadas atualizadas');
      queryClient.invalidateQueries({ queryKey: ['approval-policy'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Alçadas de Aprovação</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Define os limites de volume (em toneladas) que determinam quais funções precisam assinar cada operação.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!policy ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma política ativa configurada. Insira uma linha em <code className="text-xs">approval_policies</code> com <code className="text-xs">is_active=true</code> para começar.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              <div className="space-y-1">
                <Label className="text-xs">Faixa 1 até (toneladas)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={thresholdX}
                  onChange={(e) => setThresholdX(e.target.value)}
                  disabled={!isAdmin}
                />
                <p className="text-[10px] text-muted-foreground">
                  Operações até este volume exigem aprovação da Faixa 1.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Faixa 2 até (toneladas)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={thresholdY}
                  onChange={(e) => setThresholdY(e.target.value)}
                  disabled={!isAdmin}
                />
                <p className="text-[10px] text-muted-foreground">
                  Limite superior da Faixa 2 — deve ser maior que o valor da Faixa 1.
                </p>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Composição das alçadas
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Até {thresholdX || 'X'} ton:</span> Mesa + Comercial N1 + Comercial N2 + Financeiro N1
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">De {thresholdX || 'X'}+1 até {thresholdY || 'Y'} ton:</span> Mesa + Comercial N1 + 2× Comercial N2 + Financeiro N1 + Financeiro N2
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Acima de {thresholdY || 'Y'} ton:</span> Mesa + Comercial N1 + Presidência + Financeiro N1 + Financeiro N2
              </p>
            </div>

            {isAdmin ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Somente administradores podem editar as alçadas.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type SettingsTab = 'warehouses' | 'combinations' | 'parameters' | 'alcadas';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs: SettingsTab[] = [
    'warehouses',
    'combinations',
    'parameters',
    ...(FEATURES.AUTHORIZATION_TIERS ? (['alcadas'] as const) : []),
  ];
  const defaultTab: SettingsTab = visibleTabs[0];

  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const tab: SettingsTab =
    tabParam && visibleTabs.includes(tabParam) ? tabParam : defaultTab;

  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Configurações</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="warehouses">Armazéns</TabsTrigger>
          <TabsTrigger value="combinations">Combinações</TabsTrigger>
          <TabsTrigger value="parameters">Parâmetros</TabsTrigger>
          {visibleTabs.includes('alcadas') && (
            <TabsTrigger value="alcadas">Alçadas</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="warehouses"><WarehousesTab /></TabsContent>
        <TabsContent value="combinations"><CombinationsTab /></TabsContent>
        <TabsContent value="parameters"><ParametersTab /></TabsContent>
        {visibleTabs.includes('alcadas') && (
          <TabsContent value="alcadas"><AlcadasTab /></TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
