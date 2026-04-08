import { useState } from 'react';
import { useHedgeOrders, useCreateHedgeOrder } from '@/hooks/useHedgeOrders';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
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

const Orders = () => {
  const [commodityFilter, setCommodityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data: orders, isLoading } = useHedgeOrders({
    commodity: commodityFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: warehouses } = useActiveArmazens();
  const { data: snapshots } = usePricingSnapshots();
  const createOrder = useCreateHedgeOrder();
  const { user } = useAuth();

  // Create order form
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [volume, setVolume] = useState('');
  const [operationId, setOperationId] = useState('');
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(null);

  // Manual order form
  const [manualForm, setManualForm] = useState({
    commodity: 'SOJA',
    exchange: 'CBOT',
    volume_sacks: '',
    origination_price_brl: '',
    operation_id: '',
    status: 'EXECUTED',
  });

  const handleBuildOrder = async () => {
    if (!selectedWarehouse || !selectedSnapshot || !volume || !operationId) {
      toast.error('Preencha todos os campos');
      return;
    }
    setBuilding(true);
    setBuildResult(null);
    try {
      const snapshot = snapshots?.find((s) => s.id === selectedSnapshot);
      const result = await callApi<Record<string, unknown>>('/orders/build', {
        warehouse_id: selectedWarehouse,
        pricing_snapshot_id: selectedSnapshot,
        volume_sacks: parseFloat(volume),
        operation_id: operationId,
        commodity: snapshot?.commodity ?? 'SOJA',
      });
      setBuildResult(result);

      // Auto-save to hedge_orders
      if (result) {
        await createOrder.mutateAsync({
          operation_id: operationId,
          commodity: (result.commodity as string) ?? snapshot?.commodity ?? 'SOJA',
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
        toast.success('Ordem criada');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ordem');
    } finally {
      setBuilding(false);
    }
  };

  const handleManualSave = async () => {
    const { commodity, exchange, volume_sacks, origination_price_brl, operation_id, status } = manualForm;
    if (!volume_sacks || !origination_price_brl || !operation_id) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      await createOrder.mutateAsync({
        commodity,
        exchange,
        volume_sacks: parseFloat(volume_sacks),
        origination_price_brl: parseFloat(origination_price_brl),
        operation_id,
        status,
        legs: [],
        order_message: null,
        confirmation_message: null,
        stonex_confirmation_text: null,
        created_by: user?.id ?? null,
      });
      toast.success('Ordem registrada manualmente');
      setManualForm({ ...manualForm, volume_sacks: '', origination_price_brl: '', operation_id: '' });
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
                        <SelectItem key={s.id} value={s.id}>{s.commodity} - {s.warehouse_id} - R${s.origination_price_brl.toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Operation ID</Label>
                  <Input value={operationId} onChange={(e) => setOperationId(e.target.value)} />
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
                  <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded ${alert.level === 'ERROR' ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]'}`}>
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
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="SOJA">Soja</SelectItem>
                <SelectItem value="MILHO">Milho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="GENERATED">Gerada</SelectItem>
                <SelectItem value="EXECUTED">Executada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
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
                {orders?.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.operation_id.slice(0, 8)}</TableCell>
                    <TableCell>{o.commodity}</TableCell>
                    <TableCell>{o.exchange}</TableCell>
                    <TableCell>{o.volume_sacks.toLocaleString()}</TableCell>
                    <TableCell>R$ {o.origination_price_brl.toFixed(2)}</TableCell>
                    <TableCell><Badge variant={o.status === 'EXECUTED' ? 'default' : 'secondary'}>{o.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString('pt-BR')}</TableCell>
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
                  <Label className="text-xs">Operation ID</Label>
                  <Input value={manualForm.operation_id} onChange={(e) => setManualForm({ ...manualForm, operation_id: e.target.value })} />
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
