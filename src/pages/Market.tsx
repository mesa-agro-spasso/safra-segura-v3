import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FEATURES } from '@/config/features';
import MarketFisico from './market/MarketFisico';
import MarketBolsa from './market/MarketBolsa';
import MarketHistorico from './market/MarketHistorico';

type Tab = 'fisico' | 'bolsa' | 'historico';

const Market = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Build the visible-tabs list from feature flags. Bolsa is always visible.
  const visibleTabs: Tab[] = [
    ...(FEATURES.MARKET_PHYSICAL ? (['fisico'] as const) : []),
    'bolsa',
    ...(FEATURES.MARKET_HISTORICAL ? (['historico'] as const) : []),
  ];
  const defaultTab: Tab = visibleTabs[0];

  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && visibleTabs.includes(tabParam) ? tabParam : defaultTab;

  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  // Hide the tab bar entirely when only a single tab is visible (redundant UI).
  const showTabsList = visibleTabs.length > 1;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      {showTabsList && (
        <TabsList>
          {visibleTabs.includes('fisico') && <TabsTrigger value="fisico">Físico</TabsTrigger>}
          <TabsTrigger value="bolsa">Bolsa</TabsTrigger>
          {visibleTabs.includes('historico') && <TabsTrigger value="historico">Histórico</TabsTrigger>}
        </TabsList>
      )}
      {visibleTabs.includes('fisico') && (
        <TabsContent value="fisico"><MarketFisico /></TabsContent>
      )}
      <TabsContent value="bolsa"><MarketBolsa /></TabsContent>
      {visibleTabs.includes('historico') && (
        <TabsContent value="historico"><MarketHistorico /></TabsContent>
      )}
    </Tabs>
  );
};

export default Market;
