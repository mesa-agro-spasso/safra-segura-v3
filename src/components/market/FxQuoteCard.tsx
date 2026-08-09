import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatFreshness } from '@/hooks/useMarketData';
import { RefreshCw, Clock } from 'lucide-react';
import type { MarketData } from '@/types';

interface FxQuoteCardProps {
  fxRow?: MarketData;
  onRefresh: () => void;
  refreshing: boolean;
  /** Desabilita o botão enquanto outra atualização roda. */
  disabled?: boolean;
  /** Versão enxuta usada na aba Futuros. */
  compact?: boolean;
  /** Slot de edição manual (usado só na aba Dólar). */
  editSlot?: React.ReactNode;
  /** Nota informativa abaixo do badge. */
  footnote?: string;
}

/**
 * Card de cotação USD/BRL — mesma linha de `market_data`, mesma função de
 * atualização. Não guarda estado próprio: atualizar aqui reflete em toda tela
 * que lê `useMarketData`.
 */
const FxQuoteCard = ({
  fxRow, onRefresh, refreshing, disabled, compact, editSlot, footnote,
}: FxQuoteCardProps) => {
  const fresh = fxRow ? formatFreshness(fxRow.updated_at) : null;

  const badge = fresh && fxRow && (
    <div
      title={new Date(fxRow.updated_at).toLocaleString('pt-BR')}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        fresh.stale
          ? 'border-[hsl(var(--warning))] text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]'
          : 'border-border text-muted-foreground'
      }`}
    >
      <Clock className="h-3 w-3" />
      Observado {fresh.label} · {fxRow.source}
    </div>
  );

  const refreshButton = (
    <Button
      variant="outline"
      size={compact ? 'sm' : 'default'}
      onClick={onRefresh}
      disabled={refreshing || disabled}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      {refreshing ? 'Atualizando...' : 'Atualizar câmbio'}
    </Button>
  );

  // Atalho na aba Futuros: faixa fina, sem card. A tela completa é a aba Dólar.
  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap rounded-md border border-border bg-card/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">USD/BRL</span>
        <span className="text-lg font-bold tabular-nums">
          {fxRow?.price != null ? `R$ ${fxRow.price.toFixed(4)}` : '-'}
        </span>
        {badge}
        <div className="ml-auto">{refreshButton}</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Dólar / Real (USD/BRL)</CardTitle>
        {refreshButton}
      </CardHeader>
      <CardContent className="space-y-3">
        {!fxRow ? (
          <p className="text-muted-foreground text-sm">
            Sem cotação gravada. Clique em "Atualizar câmbio".
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-3xl font-bold">
                {fxRow.price != null ? `R$ ${fxRow.price.toFixed(4)}` : '-'}
              </span>
              {editSlot}
              {badge}
            </div>
            {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FxQuoteCard;
