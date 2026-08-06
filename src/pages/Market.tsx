import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FEATURES } from '@/config/features';
import MarketFisico from './market/MarketFisico';
import MarketFuturos from './market/MarketFuturos';
import MarketDolar from './market/MarketDolar';
import MarketHistorico from './market/MarketHistorico';

type TabSpec = {
  id: string;
  label: string;
  element: React.ReactNode;
  enabled: boolean;
};

/** Adicionar uma aba nova (ex.: Opções) = uma entrada nesta lista. */
const TAB_SPECS: TabSpec[] = [
  { id: 'fisico', label: 'Físico', element: <MarketFisico />, enabled: FEATURES.MARKET_PHYSICAL },
  { id: 'futuros', label: 'Futuros', element: <MarketFuturos />, enabled: true },
  { id: 'dolar', label: 'Dólar', element: <MarketDolar />, enabled: true },
  { id: 'historico', label: 'Histórico', element: <MarketHistorico />, enabled: FEATURES.MARKET_HISTORICAL },
];

/** Links antigos continuam funcionando. */
const TAB_ALIASES: Record<string, string> = { bolsa: 'futuros' };

const Market = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = TAB_SPECS.filter((t) => t.enabled);
  const defaultTab = tabs[0].id;

  const raw = searchParams.get('tab');
  const resolved = raw ? (TAB_ALIASES[raw] ?? raw) : null;
  const tab = resolved && tabs.some((t) => t.id === resolved) ? resolved : defaultTab;

  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  const showTabsList = tabs.length > 1;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      {showTabsList && (
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      )}
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id}>{t.element}</TabsContent>
      ))}
    </Tabs>
  );
};

export default Market;
