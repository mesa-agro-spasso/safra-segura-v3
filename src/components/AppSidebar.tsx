import { TableProperties, FileText, TrendingUp, BarChart3, DollarSign, Settings, LogOut, Users, ShieldCheck, Warehouse, ClipboardList, Building2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { usePendingApprovalsCount } from '@/hooks/usePendingApprovalsCount';
import { supabase } from '@/integrations/supabase/client';
import logoLight from '/logo-spasso.png';
import logoDark from '/logo-spasso-dark.png';
import iconCollapsed from '/icon-48x48.png';
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

const ROLE_LABELS: Record<string, string> = {
  mesa: 'Mesa',
  comercial_n1: 'Comercial N1',
  comercial_n2: 'Comercial N2',
  admin: 'Admin',
};
const formatRole = (r: string) =>
  ROLE_LABELS[r] ?? r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ');

const items = [
  { title: 'Tabela de Preços', url: '/', icon: TableProperties },
  { title: 'Operações', url: '/operacoes-d24', icon: ClipboardList },
  { title: 'Ordens',    url: '/ordens-d24',    icon: FileText },
  { title: 'Armazéns',  url: '/armazens-d24',  icon: Building2 },
  { title: 'Financeiro', url: '/financeiro', icon: DollarSign },
  { title: 'Mercado', url: '/mercado', icon: BarChart3 },
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user, profile } = useAuth();
  const { isAdmin } = useAuthorization();
  const { data: pendingCount = 0 } = usePendingApprovalsCount();
  const { data: userRoles = [] } = useQuery({
    queryKey: ['sidebar-user-roles', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase.from('users') as any)
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      return (data?.roles as string[] | undefined) ?? [];
    },
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <div className={`flex items-center justify-center ${collapsed ? 'py-3' : 'py-4 px-3'}`}>
            {collapsed ? (
              <img src={iconCollapsed} alt="Grupo Spasso" className="w-8 h-8 object-contain" />
            ) : (
              <>
                <img src={logoLight} alt="Grupo Spasso" className="w-44 object-contain block dark:hidden" />
                <img src={logoDark} alt="Grupo Spasso" className="w-44 object-contain hidden dark:block" />
              </>
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/aprovacoes"
                    className="hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {!collapsed && <span className="flex-1">Aprovações</span>}
                    {pendingCount > 0 && (
                      <Badge
                        variant="destructive"
                        className={collapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto h-5 min-w-5 px-1.5'}
                      >
                        {pendingCount}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
          <div className="mb-2 space-y-0.5">
            <Link
              to="/perfil"
              className="block text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground truncate transition-colors"
            >
              {profile?.full_name || user?.email || ''}
            </Link>
            {userRoles.length > 0 && (
              <p className="text-[10px] text-sidebar-foreground/40 truncate">
                {userRoles.map(formatRole).join(' · ')}
              </p>
            )}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
