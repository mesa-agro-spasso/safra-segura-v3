import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { usePhysicalPriceHistoryAll } from '@/hooks/usePhysicalPriceHistoryAll';

const COMMODITY_LABEL: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };

const HistoricoFisico = () => {
  const [warehouseId, setWarehouseId] = useState<string>('all');
  const [commodity, setCommodity] = useState<string>('all');
  const { data: armazens = [] } = useActiveArmazens();
  const { data: rows = [], isLoading } = usePhysicalPriceHistoryAll({
    warehouseId: warehouseId === 'all' ? null : warehouseId,
    commodity: commodity === 'all' ? null : commodity,
  });

  const warehouseName = useMemo(() => {
    const m: Record<string, string> = {};
    armazens.forEach((w) => { m[w.id] = w.display_name; });
    return m;
  }, [armazens]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Commodity</label>
          <Select value={commodity} onValueChange={setCommodity}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="soybean">Soja</SelectItem>
              <SelectItem value="corn">Milho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Praça</label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {armazens.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Histórico de preços físicos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro encontrado.</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data ref.</TableHead>
                    <TableHead>Praça</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead className="text-right">Preço (R$/sc)</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.reference_date}</TableCell>
                      <TableCell>{warehouseName[r.warehouse_id] ?? r.warehouse_id}</TableCell>
                      <TableCell>{COMMODITY_LABEL[r.commodity] ?? r.commodity}</TableCell>
                      <TableCell className="text-right font-mono">
                        R$ {Number(r.price_brl_per_sack).toFixed(2)}
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{r.notes ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoFisico;
