import type { PricingCombination, Warehouse, MarketData, PricingSnapshot } from '@/types';

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
}

export interface BuildPayloadResult {
  /** Linhas do POST /pricing/table, na ordem enviada. */
  payload: Record<string, unknown>[];
  /** id da combinação para cada índice de `payload`. */
  comboIds: string[];
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
}: BuildPayloadArgs): BuildPayloadResult {
  const payload: Record<string, unknown>[] = [];
  const comboIds: string[] = [];
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

    const isSpot = combo.is_spot ?? false;
    let paymentDate: string | null = null;
    if (!isSpot) {
      if (!combo.payment_date) {
        skipped.push({ comboId: combo.id, label, reason: 'Sem data de pagamento cadastrada.' });
        continue;
      }
      paymentDate = combo.payment_date;
    }
    const grainReceptionDate = combo.grain_reception_date ?? paymentDate;

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

    const baseCombo: Record<string, unknown> = {
      warehouse_id: combo.warehouse_id,
      display_name: warehouse.display_name,
      commodity: combo.commodity,
      benchmark: combo.benchmark,
      ticker: combo.ticker,
      exp_date: expDate,
      is_spot: isSpot,
      ...(isSpot ? {} : { payment_date: paymentDate }),
      sale_date: combo.sale_date,
      grain_reception_date: grainReceptionDate,
      pricing_method: pricingMethod,
      futures_price: market.price,
      ...(fxOverride != null ? { exchange_rate_override: fxOverride } : {}),
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
    } else {
      skipped.push({ comboId: combo.id, label, reason: `Método de precificação desconhecido '${pricingMethod}'.` });
    }
  }

  return { payload, comboIds, skipped };
}

export interface BuildSnapshotsArgs {
  apiResults: Record<string, unknown>[];
  payload: Record<string, unknown>[];
  keptIndexes: number[];
  tradeDate: string;
  spotRate: number | null;
  userId: string | null;
}

/** Monta as linhas de pricing_snapshots. outputs_json vai por spread, objeto inteiro. */
export function buildCockpitSnapshots({
  apiResults,
  payload,
  keptIndexes,
  tradeDate,
  spotRate,
  userId,
}: BuildSnapshotsArgs): Omit<PricingSnapshot, 'id' | 'created_at'>[] {
  return apiResults.map((r, idx) => {
    const orig = payload[keptIndexes[idx] ?? idx] ?? {};
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
  });
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
