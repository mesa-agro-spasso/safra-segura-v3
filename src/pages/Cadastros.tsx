import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityTab } from '@/components/cadastros/EntityTab';
import { PendingTab } from '@/components/cadastros/PendingTab';
import { ENTITY_CONFIGS } from '@/components/cadastros/entityConfigs';
import { useRegistryPending } from '@/hooks/useRegistryPending';

export default function Cadastros() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { count } = useRegistryPending();

  const validTabs = [...ENTITY_CONFIGS.map((c) => c.table), 'pending'];
  const defaultTab = ENTITY_CONFIGS[0].table;
  const tabParam = searchParams.get('tab');
  const tab = tabParam && validTabs.includes(tabParam) ? tabParam : defaultTab;

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Entidades de referência do sistema. Registros não podem ser excluídos — apenas inativados.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {ENTITY_CONFIGS.map((c) => (
            <TabsTrigger key={c.table} value={c.table}>
              {c.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="pending">Pendências{count > 0 ? ` (${count})` : ''}</TabsTrigger>
        </TabsList>
        {ENTITY_CONFIGS.map((c) => (
          <TabsContent key={c.table} value={c.table} className="mt-4">
            <EntityTab config={c} />
          </TabsContent>
        ))}
        <TabsContent value="pending" className="mt-4">
          <PendingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
