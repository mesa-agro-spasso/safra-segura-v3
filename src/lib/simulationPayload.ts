import type { PricingCombination, PricingSnapshot, Warehouse } from '@/types';
import type { OptionQuote } from '@/hooks/useInsuranceOptions';
import type { InsuranceValue } from '@/components/pricing/InsuranceFields';

/**
 * Montagem do payload da simulação livre.
 * Só cópia de campos — nenhuma aritmética, nenhum default inventado.
 */

export interface SimulationCosts {
  interest_rate: number | null;
  interest_rate_period: string | null;
  storage_cost: number | null;
  storage_cost_type: string | null;
  reception_cost: number | null;
  brokerage_per_contract: number | null;
  desk_cost_pct: number | null;
  shrinkage_rate_monthly: number | null;
}

export interface SimulationForm {
  /** Opcional para simular; obrigatório para montar operação / adicionar à tabela. */
  warehouse_id: string | null;
  commodity: 'soybean' | 'corn';
  benchmark: 'cbot' | 'b3';
  ticker: string;
  pricing_method: 'LONG_BASIS' | 'TARGET_PRICE';
  futures_price: number | null;
  trade_date: string;
  sale_date: string | null;
  payment_date: string | null;
  grain_reception_date: string | null;
  exp_date: string | null;
  is_spot: boolean;
  target_basis: number | null;
  origination_price_net_brl: number | null;
  exchange_rate_override: number | null;
  spot_usd_brl: number | null;
  rounding_increment: number | null;
  additional_discount_brl: number | null;
  insurance: InsuranceValue;
  manual: SimulationCosts;
}

export const EMPTY_COSTS: SimulationCosts = {
  interest_rate: null,
  interest_rate_period: null,
  storage_cost: null,
  storage_cost_type: null,
  reception_cost: null,
  brokerage_per_contract: null,
  desk_cost_pct: null,
  shrinkage_rate_monthly: null,
};

export function emptySimulationForm(tradeDate: string): SimulationForm {
  return {
    warehouse_id: null,
    commodity: 'soybean',
    benchmark: 'cbot',
    ticker: '',
    pricing_method: 'LONG_BASIS',
    futures_price: null,
    trade_date: tradeDate,
    sale_date: null,
    payment_date: null,
    grain_reception_date: null,
    exp_date: null,
    is_spot: false,
    target_basis: null,
    origination_price_net_brl: null,
    exchange_rate_override: null,
    spot_usd_brl: null,
    rounding_increment: null,
    additional_discount_brl: null,
    insurance: {},
    manual: { ...EMPTY_COSTS },
  };
}

/** Preenche o formulário a partir de uma combinação cadastrada. Só cópia. */
export function formFromCombination(
  combo: PricingCombination,
  warehouse: Warehouse | undefined,
  tradeDate: string,
  futuresPrice: number | null,
  expDateFromMarket: string | null,
  fxOverride: number | null,
  spotRate: number | null,
): SimulationForm {
  return {
    warehouse_id: combo.warehouse_id,
    commodity: combo.commodity as 'soybean' | 'corn',
    benchmark: combo.benchmark as 'cbot' | 'b3',
    ticker: combo.ticker,
    pricing_method: combo.pricing_method,
    futures_price: futuresPrice,
    trade_date: tradeDate,
    sale_date: combo.sale_date ?? null,
    payment_date: combo.payment_date ?? null,
    grain_reception_date: combo.grain_already_delivered
      ? tradeDate
      : combo.grain_reception_date ?? combo.payment_date ?? null,
    exp_date: combo.exp_date ?? expDateFromMarket,
    is_spot: !!combo.is_spot,
    target_basis: combo.target_basis,
    origination_price_net_brl: combo.origination_price_net_brl,
    exchange_rate_override: combo.benchmark === 'cbot' ? fxOverride : null,
    spot_usd_brl: spotRate,
    rounding_increment: null,
    additional_discount_brl: combo.additional_discount_brl ?? null,
    insurance: {
      insurance_option_id: combo.insurance_option_id,
      insurance_coverage_pct: combo.insurance_coverage_pct,
      insurance_carry_until: combo.insurance_carry_until,
    },
    manual: {
      interest_rate: combo.interest_rate,
      interest_rate_period: warehouse?.interest_rate_period ?? null,
      storage_cost: combo.storage_cost,
      storage_cost_type: combo.storage_cost_type,
      reception_cost: combo.reception_cost,
      brokerage_per_contract: combo.brokerage_per_contract,
      desk_cost_pct: combo.desk_cost_pct,
      shrinkage_rate_monthly: combo.shrinkage_rate_monthly,
    },
  };
}

export interface BuildSimulationResult {
  /** Corpo exato de POST /pricing/table. */
  request: Record<string, unknown>;
  /** Linha única do payload (atalho para montar snapshot). */
  row: Record<string, unknown>;
  insuranceUsed: { quote: OptionQuote; coverage_pct: number | null; carry_until: string | null } | null;
}

/** Erros de preenchimento que impedem o envio. Sem regra financeira: só campos obrigatórios. */
export function validateSimulationForm(form: SimulationForm, quote: OptionQuote | null): string | null {
  if (!form.ticker.trim()) return 'Informe o ticker.';
  if (form.futures_price == null) return 'Informe o preço de futuros.';
  if (!form.trade_date) return 'Informe a data de negócio.';
  if (!form.sale_date) return 'Informe a data de venda.';
  if (!form.is_spot && !form.payment_date) return 'Informe a data de pagamento (ou marque à vista).';
  if (form.pricing_method === 'LONG_BASIS' && form.target_basis == null) {
    return 'Long Basis exige basis alvo.';
  }
  if (form.pricing_method === 'TARGET_PRICE' && form.origination_price_net_brl == null) {
    return 'Target Price exige preço líquido alvo.';
  }
  if (form.insurance.insurance_option_id && !quote) {
    return 'Seguro sem cotação — registre o prêmio em Mercado > Opções.';
  }
  return null;
}

export function buildSimulationRequest(
  form: SimulationForm,
  warehouse: Warehouse | undefined,
  quote: OptionQuote | null,
): BuildSimulationResult {
  const isCbot = form.benchmark === 'cbot';

  const costLayer: Record<string, unknown> = {
    interest_rate: form.manual.interest_rate,
    interest_rate_period: form.manual.interest_rate_period,
    storage_cost: form.manual.storage_cost,
    storage_cost_type: form.manual.storage_cost_type,
    reception_cost: form.manual.reception_cost,
    brokerage_per_contract: form.manual.brokerage_per_contract,
    desk_cost_pct: form.manual.desk_cost_pct,
    shrinkage_rate_monthly: form.manual.shrinkage_rate_monthly,
  };

  let insuranceFields: Record<string, unknown> = {};
  let insuranceUsed: BuildSimulationResult['insuranceUsed'] = null;
  if (form.insurance.insurance_option_id && quote) {
    insuranceUsed = {
      quote,
      coverage_pct: form.insurance.insurance_coverage_pct ?? null,
      carry_until: form.insurance.insurance_carry_until ?? null,
    };
    insuranceFields = {
      ...(isCbot
        ? { insurance_premium_usd_bushel: quote.premium_usd_bushel }
        : { insurance_premium_brl_sack: quote.premium_brl_sack }),
      insurance_coverage_pct: form.insurance.insurance_coverage_pct,
      insurance_quote_trade_date: quote.trade_date,
      ...(form.insurance.insurance_carry_until
        ? { insurance_carry_until: form.insurance.insurance_carry_until }
        : {}),
    };
  }

  const row: Record<string, unknown> = {
    ...(form.warehouse_id ? { warehouse_id: form.warehouse_id } : {}),
    ...(warehouse ? { display_name: warehouse.display_name } : {}),
    commodity: form.commodity,
    benchmark: form.benchmark,
    ticker: form.ticker.trim(),
    ...(form.exp_date ? { exp_date: form.exp_date } : {}),
    is_spot: form.is_spot,
    ...(form.is_spot ? {} : { payment_date: form.payment_date }),
    sale_date: form.sale_date,
    ...(form.grain_reception_date ? { grain_reception_date: form.grain_reception_date } : {}),
    pricing_method: form.pricing_method,
    futures_price: form.futures_price,
    ...(form.exchange_rate_override != null
      ? { exchange_rate_override: form.exchange_rate_override }
      : {}),
    ...(form.rounding_increment != null ? { rounding_increment: form.rounding_increment } : {}),
    ...insuranceFields,
    // Camada de custos digitada à mão. `combination` é a chave do contrato em uso;
    // `manual_override` acompanha o mesmo conteúdo para o contrato novo.
    combination: {
      ...costLayer,
      ...(form.pricing_method === 'LONG_BASIS'
        ? { additional_discount_brl: form.additional_discount_brl }
        : {}),
    },
    manual_override: { ...costLayer },
    ...(warehouse
      ? {
          warehouse: {
            interest_rate: warehouse.interest_rate,
            interest_rate_period: warehouse.interest_rate_period,
            storage_cost: warehouse.storage_cost,
            storage_cost_type: warehouse.storage_cost_type,
            reception_cost: warehouse.reception_cost,
            brokerage_per_contract_cbot: warehouse.brokerage_per_contract_cbot,
            brokerage_per_contract_b3: warehouse.brokerage_per_contract_b3,
            desk_cost_pct: warehouse.desk_cost_pct,
            shrinkage_rate_monthly: warehouse.shrinkage_rate_monthly,
          },
        }
      : {}),
    ...(form.pricing_method === 'LONG_BASIS'
      ? { target_basis: form.target_basis }
      : { origination_price_net_brl: form.origination_price_net_brl }),
  };

  const request: Record<string, unknown> = {
    trade_date: form.trade_date,
    spot_usd_brl: form.spot_usd_brl,
    combinations: [row],
  };

  return { request, row, insuranceUsed };
}

export interface SimulationSnapshotArgs {
  form: SimulationForm;
  row: Record<string, unknown>;
  result: Record<string, unknown>;
  insuranceUsed: BuildSimulationResult['insuranceUsed'];
  userId: string | null;
  /** Quando informado, entra no lote existente da tabela publicada. */
  createdAt?: string | null;
}

export type SimulationSnapshotRow = Omit<PricingSnapshot, 'id' | 'created_at'> & { created_at?: string };

/** Mesma forma de linha que o publish do cockpit monta. Só cópia de campos. */
export function buildSimulationSnapshot({
  form,
  row,
  result,
  insuranceUsed,
  userId,
  createdAt,
}: SimulationSnapshotArgs): SimulationSnapshotRow {
  const r = result as Record<string, any>;
  const costs = (r.costs ?? null) as Record<string, unknown> | null;
  const insuranceCost = costs?.insurance_brl;

  return {
    warehouse_id: (r.warehouse_id ?? form.warehouse_id) as string,
    commodity: (r.commodity ?? form.commodity) as string,
    benchmark: (r.benchmark ?? form.benchmark) as string,
    ticker: (r.ticker ?? form.ticker) as string,
    trade_date: (r.trade_date_used ?? form.trade_date) as string,
    sale_date: (r.sale_date ?? form.sale_date) as string,
    payment_date: (r.payment_date ?? form.payment_date) as string,
    grain_reception_date: (r.grain_reception_date ?? form.grain_reception_date) as string,
    exchange_rate: (r.exchange_rate as number | null | undefined) ?? null,
    target_basis_brl: r.target_basis_brl ?? 0,
    futures_price_brl: r.futures_price_brl ?? 0,
    origination_price_brl: r.origination_price_brl ?? 0,
    additional_discount_brl: r.additional_discount_brl ?? form.additional_discount_brl ?? 0,
    insurance_quote_id: insuranceUsed ? insuranceUsed.quote.id : null,
    insurance_coverage_pct: insuranceUsed ? insuranceUsed.coverage_pct : null,
    insurance_cost_brl: insuranceUsed && insuranceCost != null ? Number(insuranceCost) : null,
    insurance_carry_until: insuranceUsed ? insuranceUsed.carry_until : null,
    inputs_json: {
      pricing_method: form.pricing_method,
      futures_price: form.futures_price,
      spot_usd_brl: form.spot_usd_brl,
      exchange_rate_override: form.exchange_rate_override ?? null,
      exp_date: form.exp_date ?? null,
      target_basis: form.target_basis ?? null,
      origination_price_net_brl: form.origination_price_net_brl ?? null,
      rounding_increment: form.rounding_increment ?? null,
      combination: row.combination ?? null,
      warehouse: row.warehouse ?? null,
      request_row: row,
      source: 'simulation',
    },
    outputs_json: { ...r },
    created_by: userId,
    ...(createdAt ? { created_at: createdAt } : {}),
  } as SimulationSnapshotRow;
}

/** Nova combinação a partir da simulação. Sem id: o banco gera. */
export function combinationFromSimulation(form: SimulationForm): Partial<PricingCombination> {
  return {
    warehouse_id: form.warehouse_id as string,
    commodity: form.commodity,
    benchmark: form.benchmark,
    ticker: form.ticker.trim(),
    harvest_id: null,
    exp_date: form.exp_date,
    sale_date: form.sale_date as string,
    payment_date: form.is_spot ? null : form.payment_date,
    is_spot: form.is_spot,
    grain_reception_date: form.grain_reception_date,
    grain_already_delivered: false,
    pricing_method: form.pricing_method,
    target_basis: form.pricing_method === 'LONG_BASIS' ? form.target_basis : null,
    origination_price_net_brl:
      form.pricing_method === 'TARGET_PRICE' ? form.origination_price_net_brl : null,
    interest_rate: form.manual.interest_rate,
    storage_cost: form.manual.storage_cost,
    storage_cost_type: form.manual.storage_cost_type,
    reception_cost: form.manual.reception_cost,
    brokerage_per_contract: form.manual.brokerage_per_contract,
    desk_cost_pct: form.manual.desk_cost_pct,
    shrinkage_rate_monthly: form.manual.shrinkage_rate_monthly,
    additional_discount_brl: form.additional_discount_brl ?? 0,
    insurance_option_id: form.insurance.insurance_option_id ?? null,
    insurance_coverage_pct: form.insurance.insurance_coverage_pct ?? null,
    insurance_carry_until: form.insurance.insurance_carry_until ?? null,
    active: true,
  };
}
