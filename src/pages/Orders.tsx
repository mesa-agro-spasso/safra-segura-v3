import { useState, useMemo, useEffect } from 'react';
import { useHedgeOrders, useCreateHedgeOrder } from '@/hooks/useHedgeOrders';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useCreateOperation, useOperations } from '@/hooks/useOperations';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Plus, AlertTriangle, Trash2 } from 'lucide-react';

type Leg = {
  leg_type: 'futures' | 'ndf' | 'option';
  direction: 'buy' | 'sell';
  ticker: string;
  contracts: string;
  price: string;
  ndf_rate?: string;
  strike?: string;
  premium?: string;
  option_type?: string;
};

/** Generate a short readable operation label: MTP_SOJA_260408_001 */
function generateOperationLabel(warehouseId: string, commodity: string, seq: number): string {
  const wh = warehouseId.slice(0, 3).toUpperCase();
  const com = commodity.slice(0, 4).toUpperCase();
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const s = String(seq).padStart(3, '0');
  return `${wh}_${com}_${yy}${mm}${dd}_${s}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '--/--';
  const date = new Date(d + 'T00:00:00');
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const Orders = () => {
  const [commodityFilter, setCommodityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: orders, isLoading } = useHedgeOrders({
    commodity: commodityFilter !== 'all' ? commodityFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: warehouses } = useActiveArmazens();
  const { data: snapshots } = usePricingSnapshots();
  const { data: operations } = useOperations();
  const createOrder = useCreateHedgeOrder();
  const createOperation = useCreateOperation();
  const { user } = useAuth();

  // Create order form
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [volume, setVolume] = useState('');
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState('');
  const [orderSeq, setOrderSeq] = useState(1);
  const [commodityType, setCommodityType] = useState('');
  const [legs, setLegs] = useState<Leg[]>([]);
  const [linkedOperationId, setLinkedOperationId] = useState('');

  // Manual order form
  const [manualForm, setManualForm] = useState({
    commodity: 'SOJA',
    exchange: 'CBOT',
    volume_sacks: '',
    origination_price_brl: '',
    status: 'EXECUTED',
  });

  // Derive commodity/benchmark from commodityType
  const [com, bench] = commodityType ? commodityType.split('|') : ['', ''];

  // Filter snapshots by latest batch + commodity + benchmark + warehouse
  const latestDate = snapshots?.[0]?.created_at;
  const filteredSnapshots = useMemo(() => {
    if (!com || !bench || !latestDate) return [];
    return snapshots?.filter(s =>
      s.created_at === latestDate &&
      s.commodity === com &&
      s.benchmark === bench &&
      (!selectedWarehouse || s.warehouse_id === selectedWarehouse)
    ) ?? [];
  }, [snapshots, latestDate, com, bench, selectedWarehouse]);

  const selectedSnapshotData = useMemo(
    () => filteredSnapshots.find((s) => s.id === selectedSnapshot),
    [filteredSnapshots, selectedSnapshot]
  );

  // Auto-generate legs when snapshot, commodity or volume changes
  useEffect(() => {
    if (!selectedSnapshot || !commodityType || !volume || parseFloat(volume) <= 0) {
      setLegs([]);
      return;
    }
    const snap = filteredSnapshots.find(s => s.id === selectedSnapshot);
    const ticker = snap?.ticker ?? '';
    const vol = parseFloat(volume);
    const calculateContracts = (ct: string, v: number): string => {
      if (ct === 'soybean|cbot') {
        return ((v * 2.20462) / 5000).toFixed(2);
      } else if (ct === 'corn|b3') {
        return (v / 450).toFixed(2);
      } else {
        return ((v * 2.3622) / 5000).toFixed(2);
      }
    };
    const contracts = calculateContracts(commodityType, vol);
    if (commodityType === 'corn|b3') {
      setLegs([{ leg_type: 'futures', direction: 'sell', ticker, contracts, price: '' }]);
    } else {
      setLegs([
        { leg_type: 'futures', direction: 'sell', ticker, contracts, price: '' },
        { leg_type: 'ndf', direction: 'sell', ticker, contracts, price: '', ndf_rate: '' },
      ]);
    }
  }, [selectedSnapshot, commodityType, volume]);

  const previewLabel = useMemo(() => {
    const wh = selectedWarehouse || 'XXX';
    const commodity = com ? com.slice(0, 4).toUpperCase() : 'SOJA';
    return generateOperationLabel(wh, commodity === 'SOYB' ? 'SOJA' : commodity === 'CORN' ? 'MILHO' : commodity, orderSeq);
  }, [selectedWarehouse, com, orderSeq]);

  const updateLeg = (index: number, field: keyof Leg, value: string) => {
    setLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const removeLeg = (index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
  };

  const addLeg = () => {
    setLegs(prev => [...prev, { leg_type: 'futures', direction: 'sell', ticker: '', contracts: '', price: '' }]);
  };

  const handleBuildOrder = async () => {
    if (!selectedWarehouse || !selectedSnapshot || !volume || !commodityType) {
      toast.error('Preencha todos os campos');
      return;
    }
    setBuilding(true);
    setBuildResult(null);
    try {
      const snapshot = selectedSnapshotData;
      const commodity = com === 'soybean' ? 'soybean' : 'corn';
      const label = generateOperationLabel(selectedWarehouse, commodity === 'soybean' ? 'SOJA' : 'MILHO', orderSeq);
      setGeneratedLabel(label);
      setOrderSeq((s) => s + 1);

      // 1. Create operation record
      const opPayload: Record<string, unknown> = {
        warehouse_id: selectedWarehouse,
        commodity,
        volume_sacks: parseFloat(volume),
        status: 'RASCUNHO',
        pricing_snapshot_id: selectedSnapshot,
        notes: label,
        created_by: user?.id ?? null,
      };
      if (linkedOperationId) {
        opPayload.parent_operation_id = linkedOperationId;
      }
      const operation = await createOperation.mutateAsync(opPayload as never);
      const operationId = (operation as { id: string }).id;

      // 2. Call API to build order
      const legsPayload = legs.map(l => ({
        ...l,
        contracts: l.contracts ? parseFloat(l.contracts) : 0,
        price: l.price ? parseFloat(l.price) : 0,
        ndf_rate: l.ndf_rate ? parseFloat(l.ndf_rate) : undefined,
        strike: l.strike ? parseFloat(l.strike) : undefined,
        premium: l.premium ? parseFloat(l.premium) : undefined,
      }));

      const result = await callApi<Record<string, unknown>>('/orders/build', {
        warehouse_id: selectedWarehouse,
        pricing_snapshot_id: selectedSnapshot,
        volume_sacks: parseFloat(volume),
        operation_id: operationId,
        commodity,
        legs: legsPayload,
      });
      setBuildResult(result);

      // 3. Save hedge_order
      if (result) {
        await createOrder.mutateAsync({
          operation_id: operationId,
          commodity: (result.commodity as string) ?? commodity,
          exchange: (result.exchange as string) ?? bench.toUpperCase(),
          volume_sacks: parseFloat(volume),
          origination_price_brl: snapshot?.origination_price_brl ?? 0,
          legs: legsPayload as unknown[],
          status: 'GENERATED',
          order_message: (result.order_message as string) ?? null,
          confirmation_message: (result.confirmation_message as string) ?? null,
          stonex_confirmation_text: null,
          created_by: user?.id ?? null,
        });
        toast.success(`Ordem criada: ${label}`);
        // Reset
        setSelectedSnapshot('');
        setCommodityType('');
        setLegs([]);
        setLinkedOperationId('');
        setVolume('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ordem');
    } finally {
      setBuilding(false);
    }
  };

  const handleManualSave = async () => {
    const { commodity, exchange, volume_sacks, origination_price_brl, status } = manualForm;
    if (!volume_sacks || !origination_price_brl) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      const label = generateOperationLabel('MAN', commodity, orderSeq);
      setOrderSeq((s) => s + 1);
      const operation = await createOperation.mutateAsync({
        warehouse_id: 'hq',
        commodity,
        volume_sacks: parseFloat(volume_sacks),
        status: 'RASCUNHO',
        pricing_snapshot_id: null,
        notes: label,
        created_by: user?.id ?? null,
      });

      await createOrder.mutateAsync({
        commodity,
        exchange,
        volume_sacks: parseFloat(volume_sacks),
        origination_price_brl: parseFloat(origination_price_brl),
        operation_id: (operation as { id: string }).id,
        status,
        legs: [],
        order_message: null,
        confirmation_message: null,
        stonex_confirmation_text: null,
        created_by: user?.id ?? null,
      });
      toast.success(`Ordem registrada: ${label}`);
      setManualForm({ ...manualForm, volume_sacks: '', origination_price_brl: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Ordens</h2>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Criar Ordem</TabsTrigger>
          <TabsTrigger value="list">Ordens Existentes</TabsTrigger>
          <TabsTrigger value="manual">Registro Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Nova Ordem via API</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Row 1: Praça + Commodity */}
                <div className="space-y-1">
                  <Label className="text-xs">Praça</Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Commodity</Label>
                  <Select value={commodityType} onValueChange={(v) => { setCommodityType(v); setSelectedSnapshot(''); setLegs([]); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soybean|cbot">Soja CBOT</SelectItem>
                      <SelectItem value="corn|b3">Milho B3</SelectItem>
                      <SelectItem value="corn|cbot">Milho CBOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 2: Preço de Referência (span 2) */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Preço de Referência</Label>
                  <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot} disabled={!commodityType || !volume || parseFloat(volume) <= 0}>
                    <SelectTrigger><SelectValue placeholder={!commodityType ? 'Selecione commodity primeiro' : (!volume || parseFloat(volume) <= 0) ? 'Preencha volume primeiro' : 'Selecione'} /></SelectTrigger>
                    <SelectContent>
                      {filteredSnapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatDate(s.payment_date)} pgto · {formatDate(s.sale_date)} venda · R${s.origination_price_brl.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 3: Volume + Vinculada à operação */}
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vinculada à operação</Label>
                  <Select value={linkedOperationId} onValueChange={setLinkedOperationId}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {operations?.map(op => (
                        <SelectItem key={op.id} value={op.id}>{op.notes ?? op.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 4: ID auto (span 2) */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">ID da Operação (auto)</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-xs font-mono text-muted-foreground">
                    {generatedLabel || previewLabel}
                  </div>
                </div>
              </div>

              {/* Leg Editor */}
              {legs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-semibold">Pernas da Operação</Label>
                  {legs.map((leg, i) => (
                    <div key={i} className="grid grid-cols-[100px_80px_1fr_80px_80px_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                        <Select value={leg.leg_type} onValueChange={(v) => updateLeg(i, 'leg_type', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="futures">Futuro</SelectItem>
                            <SelectItem value="ndf">NDF</SelectItem>
                            <SelectItem value="option">Opção</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Dir.</Label>
                        <Select value={leg.direction} onValueChange={(v) => updateLeg(i, 'direction', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sell">Sell</SelectItem>
                            <SelectItem value="buy">Buy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Ticker</Label>
                        <Input className="h-8 text-xs" value={leg.ticker} onChange={(e) => updateLeg(i, 'ticker', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Contr.</Label>
                        <Input className="h-8 text-xs" type="number" value={leg.contracts} onChange={(e) => updateLeg(i, 'contracts', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Preço</Label>
                        <Input className="h-8 text-xs" type="number" step="0.01" value={leg.price} onChange={(e) => updateLeg(i, 'price', e.target.value)} />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLeg(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Conditional NDF/Option fields for each leg */}
                  {legs.map((leg, i) => (
                    <div key={`extra-${i}`}>
                      {leg.leg_type === 'ndf' && (
                        <div className="flex gap-2 pl-4 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Taxa NDF (perna {i + 1})</Label>
                            <Input className="h-8 text-xs w-24" type="number" step="0.0001" value={leg.ndf_rate ?? ''} onChange={(e) => updateLeg(i, 'ndf_rate', e.target.value)} />
                          </div>
                        </div>
                      )}
                      {leg.leg_type === 'option' && (
                        <div className="flex gap-2 pl-4 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Tipo (perna {i + 1})</Label>
                            <Select value={leg.option_type ?? 'call'} onValueChange={(v) => updateLeg(i, 'option_type', v)}>
                              <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="put">Put</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Strike</Label>
                            <Input className="h-8 text-xs w-24" type="number" step="0.01" value={leg.strike ?? ''} onChange={(e) => updateLeg(i, 'strike', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Prêmio</Label>
                            <Input className="h-8 text-xs w-24" type="number" step="0.01" value={leg.premium ?? ''} onChange={(e) => updateLeg(i, 'premium', e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <Button variant="outline" size="sm" className="text-xs" onClick={addLeg}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Perna
                  </Button>
                </div>
              )}

              <Button onClick={handleBuildOrder} disabled={building} className="w-full">
                {building ? 'Construindo...' : 'Construir Ordem'}
              </Button>
            </CardContent>
          </Card>

          {buildResult && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Resultado</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(buildResult.alerts as { level: string; message: string }[])?.map((alert, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded ${alert.level === 'ERROR' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    <AlertTriangle className="h-4 w-4" /> {alert.message}
                  </div>
                ))}
                {buildResult.order_message && (
                  <div className="space-y-1">
                    <Label className="text-xs">Order Message</Label>
                    <div className="flex gap-2">
                      <pre className="flex-1 bg-muted p-2 rounded text-xs overflow-auto">{buildResult.order_message as string}</pre>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(buildResult.order_message as string)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
                {buildResult.confirmation_message && (
                  <div className="space-y-1">
                    <Label className="text-xs">Confirmation Message</Label>
                    <div className="flex gap-2">
                      <pre className="flex-1 bg-muted p-2 rounded text-xs overflow-auto">{buildResult.confirmation_message as string}</pre>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(buildResult.confirmation_message as string)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-3">
            <Select value={commodityFilter} onValueChange={setCommodityFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Commodity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="SOJA">Soja</SelectItem>
                <SelectItem value="MILHO">Milho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="GENERATED">Gerada</SelectItem>
                <SelectItem value="EXECUTED">Executada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : !orders?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.operation_id?.slice(0, 8) ?? '-'}</TableCell>
                    <TableCell>{o.commodity}</TableCell>
                    <TableCell>{o.exchange}</TableCell>
                    <TableCell>{o.volume_sacks?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell>R$ {o.origination_price_brl?.toFixed(2) ?? '0.00'}</TableCell>
                    <TableCell><Badge variant={o.status === 'EXECUTED' ? 'default' : 'secondary'}>{o.status}</Badge></TableCell>
                    <TableCell className="text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Registrar Ordem Executada</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Commodity</Label>
                  <Select value={manualForm.commodity} onValueChange={(v) => setManualForm({ ...manualForm, commodity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOJA">Soja</SelectItem>
                      <SelectItem value="MILHO">Milho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Exchange</Label>
                  <Select value={manualForm.exchange} onValueChange={(v) => setManualForm({ ...manualForm, exchange: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CBOT">CBOT</SelectItem>
                      <SelectItem value="B3">B3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={manualForm.volume_sacks} onChange={(e) => setManualForm({ ...manualForm, volume_sacks: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço originação (R$/sc)</Label>
                  <Input type="number" step="0.01" value={manualForm.origination_price_brl} onChange={(e) => setManualForm({ ...manualForm, origination_price_brl: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={manualForm.status} onValueChange={(v) => setManualForm({ ...manualForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXECUTED">Executada</SelectItem>
                      <SelectItem value="GENERATED">Gerada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleManualSave} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Registrar Ordem
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
