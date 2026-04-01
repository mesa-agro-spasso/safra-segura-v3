import { useState } from 'react';
import { useWarehouses, useUpsertWarehouse } from '@/hooks/useWarehouses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit2 } from 'lucide-react';
import type { Warehouse } from '@/types';

const emptyWarehouse: Partial<Warehouse> & { id: string } = {
  id: '',
  display_name: '',
  city: '',
  state: '',
  type: 'ARMAZEM',
  active: true,
  basis_config: {},
};

const Settings = () => {
  const { data: warehouses, isLoading } = useWarehouses();
  const upsertWarehouse = useUpsertWarehouse();
  const [editing, setEditing] = useState<(Partial<Warehouse> & { id: string }) | null>(null);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    if (!editing?.id || !editing?.display_name) {
      toast.error('ID e nome são obrigatórios');
      return;
    }
    try {
      await upsertWarehouse.mutateAsync({
        id: editing.id,
        display_name: editing.display_name,
        city: editing.city ?? null,
        state: editing.state ?? null,
        type: editing.type ?? 'ARMAZEM',
        active: editing.active ?? true,
        basis_config: editing.basis_config ?? {},
      });
      toast.success('Armazém salvo');
      setOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Configurações</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ...emptyWarehouse })}>
              <Plus className="mr-2 h-4 w-4" /> Novo Armazém
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id && warehouses?.some((w) => w.id === editing.id) ? 'Editar Armazém' : 'Novo Armazém'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ID (slug)</Label>
                    <Input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} disabled={!!warehouses?.some((w) => w.id === editing.id)} />
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
                    <Label className="text-xs">Estado</Label>
                    <Input value={editing.state ?? ''} onChange={(e) => setEditing({ ...editing, state: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Input value={editing.type ?? ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  <Label className="text-xs">Ativo</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Basis Config (JSON)</Label>
                  <Input
                    value={JSON.stringify(editing.basis_config ?? {})}
                    onChange={(e) => {
                      try { setEditing({ ...editing, basis_config: JSON.parse(e.target.value) }); } catch {}
                    }}
                  />
                </div>
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
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses?.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.display_name}</TableCell>
                    <TableCell>{w.city ?? '-'}</TableCell>
                    <TableCell>{w.state ?? '-'}</TableCell>
                    <TableCell>{w.type}</TableCell>
                    <TableCell>{w.active ? '✅ Ativo' : '❌ Inativo'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...w } as Partial<Warehouse> & { id: string }); setOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
