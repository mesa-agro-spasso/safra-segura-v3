import { useState, useMemo } from 'react';
import { useHedgeOrders, useCreateHedgeOrder } from '@/hooks/useHedgeOrders';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useCreateOperation } from '@/hooks/useOperations';
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
import { Copy, Plus, AlertTriangle } from 'lucide-react';

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

const Orders = () => {
  const [commodityFilter, setCommodityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: orders, isLoading } = useHedgeOrders({
    commodity: commodityFilter !== 'all' ? commodityFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: warehouses } = useActiveArmazens();
  const { data: snapshots } = usePricingSnapshots();
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

  // Manual order form
  const [manualForm, setManualForm] = useState({
    commodity: 'SOJA',
    exchange: 'CBOT',
    volume_sacks: '',
    origination_price_brl: '',
    status: 'EXECUTED',
  });

  // Derive commodity/warehouse from selected snapshot for auto-label preview
  const selectedSnapshotData = useMemo(
    () => snapshots?.find((s) => s.id === selectedSnapshot),
    [snapshots, selectedSnapshot]
  );

  const previewLabel = useMemo(() => {
    const wh = selectedWarehouse || selectedSnapshotData?.warehouse_id || 'XXX';
    const com = selectedSnapshotData?.commodity || 'SOJA';
    return generateOperationLabel(wh, com);
  }, [selectedWarehouse, selectedSnapshotData]);

  const handleBuildOrder = async () => {
    if (!selectedWarehouse || !selectedSnapshot || !volume) {
      toast.error('Preencha todos os campos');
      return;
    }
    setBuilding(true);
    setBuildResult(null);
    try {
      const snapshot = selectedSnapshotData;
      const commodity = snapshot?.commodity ?? 'SOJA';
      const label = generateOperationLabel(selectedWarehouse, commodity);
      setGeneratedLabel(label);

      // 1. Create operation record
      const operation = await createOperation.mutateAsync({
        warehouse_id: selectedWarehouse,
        commodity,
        volume_sacks: parseFloat(volume),
        status: 'RASCUNHO',
        pricing_snapshot_id: selectedSnapshot,
        notes: label,
        created_by: user?.id ?? null,
      });

      const operationId = operation.id;

      // 2. Call API to build order
      const result = await callApi<Record<string, unknown>>('/orders/build', {
        warehouse_id: selectedWarehouse,
        pricing_snapshot_id: selectedSnapshot,
        volume_sacks: parseFloat(volume),
        operation_id: operationId,
        commodity,
      });
      setBuildResult(result);

      // 3. Save hedge_order
      if (result) {
        await createOrder.mutateAsync({
          operation_id: operationId,
          commodity: (result.commodity as string) ?? commodity,
          exchange: (result.exchange as string) ?? 'CBOT',
          volume_sacks: parseFloat(volume),
          origination_price_brl: snapshot?.origination_price_brl ?? 0,
          legs: (result.legs as unknown[]) ?? [],
          status: 'GENERATED',
          order_message: (result.order_message as string) ?? null,
          confirmation_message: (result.confirmation_message as string) ?? null,
          stonex_confirmation_text: null,
          created_by: user?.id ?? null,
        });
        toast.success(`Ordem criada: ${label}`);
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
      // Create operation first
      const label = generateOperationLabel('MAN', commodity);
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
        operation_id: operation.id,
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
                  <Label className="text-xs">Pricing Snapshot</Label>
                  <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {snapshots?.slice(0, 20).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.commodity} - {s.benchmark?.toUpperCase() ?? 'CBOT'} - {s.warehouse_id} - R${s.origination_price_brl.toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ID da Operação (auto)</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-xs font-mono text-muted-foreground">
                    {generatedLabel || previewLabel}
                  </div>
                </div>
              </div>
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
