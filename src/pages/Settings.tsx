import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FEATURES } from '@/config/features';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Edit2, ChevronDown, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarehouses, useUpsertWarehouse, useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingCombinations, useUpsertPricingCombination, useTogglePricingCombinationActive, useDeletePricingCombination } from '@/hooks/usePricingCombinations';
import { useMarketData } from '@/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
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
import { useSpotSettings, useUpdateSpotSettings } from '@/hooks/useSpotSettings';
import { useReferenceRows } from '@/hooks/useReferenceData';
import { useFxParameters, useUpdateFxParameters } from '@/hooks/useFxParameters';
import { InsuranceFields, validateInsuranceTrio, insurancePatch } from '@/components/pricing/InsuranceFields';
import { callApi } from '@/lib/api';
import type { Warehouse, PricingCombination, PricingParameter, SpotSettings } from '@/types';

const NONE = '__none__';

const emptyWarehouse: Partial<Warehouse> & { id: string } = {
  id: '', display_name: '', city: '', state: '', type: 'ARMAZEM', active: true,
  basis_config: {},
  location_id: null, trading_company_id: null, storage_company_id: null, capacity_kg: null,
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

  const { data: locations } = useReferenceRows('trading_locations');
  const { data: companies } = useReferenceRows('companies');
  const activeLocations = (locations ?? []).filter((l) => l.active);
  const tradingCompanies = (companies ?? []).filter((c) => c.activity === 'TRADING');
  const storageCompanies = (companies ?? []).filter((c) => c.activity === 'STORAGE');
  const locationName = (id?: string | null) => activeLocations.find((l) => l.id === id)?.name
    ?? (locations ?? []).find((l) => l.id === id)?.name ?? '-';
  const companyName = (id?: string | null) => (companies ?? []).find((c) => c.id === id)?.legal_name ?? '-';

  const queryClient = useQueryClient();
  const isExisting = !!editing?.id && !!warehouses?.some((w) => w.id === editing.id);

  const handleDelete = async () => {
    if (!editing?.id) return;
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', editing.id);
      if (error) throw error;
      toast.success('Armazém excluído');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setOpen(false);
      setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir';
      toast.error(msg);
    }
  };

  const handleSave = async () => {
    if (!editing?.id || !editing?.display_name) { toast.error('ID e nome são obrigatórios'); return; }
    const state = (editing.state ?? '').trim().toUpperCase();
    if (state && !/^[A-Z]{2}$/.test(state)) { toast.error('Estado deve ter exatamente 2 letras (UF)'); return; }
    const capacity = editing.capacity_kg;
    if (capacity !== null && capacity !== undefined && !(Number(capacity) > 0)) {
      toast.error('Capacidade deve ser maior que zero'); return;
    }
    try {
      await upsertWarehouse.mutateAsync({
        id: editing.id, display_name: editing.display_name,
        city: editing.city ?? null, state: state || null,
        type: editing.type ?? 'ARMAZEM', active: editing.active ?? true,
        basis_config: editing.basis_config ?? {},
        location_id: editing.location_id ?? null,
        trading_company_id: editing.trading_company_id ?? null,
        storage_company_id: editing.storage_company_id ?? null,
        capacity_kg: capacity === null || capacity === undefined ? null : Number(capacity),
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
      toast.error(msg);
    }
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
                    <Label className="text-xs">Cidade</Label>
                    <Input value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado (UF)</Label>
                    <Input value={editing.state ?? ''} maxLength={2}
                      onChange={(e) => setEditing({ ...editing, state: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Input value={editing.type ?? ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Capacidade (kg)</Label>
                    <Input type="number" step="any" min="0" value={editing.capacity_kg ?? ''}
                      onChange={(e) => setEditing({ ...editing, capacity_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Praça</Label>
                    <Select value={editing.location_id ?? NONE}
                      onValueChange={(v) => setEditing({ ...editing, location_id: v === NONE ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {activeLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Comercializadora</Label>
                    <Select value={editing.trading_company_id ?? NONE}
                      onValueChange={(v) => setEditing({ ...editing, trading_company_id: v === NONE ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {tradingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Empresa de armazenagem</Label>
                    <Select value={editing.storage_company_id ?? NONE}
                      onValueChange={(v) => setEditing({ ...editing, storage_company_id: v === NONE ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {storageCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.legal_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cidade</TableHead><TableHead>Estado</TableHead><TableHead>Tipo</TableHead><TableHead>Praça</TableHead><TableHead>Comercializadora</TableHead><TableHead className="text-right">Capacidade (kg)</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {warehouses?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.display_name}</TableCell>
                    <TableCell>{w.city ?? '-'}</TableCell><TableCell>{w.state ?? '-'}</TableCell>
                    <TableCell>{w.type}</TableCell>
                    <TableCell>{locationName(w.location_id)}</TableCell>
                    <TableCell>{companyName(w.trading_company_id)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.capacity_kg != null ? Number(w.capacity_kg).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell>{w.active ? '✅ Ativo' : '❌ Inativo'}</TableCell>
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
  warehouse_id: '', commodity: 'soybean', benchmark: 'cbot', ticker: '', harvest_id: null, exp_date: null,
  sale_date: '', payment_date: null, is_spot: false, grain_reception_date: null,
  grain_already_delivered: false,
  pricing_method: 'LONG_BASIS',
  target_basis: 0,
  origination_price_net_brl: null,
  additional_discount_brl: 0, active: true,
  interest_rate: null, storage_cost: null, storage_cost_type: null, reception_cost: null,
  brokerage_per_contract: null, desk_cost_pct: null, shrinkage_rate_monthly: null,
  insurance_option_id: null, insurance_coverage_pct: null, insurance_carry_until: null,
};

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <DateInput value={value} onChange={(v) => onChange(v || null)} />
    </div>
  );
}

function CombinationsTab() {
  const { data: combinations, isLoading } = usePricingCombinations();
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: pricingParameters } = usePricingParameters();
  const upsert = useUpsertPricingCombination();
  const toggleActive = useTogglePricingCombinationActive();
  const deleteCombination = useDeletePricingCombination();
  const { data: harvests } = useReferenceRows('harvests');
  const [editing, setEditing] = useState<Partial<PricingCombination> | null>(null);
  const [open, setOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<{
    target_basis_brl: number;
    breakeven_basis_brl: number;
    purchased_basis_brl: number;
    origination_price_brl: number;
  } | null>(null);

  const warehouseMap = useMemo(() => {
    const m: Record<string, string> = {};
    warehouses?.forEach((w) => { m[w.id] = w.display_name; });
    return m;
  }, [warehouses]);

  const harvestMap = useMemo(() => {
    const m: Record<string, string> = {};
    harvests?.forEach((h) => { m[h.id] = h.name; });
    return m;
  }, [harvests]);


  const filtered = useMemo(() => {
    if (!combinations) return [];
    return showActiveOnly ? combinations.filter((c) => c.active) : combinations;
  }, [combinations, showActiveOnly]);



  const handleCalculate = async () => {
    if (!editing) return;
    if (editing.pricing_method !== 'TARGET_PRICE') return;
    if (!editing.warehouse_id || !editing.ticker || !editing.sale_date) {
      toast.error('Preencha armazém, ticker e data de venda primeiro');
      return;
    }
    if (editing.origination_price_net_brl == null) {
      toast.error('Preencha o preço de originação');
      return;
    }
    const warehouse = warehouses?.find((w) => w.id === editing.warehouse_id);
    if (!warehouse) { toast.error('Armazém não encontrado'); return; }
    const market = marketData?.find((m) => m.ticker === editing.ticker);
    if (!market) { toast.error(`Ticker ${editing.ticker} não encontrado em market_data`); return; }

    const expDate = editing.exp_date ?? market.exp_date ?? null;
    if (!expDate) { toast.error('exp_date ausente — defina no formulário ou em market_data'); return; }

    let paymentDate: string;
    if (editing.is_spot) {
      const d = new Date();
      const day = d.getDay();
      const daysUntilTuesday = day === 2 ? 7 : (2 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilTuesday);
      paymentDate = format(d, 'yyyy-MM-dd');
    } else {
      if (!editing.payment_date) { toast.error('Data de pagamento ausente'); return; }
      paymentDate = editing.payment_date;
    }
    const grainReceptionDate = editing.grain_already_delivered
      ? format(new Date(), 'yyyy-MM-dd')
      : editing.grain_reception_date ?? paymentDate;

    const spotRate = marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null;
    let exchangeRate: number | null = null;
    if (editing.commodity === 'soybean') {
      exchangeRate = market.ndf_estimated ?? spotRate;
    } else if (editing.commodity === 'corn' && editing.benchmark === 'cbot') {
      exchangeRate = spotRate;
    }

    const inheritCost = (
      comboField: keyof PricingCombination,
      warehouseField: keyof Warehouse,
    ) => {
      const val = editing[comboField];
      if (val != null) return val;
      return (warehouse[warehouseField] as number | string | null) ?? null;
    };


    const payload = [{
      warehouse_id: editing.warehouse_id,
      display_name: warehouse.display_name,
      commodity: editing.commodity,
      benchmark: editing.benchmark,
      ticker: editing.ticker,
      exp_date: expDate,
      payment_date: paymentDate,
      sale_date: editing.sale_date,
      grain_reception_date: grainReceptionDate,
      pricing_method: 'TARGET_PRICE',
      origination_price_net_brl: editing.origination_price_net_brl,
      futures_price: market.price,
      exchange_rate: exchangeRate,
      additional_discount_brl: 0,
      interest_rate: inheritCost('interest_rate', 'interest_rate'),
      storage_cost: inheritCost('storage_cost', 'storage_cost'),
      storage_cost_type: inheritCost('storage_cost_type', 'storage_cost_type'),
      reception_cost: inheritCost('reception_cost', 'reception_cost'),
      brokerage_per_contract: editing.brokerage_per_contract != null
        ? editing.brokerage_per_contract
        : editing.benchmark === 'b3'
          ? warehouse.brokerage_per_contract_b3 ?? null
          : warehouse.brokerage_per_contract_cbot ?? null,
      desk_cost_pct: inheritCost('desk_cost_pct', 'desk_cost_pct'),
      shrinkage_rate_monthly: inheritCost('shrinkage_rate_monthly', 'shrinkage_rate_monthly'),
    }];

    setCalculating(true);
    try {
      const result = await callApi<{ results: Array<Record<string, unknown>> }>(
        '/pricing/table',
        { combinations: payload },
      );
      const r = result?.results?.[0];
      if (!r) { toast.error('API retornou resposta vazia'); return; }
      setCalcResult({
        target_basis_brl: Number(r.target_basis_brl),
        breakeven_basis_brl: Number(r.breakeven_basis_brl),
        purchased_basis_brl: Number(r.purchased_basis_brl),
        origination_price_brl: Number(r.origination_price_brl),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao calcular';
      toast.error(`Erro: ${msg}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!editing?.warehouse_id || !editing?.ticker || !editing?.sale_date) {
      toast.error('Armazém, ticker e data de venda são obrigatórios'); return;
    }
    const method = editing.pricing_method ?? 'LONG_BASIS';
    if (method === 'LONG_BASIS') {
      if (editing.target_basis == null) {
        toast.error('Target Basis é obrigatório para Long Basis'); return;
      }
    } else {
      if (editing.origination_price_net_brl == null) {
        toast.error('Preço de originação é obrigatório para Target Price'); return;
      }
      if (editing.additional_discount_brl && editing.additional_discount_brl !== 0) {
        toast.error('Target Price não permite desconto adicional'); return;
      }
    }

    // Seguro: os três campos andam juntos ou nenhum.
    const insError = validateInsuranceTrio(editing);
    if (insError) { toast.error(insError); return; }

    const payload: Partial<PricingCombination> = {
      ...editing,
      pricing_method: method,
      target_basis: method === 'LONG_BASIS' ? editing.target_basis ?? null : null,
      origination_price_net_brl: method === 'TARGET_PRICE' ? editing.origination_price_net_brl ?? null : null,
      additional_discount_brl: method === 'TARGET_PRICE' ? 0 : (editing.additional_discount_brl ?? 0),
      ...insurancePatch(editing),
    };

    try {
      await upsert.mutateAsync(payload);
      toast.success('Combinação salva');
      setOpen(false); setEditing(null); setCalcResult(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao salvar'); }
  };

  const selectedWarehouse = warehouses?.find((w) => w.id === editing?.warehouse_id) ?? null;

  const inheritedValueFor = (key: keyof PricingCombination): number | null => {
    if (!selectedWarehouse) return null;
    if (key === 'brokerage_per_contract') {
      const v = editing?.benchmark === 'b3'
        ? selectedWarehouse.brokerage_per_contract_b3
        : selectedWarehouse.brokerage_per_contract_cbot;
      return v ?? null;
    }
    const v = selectedWarehouse[key as keyof Warehouse];
    return typeof v === 'number' ? v : null;
  };

  const numField = (
    label: string,
    key: keyof PricingCombination,
    placeholder = 'Herdar do armazém',
    inheritable = false,
  ) => {
    const override = editing?.[key];
    const isOverridden = override != null;
    const inherited = inheritable ? inheritedValueFor(key) : null;
    const showsInherited = inheritable && !isOverridden && inherited != null;
    const displayValue = isOverridden
      ? String(override)
      : showsInherited
        ? String(inherited)
        : '';
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}</Label>
          {inheritable && isOverridden && (
            <button
              type="button"
              className="text-[10px] text-primary hover:underline"
              onClick={() => setEditing({ ...editing!, [key]: null })}
            >
              voltar a herdar
            </button>
          )}
        </div>
        <Input
          type="number"
          step="any"
          placeholder={placeholder}
          className={cn(showsInherited && 'text-muted-foreground italic')}
          value={displayValue}
          onChange={(e) => setEditing({ ...editing!, [key]: e.target.value === '' ? null : Number(e.target.value) })}
        />
        {showsInherited && (
          <p className="text-[10px] text-muted-foreground">Herdado do armazém</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
          <Label className="text-xs">Apenas ativos</Label>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCostsOpen(false); setCalcResult(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing({ ...emptyCombination }); setCostsOpen(false); setInsuranceOpen(false); setCalcResult(null); }}>
              <Plus className="mr-2 h-4 w-4" /> Nova Combinação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.id ? 'Editar Combinação' : 'Nova Combinação'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-5">
                {/* ---------- 1. IDENTIDADE ---------- */}
                <section className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Identidade
                  </p>
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
                        const updates: Record<string, unknown> = { ...editing, commodity: v, ticker: '', harvest_id: null };
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
                    <div className="space-y-1">
                      <Label className="text-xs">Safra</Label>
                      <Select
                        value={editing.harvest_id ?? '__none__'}
                        onValueChange={(v) => setEditing({ ...editing, harvest_id: v === '__none__' ? null : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {harvests
                            ?.filter((h) => h.active && h.commodity === (editing.commodity ?? 'soybean'))
                            .map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Exp Date (opcional — fallback market_data)</Label>
                    <Input value={editing.exp_date ?? ''} onChange={(e) => setEditing({ ...editing, exp_date: e.target.value || null })} placeholder="2026-08-14" />
                  </div>
                </section>

                {/* ---------- 2. MÉTODO ---------- */}
                <section className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Método
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs">Método de Precificação</Label>
                    <Select
                      value={editing.pricing_method ?? 'LONG_BASIS'}
                      onValueChange={(v) => {
                        const method = v as 'LONG_BASIS' | 'TARGET_PRICE';
                        setEditing({
                          ...editing,
                          pricing_method: method,
                          target_basis: method === 'LONG_BASIS' ? (editing.target_basis ?? 0) : null,
                          origination_price_net_brl: method === 'TARGET_PRICE' ? (editing.origination_price_net_brl ?? null) : null,
                          additional_discount_brl: method === 'TARGET_PRICE' ? 0 : (editing.additional_discount_brl ?? 0),
                        });
                        setCalcResult(null);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LONG_BASIS">Long Basis (Basis → Preço)</SelectItem>
                        <SelectItem value="TARGET_PRICE">Target Price (Preço → Basis)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(editing.pricing_method ?? 'LONG_BASIS') === 'LONG_BASIS' ? (
                    <div className="grid grid-cols-2 gap-3">
                      {numField('Target Basis (R$/sc)', 'target_basis', '0')}
                      {numField('Desconto adicional (R$/sc)', 'additional_discount_brl', '0')}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Preço de Originação Net (R$/sc)</Label>
                      <Input
                        type="number" step="any" placeholder="ex: 109.11"
                        value={editing.origination_price_net_brl ?? ''}
                        onChange={(e) => {
                          setEditing({
                            ...editing,
                            origination_price_net_brl: e.target.value === '' ? null : Number(e.target.value),
                          });
                          setCalcResult(null);
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Valor que será pago ao produtor. O sistema calculará o basis.
                      </p>
                    </div>
                  )}

                  {editing.pricing_method === 'TARGET_PRICE' && (
                    <div className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Pré-cálculo do basis
                        </p>
                        <Button size="sm" variant="outline" onClick={handleCalculate} disabled={calculating}>
                          {calculating ? 'Calculando...' : 'Calcular'}
                        </Button>
                      </div>
                      {calcResult ? (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço ao produtor:</span>
                            <span className="font-mono">R$ {calcResult.origination_price_brl.toFixed(4)}/sc</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Target basis:</span>
                            <span className="font-mono">R$ {calcResult.target_basis_brl.toFixed(4)}/sc</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Breakeven basis:</span>
                            <span className="font-mono">R$ {calcResult.breakeven_basis_brl.toFixed(4)}/sc</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Purchased basis:</span>
                            <span className="font-mono">R$ {calcResult.purchased_basis_brl.toFixed(4)}/sc</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            Confira os valores antes de salvar. Se o basis sair muito fora do esperado, ajuste o preço de originação.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          Clique em "Calcular" para ver o basis resultante antes de salvar.
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* ---------- 3. DATAS ---------- */}
                <section className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Datas
                  </p>
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.is_spot ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_spot: v, payment_date: v ? null : editing.payment_date })} />
                    <Label className="text-xs">Spot (pagamento = próxima terça)</Label>
                  </div>
                  {!editing.is_spot && (
                    <DateField label="Data de pagamento" value={editing.payment_date ?? null} onChange={(v) => setEditing({ ...editing, payment_date: v })} />
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editing.grain_already_delivered ?? false}
                      onCheckedChange={(v) => setEditing({ ...editing, grain_already_delivered: v, grain_reception_date: v ? null : editing.grain_reception_date })}
                    />
                    <Label className="text-xs">Grão já entregue (recepção = data da geração)</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {!editing.grain_already_delivered && (
                      <DateField label="Recepção de grão (opcional)" value={editing.grain_reception_date ?? null} onChange={(v) => setEditing({ ...editing, grain_reception_date: v })} />
                    )}
                    <DateField label="Data de venda" value={editing.sale_date ?? null} onChange={(v) => setEditing({ ...editing, sale_date: v ?? '' })} />
                  </div>
                </section>

                {/* ---------- 4. SEGURO ---------- */}
                <section className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Seguro
                  </p>
                  <Collapsible open={insuranceOpen} onOpenChange={setInsuranceOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-xs text-muted-foreground">
                        {editing.insurance_option_id
                          ? `Seguro ${((editing.insurance_coverage_pct ?? 0) * 100).toFixed(0)}%`
                          : 'Adicionar camada de seguro'}
                        <ChevronDown className={cn('h-4 w-4 transition-transform', insuranceOpen && 'rotate-180')} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-2">
                      <InsuranceFields
                        value={editing}
                        commodity={(editing.commodity ?? 'soybean') as 'soybean' | 'corn'}
                        benchmark={(editing.benchmark ?? 'cbot') as 'cbot' | 'b3'}
                        onChange={(patch) => setEditing({ ...editing, ...patch })}
                      />

                    </CollapsibleContent>
                  </Collapsible>
                </section>

                {/* ---------- 5. CUSTOS ---------- */}
                <section className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Custos
                  </p>
                  <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-xs text-muted-foreground">
                        Sobrescrever custos do armazém
                        <ChevronDown className={cn('h-4 w-4 transition-transform', costsOpen && 'rotate-180')} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        {numField('Taxa de juros', 'interest_rate', undefined, true)}
                        {numField('Custo armazenagem', 'storage_cost', undefined, true)}
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
                        {numField('Custo recepção', 'reception_cost', undefined, true)}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {numField('Corretagem/contrato', 'brokerage_per_contract', undefined, true)}
                        {numField('Custo mesa (%)', 'desk_cost_pct', undefined, true)}
                      </div>
                      {numField('Quebra mensal (%)', 'shrinkage_rate_monthly', undefined, true)}
                    </CollapsibleContent>
                  </Collapsible>
                </section>

                <div className="flex items-center gap-2 pt-2 border-t">
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
                    <TableHead>Método</TableHead><TableHead>Input</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
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
                      <TableCell>
                        <span className="text-xs">
                          {c.pricing_method === 'TARGET_PRICE' ? 'Target Price' : 'Long Basis'}
                        </span>
                        {c.insurance_option_id && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                            Seguro {((c.insurance_coverage_pct ?? 0) * 100).toFixed(0)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.pricing_method === 'TARGET_PRICE'
                          ? `R$ ${(c.origination_price_net_brl ?? 0).toFixed(2)}`
                          : (c.target_basis != null ? c.target_basis.toFixed(2) : '-')}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: c.id, active: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...c }); setOpen(true); setCostsOpen(false); setInsuranceOpen(!!c.insurance_option_id); setCalcResult(null); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Duplicar combinação"
                            onClick={() => {
                              const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = c;
                              setEditing({ ...rest });
                              setOpen(true);
                              setCostsOpen(false); setInsuranceOpen(!!c.insurance_option_id);
                              setCalcResult(null);
                            }}
                          >
                            <Copy className="h-4 w-4" />
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
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma combinação {showActiveOnly ? 'ativa ' : ''}cadastrada</TableCell></TableRow>
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

const PARAM_LABELS: Record<string, string> = {
  soybean_cbot: 'Soja CBOT',
  corn_b3: 'Milho B3',
  corn_cbot: 'Milho CBOT',
};

function parseDecimalInput(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function RoundingIncrementCard({ parameters }: { parameters: PricingParameter[] }) {
  const updateParameter = useUpdatePricingParameter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const getLabel = (id: string) => PARAM_LABELS[id] ?? id;

  const draftFor = (p: PricingParameter) =>
    drafts[p.id] ?? (p.rounding_increment == null ? '' : String(p.rounding_increment));

  const errorFor = (p: PricingParameter): string | null => {
    const raw = draftFor(p).trim();
    if (raw === '') return null;
    const n = parseDecimalInput(raw);
    if (n === null) return 'Valor inválido';
    if (n < 0) return 'Não é permitido valor negativo';
    return null;
  };

  const nextValueFor = (p: PricingParameter): number | null => {
    const raw = draftFor(p).trim();
    if (raw === '') return null;
    return parseDecimalInput(raw);
  };

  const fmt = (v: number | null) =>
    v == null || v === 0 ? 'piso desligado' : `R$ ${v.toFixed(2)}/sc`;

  const save = async (p: PricingParameter) => {
    const next = nextValueFor(p);
    try {
      await updateParameter.mutateAsync({ id: p.id, rounding_increment: next });
      toast.success(`Incremento de arredondamento (${getLabel(p.id)}) atualizado`);
      setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setConfirming(null);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Incremento de Arredondamento</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Múltiplo mínimo aplicado pelo motor ao preço final por saca. Este campo altera o preço que vai ao produtor.
        </p>
        <p className="text-xs text-amber-500">
          Deixar o campo vazio ou informar 0 desliga o piso intencionalmente: o preço volta a ser arredondado em duas casas decimais, sem múltiplo.
        </p>
        {parameters.map((p) => {
          const err = errorFor(p);
          const next = nextValueFor(p);
          const changed = draftFor(p).trim() !== (p.rounding_increment == null ? '' : String(p.rounding_increment));
          return (
            <div key={p.id} className="flex items-start gap-3 max-w-md">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{getLabel(p.id)} — Incremento de arredondamento (R$/sc)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="vazio = piso desligado"
                  value={draftFor(p)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                />
                {err ? (
                  <p className="text-[10px] text-destructive">{err}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {p.rounding_increment == null || p.rounding_increment === 0
                      ? 'Atual: piso desligado — preço arredondado em 2 casas'
                      : `Atual: R$ ${p.rounding_increment.toFixed(2)}/sc`}
                  </p>
                )}
              </div>
              <AlertDialog open={confirming === p.id} onOpenChange={(o) => setConfirming(o ? p.id : null)}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="mt-5" disabled={!!err || !changed || updateParameter.isPending}>
                    Salvar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Alterar incremento de arredondamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Par: <strong>{getLabel(p.id)}</strong>. Valor atual: <strong>{fmt(p.rounding_increment)}</strong> → novo valor:{' '}
                      <strong>{fmt(next)}</strong>.
                      {(next == null || next === 0) && ' O piso será desligado: o preço passa a ser arredondado em duas casas decimais, sem múltiplo.'}
                      {' '}Este campo muda o preço que vai ao produtor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => save(p)}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const SPOT_MODE_LABELS: Record<SpotSettings['mode'], string> = {
  weekday: 'Dia da semana fixo',
  next_day: 'Dia seguinte',
  same_day: 'Mesmo dia',
};

const SPOT_MODE_HELP: Record<SpotSettings['mode'], string> = {
  weekday: 'Paga no próximo dia da semana escolhido.',
  next_day: 'Paga no dia seguinte à negociação.',
  same_day: 'Paga no mesmo dia da negociação.',
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
  7: 'Domingo',
};

function SpotPaymentCard() {
  const { data: settings, isLoading } = useSpotSettings();
  const updateSettings = useUpdateSpotSettings();
  const [draft, setDraft] = useState<{ mode: SpotSettings['mode']; weekday: number; skip_current_week: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft({ mode: settings.mode, weekday: settings.weekday, skip_current_week: settings.skip_current_week });
    }
  }, [settings]);

  if (isLoading || !settings || !draft) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Pagamento à vista</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">Carregando...</p></CardContent>
      </Card>
    );
  }

  const weekdayDisabled = draft.mode !== 'weekday';
  const changed =
    draft.mode !== settings.mode ||
    draft.weekday !== settings.weekday ||
    draft.skip_current_week !== settings.skip_current_week;

  const describe = (s: { mode: SpotSettings['mode']; weekday: number; skip_current_week: boolean }) =>
    s.mode === 'weekday'
      ? `${SPOT_MODE_LABELS[s.mode]} — ${WEEKDAY_LABELS[s.weekday]}${s.skip_current_week ? ', pulando a semana corrente' : ', sem pular a semana corrente'}`
      : SPOT_MODE_LABELS[s.mode];

  const save = async () => {
    try {
      await updateSettings.mutateAsync(draft);
      toast.success('Configuração de pagamento à vista atualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Pagamento à vista</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Regra usada pelo motor para resolver a data de pagamento das combinações à vista. Este campo muda o preço que vai ao produtor.
        </p>

        <div className="space-y-1 max-w-md">
          <Label className="text-xs">Modo</Label>
          <Select
            value={draft.mode}
            onValueChange={(v) => setDraft({ ...draft, mode: v as SpotSettings['mode'] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SPOT_MODE_LABELS) as SpotSettings['mode'][]).map((m) => (
                <SelectItem key={m} value={m}>{SPOT_MODE_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">{SPOT_MODE_HELP[draft.mode]}</p>
        </div>

        <div className="space-y-1 max-w-md">
          <Label className="text-xs">Dia da semana</Label>
          <Select
            value={String(draft.weekday)}
            disabled={weekdayDisabled}
            onValueChange={(v) => setDraft({ ...draft, weekday: parseInt(v, 10) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <SelectItem key={d} value={String(d)}>{WEEKDAY_LABELS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {weekdayDisabled && (
            <p className="text-[10px] text-muted-foreground">Não se aplica ao modo selecionado.</p>
          )}
        </div>

        <div className="flex items-start gap-3 max-w-md">
          <Switch
            checked={draft.skip_current_week}
            disabled={weekdayDisabled}
            onCheckedChange={(c) => setDraft({ ...draft, skip_current_week: c })}
          />
          <div className="space-y-0.5">
            <Label className="text-xs">Pular a semana corrente</Label>
            <p className="text-[10px] text-muted-foreground">
              Descarta a ocorrência da semana atual. Exemplo: negociando numa segunda com o dia definido como terça, o pagamento cai na terça da semana seguinte, não na de amanhã.
              {weekdayDisabled && ' Não se aplica ao modo selecionado.'}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Em qualquer modo, se a data cair em fim de semana ou feriado, a API avança para o próximo dia útil. Isso é automático e não configurável.
        </p>

        <div className="flex items-center gap-3">
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!changed || updateSettings.isPending}>Salvar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alterar pagamento à vista</AlertDialogTitle>
                <AlertDialogDescription>
                  Configuração atual: <strong>{describe(settings)}</strong> → nova configuração:{' '}
                  <strong>{describe(draft)}</strong>. Este campo muda o preço que vai ao produtor.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={save}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <span className="text-[10px] text-muted-foreground">
            Última alteração: {new Date(settings.updated_at).toLocaleString('pt-BR')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ParametersTab() {

  const { data: parameters, isLoading } = usePricingParameters();
  const updateParameter = useUpdatePricingParameter();
  const [values, setValues] = useState<Record<string, string>>({});

  const getLabel = (id: string) => PARAM_LABELS[id] ?? id;


  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
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
                    await updateParameter.mutateAsync({ id: p.id, target_profit_brl_per_sack: val, execution_spread_pct: p.execution_spread_pct ?? 0.05 });
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
          <p className="text-xs text-muted-foreground">Define quantos vencimentos (tickers) são buscados e exibidos em cada mercado. Cada campo grava apenas na sua própria linha.</p>
          {([
            { id: 'soybean_cbot', label: 'Soja CBOT', fallback: 8 },
            { id: 'corn_cbot', label: 'Milho CBOT', fallback: 8 },
            { id: 'corn_b3', label: 'Milho B3', fallback: 6 },
          ] as const).map((market) => {
            const current = parameters?.find((p) => p.id === market.id)?.ticker_count ?? market.fallback;
            const key = `ticker_count_${market.id}`;
            return (
              <div key={market.id} className="flex items-end gap-3 max-w-md">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{market.label}</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="24"
                    placeholder={String(current)}
                    value={values[key] ?? String(current)}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Atual: {current}</p>
                </div>
                <Button
                  size="sm"
                  disabled={updateParameter.isPending}
                  onClick={async () => {
                    const raw = values[key] ?? String(current);
                    if (raw === undefined || raw === '') { toast.error('Informe um valor'); return; }
                    const val = parseInt(raw, 10);
                    if (isNaN(val) || val < 1 || val > 24) { toast.error('Valor entre 1 e 24'); return; }
                    try {
                      await updateParameter.mutateAsync({ id: market.id, ticker_count: val });
                      toast.success(`Quantidade de ${market.label} atualizada`);
                      setValues((v) => { const n = { ...v }; delete n[key]; return n; });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
                    }
                  }}
                >Salvar</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <RoundingIncrementCard parameters={parameters ?? []} />
      <SpotPaymentCard />
      <FxParametersCard />
    </div>
  );
}

function FxParametersCard() {
  const { data: fx, isLoading } = useFxParameters();
  const updateFx = useUpdateFxParameters();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmingHaircut, setConfirmingHaircut] = useState(false);

  if (isLoading) return null;
  if (!fx) return null;

  const draft = (key: string, current: string | number | null) =>
    drafts[key] ?? (current == null ? '' : String(current));

  const set = (key: string, v: string) => setDrafts((d) => ({ ...d, [key]: v }));
  const clear = (key: string) => setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });

  const haircutRaw = draft('safety_haircut_brl', fx.safety_haircut_brl).trim();
  const haircutParsed = haircutRaw === '' ? null : parseDecimalInput(haircutRaw);
  const haircutError =
    haircutRaw === ''
      ? 'Informe um valor (0 = sem margem)'
      : haircutParsed === null
        ? 'Valor inválido'
        : haircutParsed < 0
          ? 'Não é permitido valor negativo'
          : null;
  const haircutChanged = haircutParsed !== null && haircutParsed !== fx.safety_haircut_brl;

  const saveNumeric = async (
    key: 'short_bucket_carry_ann' | 'long_bucket_carry_ann',
    label: string,
  ) => {
    const raw = draft(key, fx[key]).trim();
    const val = parseDecimalInput(raw);
    if (val === null) { toast.error('Valor inválido'); return; }
    try {
      await updateFx.mutateAsync({ [key]: val });
      toast.success(`${label} atualizado`);
      clear(key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const saveMaxDays = async () => {
    const raw = draft('short_bucket_max_days', fx.short_bucket_max_days).trim();
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 1 || String(val) !== raw) { toast.error('Informe um inteiro positivo'); return; }
    try {
      await updateFx.mutateAsync({ short_bucket_max_days: val });
      toast.success('Fronteira de prazo atualizada');
      clear('short_bucket_max_days');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const saveCalibration = async () => {
    const date = draft('calibration_date', fx.calibration_date).trim();
    const source = draft('calibration_source', fx.calibration_source);
    try {
      await updateFx.mutateAsync({
        calibration_date: date === '' ? null : date,
        calibration_source: source.trim() === '' ? null : source.trim(),
      });
      toast.success('Calibração atualizada');
      clear('calibration_date');
      clear('calibration_source');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const saveHaircut = async () => {
    if (haircutError || haircutParsed === null) return;
    try {
      await updateFx.mutateAsync({ safety_haircut_brl: haircutParsed });
      toast.success('Margem de segurança atualizada');
      clear('safety_haircut_brl');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setConfirmingHaircut(false);
    }
  };

  const calibrationChanged =
    draft('calibration_date', fx.calibration_date).trim() !== (fx.calibration_date ?? '') ||
    draft('calibration_source', fx.calibration_source) !== (fx.calibration_source ?? '');

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Câmbio</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Curva de carrego do modelo de câmbio. Estes valores vêm de calibração contra cotações da StoneX — não são escolha livre.
            Taxas anuais em decimal (ex: 0.12 = 12% a.a.).
          </p>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Carrego anual — prazo curto</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft('short_bucket_carry_ann', fx.short_bucket_carry_ann)}
                onChange={(e) => set('short_bucket_carry_ann', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Atual: {fx.short_bucket_carry_ann}</p>
            </div>
            <Button
              size="sm"
              disabled={updateFx.isPending}
              onClick={() => saveNumeric('short_bucket_carry_ann', 'Carrego de prazo curto')}
            >Salvar</Button>
          </div>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Carrego anual — prazo longo</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft('long_bucket_carry_ann', fx.long_bucket_carry_ann)}
                onChange={(e) => set('long_bucket_carry_ann', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Atual: {fx.long_bucket_carry_ann}</p>
            </div>
            <Button
              size="sm"
              disabled={updateFx.isPending}
              onClick={() => saveNumeric('long_bucket_carry_ann', 'Carrego de prazo longo')}
            >Salvar</Button>
          </div>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Fronteira de prazo (dias)</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={draft('short_bucket_max_days', fx.short_bucket_max_days)}
                onChange={(e) => set('short_bucket_max_days', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Até este número de dias vale a taxa curta; acima dele, a longa. Atual: {fx.short_bucket_max_days} dias
              </p>
            </div>
            <Button size="sm" disabled={updateFx.isPending} onClick={saveMaxDays}>Salvar</Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-start gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Margem de segurança (R$/USD)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={draft('safety_haircut_brl', fx.safety_haircut_brl)}
                onChange={(e) => set('safety_haircut_brl', e.target.value)}
              />
              {haircutError ? (
                <p className="text-[10px] text-destructive">{haircutError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Atual: R$ {fx.safety_haircut_brl}/USD{fx.safety_haircut_brl === 0 ? ' — sem margem' : ''}
                </p>
              )}
            </div>
            <AlertDialog open={confirmingHaircut} onOpenChange={setConfirmingHaircut}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="mt-5" disabled={!!haircutError || !haircutChanged || updateFx.isPending}>
                  Salvar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alterar margem de segurança</AlertDialogTitle>
                  <AlertDialogDescription>
                    Valor atual: <strong>R$ {fx.safety_haircut_brl}/USD</strong> → novo valor:{' '}
                    <strong>R$ {haircutRaw}/USD</strong>.{' '}
                    Este campo muda o preço que vai ao produtor.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={saveHaircut}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-amber-500 max-w-2xl">
            É subtraída da taxa de câmbio depois do carrego, sempre para baixo. Cada centavo reduz o preço em cerca de
            R$0,22/sc na soja e R$0,09/sc no milho. Zero significa sem margem.
          </p>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Registro de quando e contra o que o modelo foi calibrado.
          </p>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Data da calibração</Label>
              <DateInput
                value={draft('calibration_date', fx.calibration_date)}
                onChange={(v) => set('calibration_date', v)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Fonte da calibração</Label>
              <Input
                type="text"
                placeholder="ex: StoneX"
                value={draft('calibration_source', fx.calibration_source)}
                onChange={(e) => set('calibration_source', e.target.value)}
              />
            </div>
            <Button size="sm" disabled={updateFx.isPending || !calibrationChanged} onClick={saveCalibration}>
              Salvar
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Última alteração: {new Date(fx.updated_at).toLocaleString('pt-BR')}
        </p>
      </CardContent>
    </Card>
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
