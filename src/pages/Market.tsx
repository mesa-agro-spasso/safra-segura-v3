import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MarketFisico from './market/MarketFisico';
import MarketBolsa from './market/MarketBolsa';

const Market = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'bolsa' ? 'bolsa' : 'fisico';

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
      </TabsList>
      <TabsContent value="fisico"><MarketFisico /></TabsContent>
      <TabsContent value="bolsa"><MarketBolsa /></TabsContent>
    </Tabs>
  );
};

export default Market;
