import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import HistoricoBolsa from './historico/HistoricoBolsa';
import HistoricoFisico from './historico/HistoricoFisico';
import HistoricoTerceiros from './historico/HistoricoTerceiros';

const VALID = ['bolsa', 'fisico', 'terceiros'] as const;
type Sub = typeof VALID[number];

const MarketHistorico = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subParam = searchParams.get('sub');
  const sub: Sub = (VALID as readonly string[]).includes(subParam ?? '')
    ? (subParam as Sub)
    : 'bolsa';

  const setSub = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sub', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <Tabs value={sub} onValueChange={setSub} className="space-y-4">
      <TabsList>
        <TabsTrigger value="bolsa">Bolsa</TabsTrigger>
        <TabsTrigger value="fisico">Físico</TabsTrigger>
        <TabsTrigger value="terceiros">Terceiros</TabsTrigger>
      </TabsList>
      <TabsContent value="bolsa"><HistoricoBolsa /></TabsContent>
      <TabsContent value="fisico"><HistoricoFisico /></TabsContent>
      <TabsContent value="terceiros"><HistoricoTerceiros /></TabsContent>
    </Tabs>
  );
};

export default MarketHistorico;
