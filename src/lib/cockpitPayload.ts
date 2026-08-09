import type { PricingCombination, Warehouse, MarketData, PricingSnapshot } from '@/types';
import type { OptionQuote } from '@/hooks/useInsuranceOptions';

/** Campos editáveis no cockpit. Espelham colunas de pricing_combinations. */
export interface CockpitOverrides {
  interest_rate?: number | null;
  storage_cost?: number | null;
  storage_cost_type?: string | null;
  reception_cost?: number | null;
  brokerage_per_contract?: number | null;
  desk_cost_pct?: number | null;
  shrinkage_rate_monthly?: number | null;
  additional_discount_brl?: number | null;
  target_basis?: number | null;
  /** Datas da combinação. Ajuste fino de prazo, não camada de custo. */
  payment_date?: string | null;
  grain_reception_date?: string | null;
  sale_date?: string | null;
  is_spot?: boolean | null;
  /** Grão já no armazém: a recepção é resolvida pela data da geração. */
  grain_already_delivered?: boolean | null;
}

export type OverridesMap = Record<string, CockpitOverrides>;

export const EDITABLE_FIELDS: (keyof CockpitOverrides)[] = [
  'interest_rate',
  'storage_cost',
  'storage_cost_type',
  'reception_cost',
  'brokerage_per_contract',
  'desk_cost_pct',
  'shrinkage_rate_monthly',
  'additional_discount_brl',
  'target_basis',
  'payment_date',
  'grain_reception_date',
  'sale_date',
  'is_spot',
  'grain_already_delivered',
];


/**
 * Data de negócio da mesa (fuso de Brasília), formato ISO YYYY-MM-DD.
 * Apenas formatação de fuso — nenhuma regra de negócio de data no frontend.
 */
export function getTradeDateBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export interface BuildPayloadArgs {
  combinations: PricingCombination[];
  warehouseMap: Record<string, Warehouse>;
  marketMap: Record<string, MarketData>;
  overrides: OverridesMap;
  /** Data de negócio da geração. Vale como recepção quando o grão já foi entregue. */
  tradeDate: string;
  /** Cotação mais recente por opção de seguro. Sem ela, linha com seguro é pulada. */
  latestQuotes?: Record<string, OptionQuote>;
}

/** Seguro efetivamente enviado numa linha do payload. */
export interface InsuranceUsed {
  quote: OptionQuote;
  coverage_pct: number | null;
  carry_until: string | null;
}

export interface BuildPayloadResult {
  /** Linhas do POST /pricing/table, na ordem enviada. */
  payload: Record<string, unknown>[];
  /** id da combinação para cada índice de `payload`. */
  comboIds: string[];
  /** Seguro usado em cada índice de `payload` (null quando a linha não tem seguro). */
  insuranceByIndex: (InsuranceUsed | null)[];
  /** Linhas puladas antes da chamada, com o motivo em português. */
  skipped: { comboId: string; label: string; reason: string }[];
}


/** Lê o valor efetivo de um campo: override da sessão, senão o cadastro da combinação. */
export function effectiveValue<K extends keyof CockpitOverrides>(
  combo: PricingCombination,
  overrides: CockpitOverrides | undefined,
  field: K,
): CockpitOverrides[K] {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, field)) {
    return overrides[field];
  }
  return (combo as unknown as Record<string, unknown>)[field] as CockpitOverrides[K];
}

/**
 * Monta o payload em camadas de POST /pricing/table.
 * Nenhuma aritmética: só cópia de campos e escolha entre override e cadastro.
 */
export function buildCockpitPayload({
  combinations,
  warehouseMap,
  marketMap,
  overrides,
  tradeDate,
  latestQuotes,
}: BuildPayloadArgs): BuildPayloadResult {
  const payload: Record<string, unknown>[] = [];
  const comboIds: string[] = [];
  const insuranceByIndex: (InsuranceUsed | null)[] = [];
  const skipped: BuildPayloadResult['skipped'] = [];

  for (const combo of combinations) {
    const warehouse = warehouseMap[combo.warehouse_id];
    const label = `${warehouse?.display_name ?? combo.warehouse_id} · ${combo.ticker}`;
    const ov = overrides[combo.id];

    const market = marketMap[combo.ticker];

    if (combo.commodity === 'corn' && combo.benchmark === 'b3' && (!market || market.price == null)) {
      skipped.push({ comboId: combo.id, label, reason: 'Ticker B3 sem preço em Mercado.' });
      continue;
    }
    if (!market) {
      skipped.push({ comboId: combo.id, label, reason: 'Ticker não encontrado em dados de mercado.' });
      continue;
    }
    if (!warehouse) {
      skipped.push({ comboId: combo.id, label, reason: 'Armazém não encontrado ou inativo.' });
      continue;
    }

    const expDate = combo.exp_date ?? market.exp_date ?? null;
    if (!expDate) {
      skipped.push({ comboId: combo.id, label, reason: 'Sem data de vencimento.' });
      continue;
    }
    const exp = new Date(expDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    if (exp <= today) {
      skipped.push({ comboId: combo.id, label, reason: 'Contrato já venceu.' });
      continue;
    }

    const isSpot = effectiveValue(combo, ov, 'is_spot') ?? false;
    const ownPaymentDate = effectiveValue(combo, ov, 'payment_date') ?? null;
    let paymentDate: string | null = null;
    if (!isSpot) {
      if (!ownPaymentDate) {
        skipped.push({ comboId: combo.id, label, reason: 'Sem data de pagamento cadastrada.' });
        continue;
      }
      paymentDate = ownPaymentDate;
    }
    const grainDelivered = !!(effectiveValue(combo, ov, 'grain_already_delivered') ?? false);
    const grainReceptionDate = grainDelivered
      ? tradeDate
      : effectiveValue(combo, ov, 'grain_reception_date') ?? paymentDate;
    const saleDate = effectiveValue(combo, ov, 'sale_date') ?? combo.sale_date;


    // Camadas cruas. A herança é do backend — nada de null <-> 0 aqui.
    const combinationLayer: Record<string, unknown> = {
      interest_rate: effectiveValue(combo, ov, 'interest_rate'),
      storage_cost: effectiveValue(combo, ov, 'storage_cost'),
      storage_cost_type: effectiveValue(combo, ov, 'storage_cost_type'),
      reception_cost: effectiveValue(combo, ov, 'reception_cost'),
      brokerage_per_contract: effectiveValue(combo, ov, 'brokerage_per_contract'),
      desk_cost_pct: effectiveValue(combo, ov, 'desk_cost_pct'),
      shrinkage_rate_monthly: effectiveValue(combo, ov, 'shrinkage_rate_monthly'),
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

    const isCbot = combo.benchmark === 'cbot';
    const fxOverride = isCbot ? market.ndf_override ?? null : null;
    const pricingMethod = combo.pricing_method ?? 'LONG_BASIS';

    // ---- Seguro: prêmio CRU da cotação, sem nenhuma conversão. ----
    let insuranceFields: Record<string, unknown> = {};
    let insuranceUsed: InsuranceUsed | null = null;
    if (combo.insurance_option_id) {
      const quote = latestQuotes?.[combo.insurance_option_id] ?? null;
      if (!quote) {
        skipped.push({
          comboId: combo.id,
          label,
          reason: 'Seguro sem cotação — cadastre o prêmio em Mercado > Opções.',
        });
        continue;
      }
      insuranceUsed = {
        quote,
        coverage_pct: combo.insurance_coverage_pct ?? null,
        carry_until: combo.insurance_carry_until ?? null,
      };
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
      ...(isSpot ? {} : { payment_date: paymentDate }),
      sale_date: saleDate,
      grain_reception_date: grainReceptionDate,
      pricing_method: pricingMethod,
      futures_price: market.price,
      ...(fxOverride != null ? { exchange_rate_override: fxOverride } : {}),
      ...insuranceFields,
      warehouse: warehouseLayer,
    };

    if (pricingMethod === 'LONG_BASIS') {
      const targetBasis = effectiveValue(combo, ov, 'target_basis');
      if (targetBasis == null) {
        skipped.push({ comboId: combo.id, label, reason: 'Long Basis sem basis alvo.' });
        continue;
      }
      payload.push({
        ...baseCombo,
        target_basis: targetBasis,
        combination: {
          ...combinationLayer,
          additional_discount_brl: effectiveValue(combo, ov, 'additional_discount_brl'),
        },
      });
      comboIds.push(combo.id);
      insuranceByIndex.push(insuranceUsed);
    } else if (pricingMethod === 'TARGET_PRICE') {
      if (combo.origination_price_net_brl == null) {
        skipped.push({ comboId: combo.id, label, reason: 'Target Price sem preço líquido alvo.' });
        continue;
      }
      payload.push({
        ...baseCombo,
        origination_price_net_brl: combo.origination_price_net_brl,
        // additional_discount_brl é OMITIDO: zero inventado carimbaria origem falsa.
        combination: { ...combinationLayer },
      });
      comboIds.push(combo.id);
      insuranceByIndex.push(insuranceUsed);
    } else {
      skipped.push({ comboId: combo.id, label, reason: `Método de precificação desconhecido '${pricingMethod}'.` });
    }
  }

  return { payload, comboIds, insuranceByIndex, skipped };
}

export interface BuildSnapshotsArgs {
  apiResults: Record<string, unknown>[];
  payload: Record<string, unknown>[];
  keptIndexes: number[];
  tradeDate: string;
  spotRate: number | null;
  userId: string | null;
  /** Seguro por índice do payload, na mesma ordem devolvida por buildCockpitPayload. */
  insuranceByIndex?: (InsuranceUsed | null)[];
}

export interface BuildSnapshotsResult {
  rows: Omit<PricingSnapshot, 'id' | 'created_at'>[];
  /** Linhas com seguro cuja resposta não trouxe costs.insurance_brl — NÃO gravadas. */
  notSaved: string[];
}

/** Monta as linhas de pricing_snapshots. outputs_json vai por spread, objeto inteiro. */
export function buildCockpitSnapshots({
  apiResults,
  payload,
  keptIndexes,
  tradeDate,
  spotRate,
  userId,
  insuranceByIndex,
}: BuildSnapshotsArgs): BuildSnapshotsResult {
  const notSaved: string[] = [];
  const rows = apiResults.map((r, idx) => {
    const payloadIdx = keptIndexes[idx] ?? idx;
    const orig = payload[payloadIdx] ?? {};
    const ins = insuranceByIndex?.[payloadIdx] ?? null;
    const costs = (r.costs ?? null) as Record<string, unknown> | null;
    const insuranceCost = costs?.insurance_brl;

    // Linha com seguro e sem custo na resposta: não grava. Gravar as quatro
    // colunas nulas produziria preço já descontado do seguro sem registro dele.
    if (ins && insuranceCost == null) {
      notSaved.push(`${orig.display_name ?? orig.warehouse_id} / ${orig.ticker}`);
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
      exchange_rate: (r.exchange_rate as number | null | undefined) ?? null,
      target_basis_brl: r.target_basis_brl ?? 0,
      futures_price_brl: r.futures_price_brl ?? 0,
      origination_price_brl: r.origination_price_brl ?? 0,
      additional_discount_brl:
        r.additional_discount_brl
        ?? (orig.combination as Record<string, unknown> | undefined)?.additional_discount_brl
        ?? 0,
      // As quatro juntas ou as quatro nulas — exigência do CHECK do banco.
      insurance_quote_id: ins ? ins.quote.id : null,
      insurance_coverage_pct: ins ? ins.coverage_pct : null,
      insurance_cost_brl: ins ? Number(insuranceCost) : null,
      insurance_carry_until: ins ? ins.carry_until : null,
      inputs_json: {
        pricing_method: orig.pricing_method,
        futures_price: orig.futures_price,
        spot_usd_brl: spotRate,
        exchange_rate_override: orig.exchange_rate_override ?? null,
        exp_date: orig.exp_date ?? null,
        target_basis: orig.target_basis ?? null,
        origination_price_net_brl: orig.origination_price_net_brl ?? null,
        combination: orig.combination ?? null,
        warehouse: orig.warehouse ?? null,
        source: 'cockpit',
      },
      outputs_json: { ...r },
      created_by: userId,
    } as Omit<PricingSnapshot, 'id' | 'created_at'>;
  }).filter((s): s is Omit<PricingSnapshot, 'id' | 'created_at'> => s !== null);

  return { rows, notSaved };
}

/**
 * Lê a camada de origem por parâmetro em `resolved_inputs`.
 * Serve apenas para a marca "herdado" — nunca para o valor exibido.
 */
export function readOriginMap(outputs: Record<string, unknown> | undefined | null): Record<string, string> {
  const resolved = (outputs as Record<string, unknown> | undefined)?.resolved_inputs;
  if (!resolved || typeof resolved !== 'object') return {};
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(resolved as Record<string, unknown>)) {
    if (entry && typeof entry === 'object' && 'source' in (entry as Record<string, unknown>)) {
      const src = (entry as Record<string, unknown>).source;
      if (typeof src === 'string') map[key] = src;
    }
  }
  return map;
}
