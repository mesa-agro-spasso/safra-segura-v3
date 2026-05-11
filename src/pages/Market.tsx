import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MarketFisico from './market/MarketFisico';
import MarketBolsa from './market/MarketBolsa';
import MarketHistorico from './market/MarketHistorico';

const VALID = ['fisico', 'bolsa', 'historico'] as const;
type Tab = typeof VALID[number];

const Market = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = (VALID as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as Tab)
    : 'fisico';

  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="fisico">Físico</TabsTrigger>
        <TabsTrigger value="bolsa">Bolsa</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>
      <TabsContent value="fisico"><MarketFisico /></TabsContent>
      <TabsContent value="bolsa"><MarketBolsa /></TabsContent>
      <TabsContent value="historico"><MarketHistorico /></TabsContent>
    </Tabs>
  );
};

export default Market;
