import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { KeepAliveOutlet, KeepAliveRoute } from '@/components/KeepAliveOutlet';
import { AdminRoute } from '@/components/AdminRoute';
import { useMesaEnv } from '@/contexts/MesaEnvContext';
import { FEATURES } from '@/config/features';
import PricingTable from '@/pages/PricingTable';
import OrdensD24 from '@/pages/OrdensD24';
import Approvals from '@/pages/Approvals';
import OperacoesD24 from '@/pages/OperacoesD24';
import ArmazensD24 from '@/pages/ArmazensD24';
import Market from '@/pages/Market';
import Producers from '@/pages/Producers';
import Settings from '@/pages/Settings';
import AdminUsers from '@/pages/AdminUsers';
import Financial from '@/pages/Financial';
import Profile from '@/pages/Profile';
import NotFound from '@/pages/NotFound';

const routes: KeepAliveRoute[] = [
  { path: '/', element: <PricingTable />, end: true },
  { path: '/ordens-d24', element: <OrdensD24 /> },
  { path: '/aprovacoes', element: <Approvals /> },
  { path: '/operacoes-d24', element: <OperacoesD24 /> },
  { path: '/armazens-d24', element: <ArmazensD24 /> },
  { path: '/mercado', element: <Market /> },
  { path: '/produtores', element: <Producers /> },
  { path: '/financeiro', element: <Financial /> },
  { path: '/configuracoes', element: <Settings /> },
  { path: '/perfil', element: <Profile /> },
  { path: '/admin/usuarios', element: <AdminRoute><AdminUsers /></AdminRoute> },
];

export function AppLayout() {
  const { isStaging } = useMesaEnv();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {isStaging && (
            <div className="bg-yellow-500 text-black text-center text-xs font-bold py-1 tracking-wider">
              ⚠️ AMBIENTE DE STAGING — dados fictícios, alterações não afetam produção
            </div>
          )}
          <header className="h-12 flex items-center border-b border-border px-4">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-semibold text-foreground/80">Mesa Integrada de Hedge</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <KeepAliveOutlet routes={routes} fallback={<NotFound />} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
