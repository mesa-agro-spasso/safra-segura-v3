import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

const KG_PER_SACK = 60;

const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};

const countBy = (arr: string[]) =>
  arr.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});

const getMissingRoles = (required: string[], collected: string[]) => {
  const req = countBy(required);
  const col = countBy(collected);
  const missing: string[] = [];
  for (const [role, n] of Object.entries(req)) {
    const remaining = n - (col[role] ?? 0);
    for (let i = 0; i < remaining; i++) missing.push(role);
  }
  return missing;
};

const allSigned = (required: string[], collected: string[]) =>
  getMissingRoles(required, collected).length === 0;

function getRequiredRoles(
  volumeTons: number,
  policy: { threshold_x_tons: number; threshold_y_tons: number },
) {
  if (volumeTons <= policy.threshold_x_tons) return ROLES_TIERS.low;
  if (volumeTons <= policy.threshold_x_tons + policy.threshold_y_tons) return ROLES_TIERS.mid;
  return ROLES_TIERS.high;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

interface SigningTarget {
  operationId: string;
  displayCode: string;
  available: string[];
  collected: string[];
  required: string[];
}

export default function Approvals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [signing, setSigning] = useState<SigningTarget | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState<SigningTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 1. Roles do usuário logado
  const { data: userRoles = [] } = useQuery({
    queryKey: ['current-user-roles', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.roles ?? []) as string[];
    },
  });

  // 2. Policy ativa
  const { data: policy } = useQuery({
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

  // 3. Operações DRAFT com assinatura OPENING já enviada (D24)
  const { data: operations = [] } = useQuery({
    queryKey: ['pending-operations-d24'],
    queryFn: async () => {
      const { data: sigs, error: sigErr } = await (supabase as any)
        .from('signatures')
        .select('operation_id')
        .eq('flow_type', 'OPENING');
      if (sigErr) throw sigErr;
      const ids = [...new Set((sigs ?? []).map((s: any) => s.operation_id as string))];
      if (!ids.length) return [];
      const { data, error } = await (supabase as any)
        .from('operations')
        .select('*, warehouses(display_name), pricing_snapshots(payment_date)')
        .in('id', ids);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  const operationIds = useMemo(
    () => (operations as any[]).map((o: any) => o.id as string),
    [operations]
  );

  // 4. Signatures
  const { data: signatures = [] } = useQuery({
    queryKey: ['pending-signatures', operationIds],
    enabled: operationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('signatures')
        .select('*')
        .in('operation_id', operationIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const effectivePolicy = policy ?? { threshold_x_tons: Infinity, threshold_y_tons: 0 };

  const rows = useMemo(() => {
    return operations
      .map((op: any) => {
        const opSignatures = signatures.filter((s: any) => s.operation_id === op.id);
        const collected = opSignatures.map((s: any) => s.role_used);
        const userAlreadySigned = opSignatures.some(
          (s: any) => s.user_id === user?.id && s.decision === 'APPROVE'
        );

        const volumeSacks = Number(op.volume_sacks ?? 0);
        const volumeTons = (volumeSacks * KG_PER_SACK) / 1000;
        const required = getRequiredRoles(volumeTons, effectivePolicy as any);
        const missing = getMissingRoles(required, collected);
        const availableForUser = userRoles.filter((r) => missing.includes(r));

        const originationPrice = Number(op.origination_price_brl ?? 0);
        const valueBRL = volumeSacks * originationPrice;

        return {
          operationId: op.id,
          displayCode: op.display_code ?? op.id.slice(0, 8),
          isClosing: false,
          warehouse: op.warehouses?.display_name ?? '—',
          commodity: op.commodity,
          volumeSacks,
          valueBRL,
          paymentDate: op.pricing_snapshots?.payment_date ?? null,
          collected,
          required,
          missing,
          availableForUser,
          userAlreadySigned,
        };
      })
      .filter((r) => !r.userAlreadySigned && r.availableForUser.length > 0);
  }, [operations, signatures, userRoles, effectivePolicy, user?.id]);

  const openSign = (row: (typeof rows)[number]) => {
    setSigning({
      operationId: row.operationId,
      displayCode: row.displayCode,
      available: row.availableForUser,
      collected: row.collected,
      required: row.required,
    });
    setSelectedRole(row.availableForUser[0] ?? '');
    setNotes('');
  };

  const openReject = (row: (typeof rows)[number]) => {
    setRejecting({
      operationId: row.operationId,
      displayCode: row.displayCode,
      available: row.availableForUser,
      collected: row.collected,
      required: row.required,
    });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejecting || !rejectReason.trim() || !user) return;
    setSubmitting(true);
    try {
      const reason = rejectReason.trim();
      const nowIso = new Date().toISOString();

      const { error: opError } = await (supabase as any)
        .from('operations')
        .update({
          status: 'CANCELLED',
          cancellation_reason: reason,
          cancelled_at: nowIso,
          cancelled_by: user.id,
        } as never)
        .eq('id', rejecting.operationId);
      if (opError) throw opError;

      const { error: sigError } = await (supabase as any).from('signatures').insert({
        operation_id: rejecting.operationId,
        user_id: user.id,
        role_used: rejecting.available[0],
        flow_type: 'OPENING',
        decision: 'REJECT',
        notes: reason,
        signed_at: nowIso,
      } as never);
      if (sigError) throw sigError;

      toast.success('Operação recusada');
      queryClient.invalidateQueries({ queryKey: ['pending-operations-d24'] });
      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      setRejecting(null);
    } catch (e: any) {
      toast.error('Erro ao recusar', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!signing || !selectedRole || !user) return;
    setSubmitting(true);
    try {
      const { error: insertError } = await (supabase as any).from('signatures').insert({
        operation_id: signing.operationId,
        user_id: user.id,
        role_used: selectedRole,
        flow_type: 'OPENING',
        decision: 'APPROVE',
        notes: notes || null,
        signed_at: new Date().toISOString(),
      } as never);
      if (insertError) throw insertError;

      const newCollected = [...signing.collected, selectedRole];
      if (allSigned(signing.required, newCollected)) {
        toast.success('Todas as assinaturas coletadas — operação pode ser executada');
      } else {
        toast.success('Assinatura registrada');
      }

      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['pending-operations-d24'] });
      queryClient.invalidateQueries({ queryKey: ['signatures-for-ops'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      setSigning(null);
    } catch (e: any) {
      toast.error('Erro ao assinar', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovações</h1>
        <p className="text-muted-foreground">
          Operações aguardando sua assinatura para aprovação.
        </p>
        {!policy && (
          <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span>
              Nenhuma política de aprovação ativa configurada — todas as operações estão usando o
              tier mínimo (low).
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma operação aguardando sua assinatura.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead className="text-right">Volume (sacas)</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Assinaturas</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.operationId}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {row.displayCode}
                        {row.isClosing && (
                          <Badge variant="outline" className="border-orange-500 text-orange-500 text-[10px]">
                            Encerramento
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.warehouse}</TableCell>
                    <TableCell className="capitalize">{row.commodity}</TableCell>
                    <TableCell className="text-right">
                      {row.volumeSacks.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(row.valueBRL)}</TableCell>
                    <TableCell>{formatDate(row.paymentDate)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.collected.map((r, i) => (
                          <Badge key={`c-${i}`} className="bg-emerald-600 hover:bg-emerald-600/90 text-primary-foreground">
                            {r}
                          </Badge>
                        ))}
                        {row.missing.map((r, i) => (
                          <Badge key={`m-${i}`} variant="outline" className="text-muted-foreground">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openSign(row)}>
                          Assinar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openReject(row)}>
                          Recusar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!signing} onOpenChange={(o) => !o && setSigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar assinatura</DialogTitle>
          </DialogHeader>
          {signing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assinando como{' '}
                <span className="font-semibold text-foreground">{selectedRole || '—'}</span> na
                operação{' '}
                <span className="font-mono text-foreground">{signing.displayCode}</span>
              </p>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {signing.available.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre esta assinatura..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigning(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSign} disabled={!selectedRole || submitting}>
              {submitting ? 'Assinando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Operação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Operação:{' '}
              <span className="font-mono text-foreground">{rejecting?.displayCode}</span>
            </p>
            <div className="space-y-2">
              <Label>Motivo (obrigatório)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo da recusa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || submitting}
            >
              {submitting ? 'Recusando...' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
