import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { HelpDrawer } from '@/components/HelpDrawer';
import { KeepAliveOutlet, KeepAliveRoute } from '@/components/KeepAliveOutlet';
import { AdminRoute } from '@/components/AdminRoute';

import { FEATURES } from '@/config/features';
import PricingTable from '@/pages/PricingTable';
import Cockpit from '@/pages/Cockpit';

import Approvals from '@/pages/Approvals';
import Market from '@/pages/Market';
import Settings from '@/pages/Settings';
import Cadastros from '@/pages/Cadastros';
import Financial from '@/pages/Financial';
import Profile from '@/pages/Profile';
import Ajuda from '@/pages/Ajuda';
import NotFound from '@/pages/NotFound';

const routes: KeepAliveRoute[] = [
  { path: '/', element: <PricingTable />, end: true },
  { path: '/cockpit', element: <Cockpit /> },

  { path: '/ajuda', element: <Ajuda /> },
  { path: '/aprovacoes', element: <Approvals /> },
  { path: '/mercado', element: <Market /> },
  ...(FEATURES.FINANCIAL_CALENDAR ? [{ path: '/financeiro', element: <Financial /> }] : []),
  { path: '/configuracoes', element: <Settings /> },
  { path: '/perfil', element: <Profile /> },
  { path: '/cadastros', element: <AdminRoute><Cadastros /></AdminRoute> },
];

export function AppLayout() {
  const { pathname } = useLocation();
  const showHelp = pathname !== '/ajuda';
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-semibold text-foreground/80">Mesa Integrada de Hedge</h1>
            {showHelp && (
              <div className="ml-auto">
                <HelpDrawer />
              </div>
            )}
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <KeepAliveOutlet routes={routes} fallback={<NotFound />} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
