import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, Circle } from 'lucide-react';

// Tiers — editável aqui no topo
const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};

const ROLE_LABELS: Record<string, string> = {
  mesa: 'Mesa',
  comercial_n1: 'Comercial N1',
  comercial_n2: 'Comercial N2',
  financeiro_n1: 'Financeiro N1',
  financeiro_n2: 'Financeiro N2',
  presidencia: 'Presidência',
};

const SACK_TO_TON = 0.06; // 60 kg/saca → toneladas (conversão de unidade física)

// ===== Helpers de contagem =====
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

type Policy = {
  id: string;
  threshold_x_tons: number;
  threshold_y_tons: number;
  is_active: boolean;
};

function getRequiredRoles(volumeTons: number, policy: Policy): string[] {
  if (volumeTons <= policy.threshold_x_tons) return ROLES_TIERS.low;
  if (volumeTons <= policy.threshold_x_tons + policy.threshold_y_tons) return ROLES_TIERS.mid;
  return ROLES_TIERS.high;
}

type OperationRow = {
  id: string;
  commodity: string;
  volume_sacks: number;
  warehouse_id: string;
  status: string;
  pricing_snapshots?: { payment_date: string | null; origination_price_brl?: number | null } | null;
  warehouses?: { display_name: string } | null;
};

type SignatureRow = {
  id: string;
  operation_id: string;
  user_id: string;
  role_used: string;
  signed_at: string;
  notes: string | null;
};

export default function Approvals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [signDialog, setSignDialog] = useState<{
    operationId: string;
    displayCode: string;
    requiredRoles: string[];
    collectedRoles: string[];
    availableRoles: string[];
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Roles do usuário logado
  const { data: currentUser } = useQuery({
    queryKey: ['current_user_roles', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { roles: string[] } | null) ?? { roles: [] };
    },
  });

  // 2. Policy ativa
  const { data: policy } = useQuery({
    queryKey: ['active_approval_policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_policies')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Policy | null;
    },
  });

  // 3. Operations EM_APROVACAO
  const { data: operations } = useQuery({
    queryKey: ['operations_em_aprovacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*, pricing_snapshots(payment_date, origination_price_brl), warehouses(display_name)')
        .eq('status', 'EM_APROVACAO');
      if (error) throw error;
      return data as unknown as OperationRow[];
    },
  });

  // 4. Signatures de todas as operations carregadas
  const operationIds = useMemo(() => operations?.map((o) => o.id) ?? [], [operations]);
  const { data: signatures } = useQuery({
    queryKey: ['signatures_for_pending', operationIds],
    enabled: operationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .in('operation_id', operationIds);
      if (error) throw error;
      return data as SignatureRow[];
    },
  });

  // 5. Display codes das operations (via hedge_orders)
  const { data: orderCodes } = useQuery({
    queryKey: ['order_codes_for_pending', operationIds],
    enabled: operationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hedge_orders')
        .select('operation_id, display_code, created_at')
        .in('operation_id', operationIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const ho of data as { operation_id: string; display_code: string | null }[]) {
        if (ho.display_code && !map[ho.operation_id]) map[ho.operation_id] = ho.display_code;
      }
      return map;
    },
  });

  const sigsByOp = useMemo(() => {
    const map: Record<string, SignatureRow[]> = {};
    for (const s of signatures ?? []) {
      if (!map[s.operation_id]) map[s.operation_id] = [];
      map[s.operation_id].push(s);
    }
    return map;
  }, [signatures]);

  const userRoles = currentUser?.roles ?? [];

  // Filtragem: usuário ainda não assinou E tem role em getMissingRoles
  const visibleOperations = useMemo(() => {
    if (!operations || !policy || !user) return [];
    return operations.filter((op) => {
      const sigs = sigsByOp[op.id] ?? [];
      const alreadySigned = sigs.some((s) => s.user_id === user.id);
      if (alreadySigned) return false;
      const volumeTons = (op.volume_sacks ?? 0) * SACK_TO_TON;
      const required = getRequiredRoles(volumeTons, policy);
      const collected = sigs.map((s) => s.role_used);
      const missing = getMissingRoles(required, collected);
      return userRoles.some((r) => missing.includes(r));
    });
  }, [operations, policy, sigsByOp, user, userRoles]);

  const openSignDialog = (op: OperationRow) => {
    if (!policy) return;
    const sigs = sigsByOp[op.id] ?? [];
    const volumeTons = (op.volume_sacks ?? 0) * SACK_TO_TON;
    const required = getRequiredRoles(volumeTons, policy);
    const collected = sigs.map((s) => s.role_used);
    const missing = getMissingRoles(required, collected);
    const available = userRoles.filter((r) => missing.includes(r));
    if (available.length === 0) {
      toast.error('Nenhum role disponível para assinar');
      return;
    }
    setSignDialog({
      operationId: op.id,
      displayCode: orderCodes?.[op.id] ?? op.id.slice(0, 8),
      requiredRoles: required,
      collectedRoles: collected,
      availableRoles: available,
    });
    setSelectedRole(available[0]);
    setNotes('');
  };

  const handleConfirmSign = async () => {
    if (!signDialog || !user || !selectedRole) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from('signatures').insert({
        operation_id: signDialog.operationId,
        user_id: user.id,
        role_used: selectedRole,
        signature_type: 'APROVACAO',
        notes: notes.trim() || null,
        signed_at: new Date().toISOString(),
      } as never);
      if (insertErr) throw insertErr;

      // Verifica se todas assinaturas foram coletadas
      const newCollected = [...signDialog.collectedRoles, selectedRole];
      if (allSigned(signDialog.requiredRoles, newCollected)) {
        const { error: updErr } = await supabase
          .from('operations')
          .update({ status: 'APROVADA' })
          .eq('id', signDialog.operationId);
        if (updErr) throw updErr;
        toast.success('Operação totalmente aprovada');
      } else {
        toast.success('Assinatura registrada');
      }

      setSignDialog(null);
      queryClient.invalidateQueries({ queryKey: ['operations_em_aprovacao'] });
      queryClient.invalidateQueries({ queryKey: ['signatures_for_pending'] });
      queryClient.invalidateQueries({ queryKey: ['pending_approvals_count'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assinar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Aprovações</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Operações pendentes da sua assinatura</CardTitle>
        </CardHeader>
        <CardContent>
          {!policy ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma política de aprovação ativa configurada.</p>
          ) : visibleOperations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma operação aguardando sua assinatura.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Volume (sc)</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Assinaturas</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOperations.map((op) => {
                  const sigs = sigsByOp[op.id] ?? [];
                  const collected = sigs.map((s) => s.role_used);
                  const volumeTons = (op.volume_sacks ?? 0) * SACK_TO_TON;
                  const required = getRequiredRoles(volumeTons, policy);
                  const missing = getMissingRoles(required, collected);

                  // Para badges: contar required, e colorir N primeiros como verdes (até cobrir collected)
                  const reqCount = countBy(required);
                  const colCount = countBy(collected);
                  const badges: { role: string; signed: boolean }[] = [];
                  for (const [role, n] of Object.entries(reqCount)) {
                    const signedN = Math.min(colCount[role] ?? 0, n);
                    for (let i = 0; i < n; i++) {
                      badges.push({ role, signed: i < signedN });
                    }
                  }

                  const valor = (op.pricing_snapshots?.origination_price_brl ?? 0) * (op.volume_sacks ?? 0);

                  return (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono text-xs">
                        {orderCodes?.[op.id] ?? op.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">{op.warehouses?.display_name ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {op.commodity === 'soybean' ? 'Soja' : 'Milho'}
                        </Badge>
                      </TableCell>
                      <TableCell>{op.volume_sacks?.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>R$ {valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {badges.map((b, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={
                                b.signed
                                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 text-[10px]'
                                  : 'border-muted-foreground/30 text-muted-foreground text-[10px]'
                              }
                            >
                              {b.signed ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <Circle className="h-3 w-3 mr-1" />
                              )}
                              {ROLE_LABELS[b.role] ?? b.role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openSignDialog(op)}
                          disabled={!userRoles.some((r) => missing.includes(r))}
                        >
                          Assinar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de assinatura */}
      <Dialog open={!!signDialog} onOpenChange={(o) => !o && setSignDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar Operação</DialogTitle>
          </DialogHeader>
          {signDialog && (
            <div className="space-y-4">
              <p className="text-sm">
                Você está assinando como{' '}
                <span className="font-semibold">{ROLE_LABELS[selectedRole] ?? selectedRole}</span> na operação{' '}
                <span className="font-mono">{signDialog.displayCode}</span>.
              </p>

              <div className="space-y-1">
                <Label className="text-xs">Função (role)</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {signDialog.availableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Comentários sobre a aprovação..."
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialog(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSign} disabled={submitting || !selectedRole}>
              {submitting ? 'Assinando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
