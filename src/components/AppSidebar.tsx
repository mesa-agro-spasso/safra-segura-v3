import { TableProperties, FileText, TrendingUp, BarChart3, DollarSign, Settings, LogOut, Users, ClipboardCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/safra-segura-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const items = [
  { title: 'Tabela de Preços', url: '/', icon: TableProperties },
  { title: 'Operações / MTM', url: '/operacoes-mtm', icon: TrendingUp },
  { title: 'Financeiro', url: '/financeiro', icon: DollarSign },
  { title: 'Mercado', url: '/mercado', icon: BarChart3 },
  { title: 'Ordens', url: '/ordens', icon: FileText },
  { title: 'Aprovações', url: '/aprovacoes', icon: ClipboardCheck },
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

// Helpers de contagem (mesma lógica de Approvals.tsx)
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

const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};

const SACK_TO_TON = 0.06;

function getRequiredRoles(volumeTons: number, x: number, y: number): string[] {
  if (volumeTons <= x) return ROLES_TIERS.low;
  if (volumeTons <= x + y) return ROLES_TIERS.mid;
  return ROLES_TIERS.high;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user, profile } = useAuth();
  const { isAdmin } = useAuthorization();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending_approvals_count', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      // 1. roles do usuário
      const { data: userRow } = await supabase
        .from('users')
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      const userRoles: string[] = (userRow as { roles?: string[] } | null)?.roles ?? [];
      if (userRoles.length === 0) return 0;

      // 2. policy ativa
      const { data: policy } = await supabase
        .from('approval_policies')
        .select('threshold_x_tons, threshold_y_tons')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!policy) return 0;

      // 3. operations em aprovação
      const { data: ops } = await supabase
        .from('operations')
        .select('id, volume_sacks')
        .eq('status', 'EM_APROVACAO');
      if (!ops || ops.length === 0) return 0;

      // 4. signatures
      const opIds = ops.map((o) => o.id);
      const { data: sigs } = await supabase
        .from('signatures')
        .select('operation_id, user_id, role_used')
        .in('operation_id', opIds);

      const sigsByOp: Record<string, { user_id: string; role_used: string }[]> = {};
      for (const s of sigs ?? []) {
        if (!sigsByOp[s.operation_id]) sigsByOp[s.operation_id] = [];
        sigsByOp[s.operation_id].push(s);
      }

      let count = 0;
      for (const op of ops) {
        const opSigs = sigsByOp[op.id] ?? [];
        if (opSigs.some((s) => s.user_id === user!.id)) continue;
        const volumeTons = (op.volume_sacks ?? 0) * SACK_TO_TON;
        const required = getRequiredRoles(
          volumeTons,
          (policy as { threshold_x_tons: number }).threshold_x_tons,
          (policy as { threshold_y_tons: number }).threshold_y_tons,
        );
        const collected = opSigs.map((s) => s.role_used);
        const missing = getMissingRoles(required, collected);
        if (userRoles.some((r) => missing.includes(r))) count++;
      }
      return count;
    },
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <div className={`flex items-center justify-center ${collapsed ? 'py-3' : 'py-4 px-3'}`}>
            <img
              src={logo}
              alt="Safra Segura"
              className={collapsed ? 'w-8 h-8 object-contain' : 'w-36 object-contain'}
            />
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const showBadge = item.url === '/aprovacoes' && pendingCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {showBadge && !collapsed && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                            {pendingCount}
                          </Badge>
                        )}
                        {showBadge && collapsed && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isAdmin() && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/usuarios"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Administração</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/50 truncate mb-2">
            {profile?.full_name || user?.email || ''}
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
