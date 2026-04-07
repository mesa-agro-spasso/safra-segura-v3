import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Edit2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouses, useUpsertWarehouse, useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingCombinations, useUpsertPricingCombination, useTogglePricingCombinationActive } from '@/hooks/usePricingCombinations';
import { useMarketData } from '@/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import type { Warehouse, PricingCombination } from '@/types';

const emptyWarehouse: Partial<Warehouse> & { id: string } = {
  id: '', display_name: '', city: '', state: '', type: 'ARMAZEM', active: true, basis_config: {},
};

function WarehousesTab() {
  const { data: warehouses, isLoading } = useWarehouses();
  const upsertWarehouse = useUpsertWarehouse();
  const [editing, setEditing] = useState<(Partial<Warehouse> & { id: string }) | null>(null);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    if (!editing?.id || !editing?.display_name) { toast.error('ID e nome são obrigatórios'); return; }
    try {
      await upsertWarehouse.mutateAsync({
        id: editing.id, display_name: editing.display_name,
        city: editing.city ?? null, state: editing.state ?? null,
        type: editing.type ?? 'ARMAZEM', active: editing.active ?? true,
        basis_config: editing.basis_config ?? {},
      });
      toast.success('Armazém salvo'); setOpen(false); setEditing(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao salvar'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ...emptyWarehouse })}><Plus className="mr-2 h-4 w-4" /> Novo Armazém</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id && warehouses?.some((w) => w.id === editing.id) ? 'Editar Armazém' : 'Novo Armazém'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">ID (slug)</Label><Input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} disabled={!!warehouses?.some((w) => w.id === editing.id)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={editing.display_name ?? ''} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Cidade</Label><Input value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Estado</Label><Input value={editing.state ?? ''} onChange={(e) => setEditing({ ...editing, state: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Tipo</Label><Input value={editing.type ?? ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label className="text-xs">Ativo</Label></div>
                <div className="space-y-1"><Label className="text-xs">Basis Config (JSON)</Label><Input value={JSON.stringify(editing.basis_config ?? {})} onChange={(e) => { try { setEditing({ ...editing, basis_config: JSON.parse(e.target.value) }); } catch {} }} /></div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
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
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cidade</TableHead><TableHead>Estado</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {warehouses?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.display_name}</TableCell>
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
  const [editing, setEditing] = useState<Partial<PricingCombination> | null>(null);
  const [open, setOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
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
                    <Select value={editing.commodity ?? 'soybean'} onValueChange={(v) => setEditing({ ...editing, commodity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="soybean">Soja (soybean)</SelectItem><SelectItem value="corn">Milho (corn)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Benchmark</Label>
                    <Select value={editing.benchmark ?? 'cbot'} onValueChange={(v) => setEditing({ ...editing, benchmark: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cbot">CBOT</SelectItem><SelectItem value="b3">B3</SelectItem></SelectContent>
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
                            if (commodity === 'soybean') return m.commodity === 'SOJA';
                            if (commodity === 'corn') return m.commodity === 'MILHO_CBOT';
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
                        <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...c }); setOpen(true); setCostsOpen(false); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
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

const Settings = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Configurações</h2>
    <Tabs defaultValue="warehouses">
      <TabsList>
        <TabsTrigger value="warehouses">Armazéns</TabsTrigger>
        <TabsTrigger value="combinations">Combinações</TabsTrigger>
      </TabsList>
      <TabsContent value="warehouses"><WarehousesTab /></TabsContent>
      <TabsContent value="combinations"><CombinationsTab /></TabsContent>
    </Tabs>
  </div>
);

export default Settings;
