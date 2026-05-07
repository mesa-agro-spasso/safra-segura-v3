import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { KeepAliveOutlet } from '@/components/KeepAliveOutlet';
import { useMesaEnv } from '@/contexts/MesaEnvContext';

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
            <KeepAliveOutlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
