import { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { callApi } from '@/lib/api';
import { useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { usePricingCombinations } from '@/hooks/usePricingCombinations';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestOptionQuotes, type OptionQuote } from '@/hooks/useInsuranceOptions';

import { DiscardedCombinationsList } from '@/components/DiscardedCombinationsList';
import type { Warehouse, MarketData, PricingSnapshot, DiscardedCombination } from '@/types';

/**
 * Data de negócio da mesa (fuso de Brasília), formato ISO YYYY-MM-DD.
 * É apenas formatação de fuso — nenhuma regra de negócio de data no frontend.
 */
function getTradeDateBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}


// A tradução do vocabulário de período de juros é responsabilidade do backend.




interface GeneratePricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratePricingModal({ open, onOpenChange }: GeneratePricingModalProps) {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: combinations } = usePricingCombinations(true);
  const saveSnapshots = useSavePricingSnapshots();
  const { data: latestQuotes } = useLatestOptionQuotes();
  const { user } = useAuth();
  
  const [generating, setGenerating] = useState(false);
  const [discarded, setDiscarded] = useState<DiscardedCombination[] | null>(null);
  /** Linhas com seguro que a API devolveu sem custo de seguro — não gravadas. */
  const [insuranceFailures, setInsuranceFailures] = useState<string[]>([]);

  const handleOpenChange = (next: boolean) => {
    if (!next) { setDiscarded(null); setInsuranceFailures([]); }
    onOpenChange(next);
  };


  const spotRate = useMemo(() => {
    return marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null;
  }, [marketData]);

  const marketMap = useMemo(() => {
    const m: Record<string, MarketData> = {};
    marketData?.forEach((md) => { m[md.ticker] = md; });
    return m;
  }, [marketData]);

  const warehouseMap = useMemo(() => {
    const m: Record<string, Warehouse> = {};
    warehouses?.forEach((w) => { m[w.id] = w; });
    return m;
  }, [warehouses]);

  const uniqueWarehouses = useMemo(() => {
    if (!combinations) return 0;
    return new Set(combinations.map((c) => c.warehouse_id)).size;
  }, [combinations]);

  const { b3MissingPrice } = useMemo(() => {
    const missing: string[] = [];
    for (const c of combinations ?? []) {
      if (c.commodity === 'corn' && c.benchmark === 'b3') {
        const m = marketMap[c.ticker];
        if (!m || m.price == null) missing.push(c.ticker);
      }
    }
    return { b3MissingPrice: missing };
  }, [combinations, marketMap]);

  // Corn CBOT requires fresh market data (futures price). NDF is no longer a pricing input.
  const cornCbotStale = useMemo(() => {
    const stale: { ticker: string; hours: number }[] = [];
    const seen = new Set<string>();
    for (const c of combinations ?? []) {
      if (!(c.commodity === 'corn' && c.benchmark === 'cbot')) continue;
      if (seen.has(c.ticker)) continue;
      seen.add(c.ticker);
      const m = marketMap[c.ticker];
      if (!m) continue;
      if (m.updated_at) {
        const hours = getHoursAgo(m.updated_at);
        if (hours > 24) stale.push({ ticker: c.ticker, hours });
      }
    }
    return stale;
  }, [combinations, marketMap]);

  // Any CBOT line (soybean or corn) needs the spot USD/BRL — the API resolves the rate from it.
  const hasCbotCombo = useMemo(
    () => (combinations ?? []).some((c) => c.benchmark === 'cbot'),
    [combinations],
  );

  const needsSpot = hasCbotCombo;
  const canGenerate = (combinations?.length ?? 0) > 0
    && (!needsSpot || spotRate !== null)
    && cornCbotStale.length === 0;

  const handleGenerate = async () => {
    if (!canGenerate || !combinations || !marketData || !warehouses) return;

    if (cornCbotStale.length > 0) {
      const detail = cornCbotStale.map((s) => `${s.ticker} (atualizado há ${s.hours}h)`).join(', ');

      toast.error(`Dados de mercado desatualizados para ${detail} — atualize a aba Mercado antes de gerar`);
      return;
    }

    // Data de negócio da mesa (Brasília) — enviada em TODA requisição.
    const tradeDate = getTradeDateBRT();

    const payload: Record<string, unknown>[] = [];
    // Cotação usada por índice do payload — o único vínculo entre o preço e o prêmio.
    const quoteByIndex: (OptionQuote | null)[] = [];
    const coverageByIndex: (number | null)[] = [];
    const carryByIndex: (string | null)[] = [];

    for (const combo of combinations) {
      const market = marketMap[combo.ticker];

      // B3 combo without price — already warned in modal UI, skip silently
      if (combo.commodity === 'corn' && combo.benchmark === 'b3' && (!market || market.price == null)) {
        continue;
      }

      if (!market) {
        toast.warning(`Ticker ${combo.ticker} não encontrado em market_data — pulando`);
        continue;
      }

      const warehouse = warehouseMap[combo.warehouse_id];
      if (!warehouse) continue;

      // Período de juros: enviado cru na camada do armazém; o backend traduz o vocabulário
      // e descarta a linha se o cadastro for inválido.



      

      // Resolve exp_date
      const expDate = combo.exp_date ?? market.exp_date ?? null;

      // PROTEÇÃO: Evitar erro "T must be positive" no Black-76
      if (expDate) {
        const exp = new Date(expDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        exp.setHours(0, 0, 0, 0);
        
        if (exp <= today) {
          toast.warning(`Combinação ${combo.ticker} ignorada: contrato já venceu.`);
          continue;
        }
      } else {
        toast.warning(`Combinação ${combo.ticker} ignorada: sem data de vencimento.`);
        continue;
      }

      // Resolve payment_date
      // is_spot=true: NÃO enviar payment_date — a API resolve a data de pagamento.
      // is_spot=false: envia exatamente o que está cadastrado, sem ajuste.
      const isSpot = combo.is_spot ?? false;
      let paymentDate: string | null = null;
      if (!isSpot) {
        if (!combo.payment_date) {
          toast.warning(`Combinação ${combo.ticker}/${warehouse.display_name} sem payment_date — pulando`);
          continue;
        }
        paymentDate = combo.payment_date;
      }

      // NOTA: o tratamento de payment_date vencido é responsabilidade da API
      // (está sendo implementado no backend). O frontend não empurra datas.

      // Resolve grain_reception_date.
      // Grão já entregue: a armazenagem corre da compra, então vale a data da geração.
      const grainReceptionDate = combo.grain_already_delivered
        ? tradeDate
        : combo.grain_reception_date ?? paymentDate;


      // Herança de custos é do BACKEND. O frontend manda as duas camadas cruas,
      // sem escolher entre elas e sem converter null <-> 0.
      const combinationLayer: Record<string, unknown> = {
        interest_rate: combo.interest_rate,
        storage_cost: combo.storage_cost,
        storage_cost_type: combo.storage_cost_type,
        reception_cost: combo.reception_cost,
        brokerage_per_contract: combo.brokerage_per_contract,
        desk_cost_pct: combo.desk_cost_pct,
        shrinkage_rate_monthly: combo.shrinkage_rate_monthly,
      };

      const warehouseLayer: Record<string, unknown> = {
        interest_rate: warehouse.interest_rate,
        interest_rate_period: warehouse.interest_rate_period,
        storage_cost: warehouse.storage_cost,
        storage_cost_type: warehouse.storage_cost_type,
        reception_cost: warehouse.reception_cost,
        brokerage_per_contract_cbot: warehouse.brokerage_per_contract_cbot,
        brokerage_per_contract_b3: warehouse.brokerage_per_contract_b3,
        desk_cost_pct: warehouse.desk_cost_pct,
        shrinkage_rate_monthly: warehouse.shrinkage_rate_monthly,
      };

      // ZERO CÁLCULO DE CÂMBIO NO FRONTEND.
      // A API resolve a taxa a partir do spot enviado no nível da requisição.
      // Só repassamos o override manual da mesa, e apenas em linhas CBOT
      // (milho B3 com qualquer campo de câmbio retorna 422).
      const isCbot = combo.benchmark === 'cbot';
      const fxOverride = isCbot ? market.ndf_override ?? null : null;

      const pricingMethod = combo.pricing_method ?? 'LONG_BASIS';

      // ---- Seguro: prêmio CRU da cotação, sem nenhuma conversão. ----
      let insuranceFields: Record<string, unknown> = {};
      let usedQuote: OptionQuote | null = null;
      if (combo.insurance_option_id) {
        const quote = latestQuotes?.[combo.insurance_option_id] ?? null;
        if (!quote) {
          toast.warning(
            `Combinação ${combo.ticker}/${warehouse.display_name} tem seguro sem cotação — cadastre o prêmio em Mercado > Opções`,
          );
          continue;
        }
        usedQuote = quote;
        insuranceFields = {
          ...(isCbot
            ? { insurance_premium_usd_bushel: quote.premium_usd_bushel }
            : { insurance_premium_brl_sack: quote.premium_brl_sack }),
          insurance_coverage_pct: combo.insurance_coverage_pct,
          insurance_quote_trade_date: quote.trade_date,
          ...(combo.insurance_carry_until ? { insurance_carry_until: combo.insurance_carry_until } : {}),
        };
      }

      const baseCombo: Record<string, unknown> = {
        warehouse_id: combo.warehouse_id,
        display_name: warehouse.display_name,
        commodity: combo.commodity,
        benchmark: combo.benchmark,
        ticker: combo.ticker,
        exp_date: expDate,
        is_spot: isSpot,
        // payment_date só é enviado quando não é spot (a API resolve o spot)
        ...(isSpot ? {} : { payment_date: paymentDate }),
        sale_date: combo.sale_date,
        grain_reception_date: grainReceptionDate,
        pricing_method: pricingMethod,

        futures_price: market.price,
        ...(fxOverride != null ? { exchange_rate_override: fxOverride } : {}),
        ...insuranceFields,

        warehouse: warehouseLayer,
      };

      const trackInsurance = () => {
        quoteByIndex.push(usedQuote);
        coverageByIndex.push(usedQuote ? combo.insurance_coverage_pct ?? null : null);
        carryByIndex.push(usedQuote ? combo.insurance_carry_until ?? null : null);
      };

      if (pricingMethod === 'LONG_BASIS') {
        if (combo.target_basis == null) {
          toast.warning(`Combinação ${combo.ticker}/${warehouse.display_name} (Long Basis) sem target_basis — pulando`);
          continue;
        }
        payload.push({
          ...baseCombo,
          target_basis: combo.target_basis,
          combination: {
            ...combinationLayer,
            additional_discount_brl: combo.additional_discount_brl,
          },
        });
        trackInsurance();
      } else if (pricingMethod === 'TARGET_PRICE') {
        if (combo.origination_price_net_brl == null) {
          toast.warning(`Combinação ${combo.ticker}/${warehouse.display_name} (Target Price) sem origination_price_net_brl — pulando`);
          continue;
        }
        payload.push({
          ...baseCombo,
          origination_price_net_brl: combo.origination_price_net_brl,
          // additional_discount_brl é OMITIDO aqui: zero inventado pelo frontend
          // carimbaria origem falsa em resolved_inputs.
          combination: { ...combinationLayer },
        });
        trackInsurance();
      } else {
        toast.warning(`Combinação ${combo.ticker}/${warehouse.display_name} com pricing_method desconhecido '${pricingMethod}' — pulando`);
        continue;
      }
    }

    if (payload.length === 0) {
      toast.error('Nenhuma combinação válida — verifique tickers e market_data');
      return;
    }

    setGenerating(true);
    setDiscarded(null); setInsuranceFailures([]);
    try {
      const result = await callApi<{
        results: Record<string, unknown>[];
        discarded?: DiscardedCombination[];
      }>('/pricing/table', {
        trade_date: tradeDate,
        // Dólar à vista da mesa (market_data USD/BRL, já refletindo fx_override).
        spot_usd_brl: spotRate,
        combinations: payload,
      });


      const apiResults = result?.results ?? [];
      const apiDiscarded = result?.discarded ?? [];

      // Os resultados voltam apenas para as linhas não descartadas; o `index`
      // do descarte é a única forma de recasar resultado ↔ payload enviado.
      const discardedIdx = new Set(apiDiscarded.map((d) => d.index));
      const keptIndexes = payload.map((_, i) => i).filter((i) => !discardedIdx.has(i));

      // Linhas com seguro cuja resposta não trouxe costs.insurance_brl: não gravar.
      // Gravar as quatro colunas nulas produziria um preço já descontado do seguro
      // sem nenhum registro do seguro — pior que o snapshot faltando.
      const notSaved: string[] = [];

      if (apiResults.length) {
        const snapshots = apiResults.map((r: Record<string, unknown>, idx: number) => {
          const payloadIdx = keptIndexes[idx] ?? idx;
          const orig = payload[payloadIdx] ?? {};
          const quote = quoteByIndex[payloadIdx] ?? null;
          const costs = (r.costs ?? null) as Record<string, unknown> | null;
          const insuranceCost = costs?.insurance_brl;

          if (quote && (insuranceCost == null)) {
            notSaved.push(
              `${orig.display_name ?? orig.warehouse_id} / ${orig.ticker}`,
            );
            return null;
          }

          return {
            warehouse_id: r.warehouse_id ?? orig.warehouse_id,
            commodity: r.commodity ?? orig.commodity,
            benchmark: r.benchmark ?? orig.benchmark,
            ticker: r.ticker ?? orig.ticker,
            trade_date: r.trade_date_used ?? tradeDate,
            sale_date: r.sale_date ?? orig.sale_date,
            payment_date: r.payment_date ?? orig.payment_date,
            grain_reception_date: r.grain_reception_date ?? orig.grain_reception_date,
            // Taxa resolvida pela API — não mais o câmbio escolhido no frontend.
            exchange_rate: (r.exchange_rate as number | null | undefined) ?? null,
            target_basis_brl: r.target_basis_brl ?? 0,
            futures_price_brl: r.futures_price_brl ?? 0,
            origination_price_brl: r.origination_price_brl ?? 0,
            additional_discount_brl:
              r.additional_discount_brl
              ?? (orig.combination as Record<string, unknown> | undefined)?.additional_discount_brl
              ?? 0,
            // As quatro juntas ou as quatro nulas — exigência do CHECK do banco.
            insurance_quote_id: quote ? quote.id : null,
            insurance_coverage_pct: quote ? coverageByIndex[payloadIdx] ?? null : null,
            insurance_cost_brl: quote ? Number(insuranceCost) : null,
            insurance_carry_until: quote ? carryByIndex[payloadIdx] ?? null : null,
            inputs_json: {
              pricing_method: orig.pricing_method,
              futures_price: orig.futures_price,
              spot_usd_brl: spotRate,
              exchange_rate_override: orig.exchange_rate_override ?? null,
              exp_date: orig.exp_date ?? null,
              target_basis: orig.target_basis ?? null,
              origination_price_net_brl: orig.origination_price_net_brl ?? null,
              // Camadas de custo enviadas, cruas — a resolução é do backend.
              combination: orig.combination ?? null,
              warehouse: orig.warehouse ?? null,
            },
            outputs_json: { ...r },

            created_by: user?.id ?? null,
          } as Omit<PricingSnapshot, 'id' | 'created_at'>;
        }).filter((s): s is Omit<PricingSnapshot, 'id' | 'created_at'> => s !== null);

        if (snapshots.length) await saveSnapshots.mutateAsync(snapshots);
      }

      if (notSaved.length > 0) {
        setInsuranceFailures(notSaved);
      }


      if (apiDiscarded.length > 0) {
        // Mantém o modal aberto: a tabela só aparece após a confirmação.
        setDiscarded(apiDiscarded);
        toast.success(
          `Tabela gerada: ${apiResults.length} preços calculados, ${apiDiscarded.length} combinação(ões) descartada(s)`,
        );
      } else if (notSaved.length > 0) {
        // O aviso persistente já está na tela: não fecha o modal.
        toast.error(`${notSaved.length} linha(s) com seguro não foram salvas`);
      } else if (apiResults.length) {
        toast.success(`Tabela gerada: ${apiResults.length} preços calculados`);
        onOpenChange(false);
      } else {
        toast.warning('API retornou 0 snapshots');
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : JSON.stringify(err);
      toast.error(`Erro ao gerar tabela: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  if (insuranceFailures.length > 0) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preços com seguro não gravados</DialogTitle>
            <DialogDescription>
              A API devolveu o preço destas linhas sem o custo do seguro. Gravar assim
              produziria um preço já descontado do seguro sem nenhum registro de que houve
              seguro — por isso nada foi salvo para elas. Avise o time técnico.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1 py-2">
            {insuranceFailures.map((label) => (
              <li key={label} className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {label}
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (discarded && discarded.length > 0) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Combinações descartadas</DialogTitle>
            <DialogDescription>
              {discarded.length} combinação(ões) não entraram na tabela. Corrija o cadastro em
              Configurações → Combinações.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <DiscardedCombinationsList items={discarded} />
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Tabela de Preços</DialogTitle>
          <DialogDescription>
            A tabela será gerada com base nas combinações ativas cadastradas em Configurações.
          </DialogDescription>
        </DialogHeader>


        <div className="space-y-3 py-2">
          <p className="text-sm">
            <span className="font-semibold">{combinations?.length ?? 0}</span> combinações ativas para{' '}
            <span className="font-semibold">{uniqueWarehouses}</span> armazéns
          </p>

          {needsSpot ? (
            spotRate !== null ? (
              <p className="text-xs text-muted-foreground">USD/BRL à vista: {spotRate.toFixed(4)}</p>
            ) : (
              <p className="text-xs text-destructive">USD/BRL não disponível — atualize dados de mercado primeiro</p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">Spot USD/BRL não necessário (nenhuma combinação CBOT)</p>
          )}

          {cornCbotStale.length > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 space-y-1">
              <p className="text-xs font-semibold text-destructive">
                ⛔ Geração bloqueada — Milho CBOT
              </p>
              <p className="text-xs text-destructive">
                Dados de mercado desatualizados para{' '}
                {cornCbotStale.map((s) => `${s.ticker} (há ${s.hours}h)`).join(', ')} — atualize a aba Mercado antes de gerar.
              </p>
            </div>
          )}


          {b3MissingPrice.length > 0 && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1">
              <p className="text-xs font-semibold text-yellow-500">
                ⚠ {b3MissingPrice.length} ticker(s) B3 sem preço — serão pulados:
              </p>
              <ul className="text-xs text-yellow-400 list-disc pl-4">
                {b3MissingPrice.map(t => <li key={t}>{t}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">
                Preencha os preços na aba Mercado → Milho B3 antes de gerar.
              </p>
            </div>
          )}

          {combinations?.length === 0 && (
            <p className="text-xs text-destructive">Nenhuma combinação ativa. Cadastre combinações em Configurações → Combinações.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
            <RefreshCw className={cn('mr-2 h-4 w-4', generating && 'animate-spin')} />
            {generating ? 'Gerando...' : 'Gerar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
