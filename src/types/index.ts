export interface Warehouse {
  id: string;
  display_name: string;
  city: string | null;
  state: string | null;
  type: string;
  active: boolean;
  basis_config: Record<string, unknown>;
  abbr: string;
  created_at: string;
  // cost defaults (nullable — HQ has no defaults)
  interest_rate: number | null;
  interest_rate_period: string | null;
  storage_cost: number | null;
  storage_cost_type: string | null;
  reception_cost: number | null;
  brokerage_per_contract_cbot: number | null;
  brokerage_per_contract_b3: number | null;
  desk_cost_pct: number | null;
  shrinkage_rate_monthly: number | null;
}

export interface MarketData {
  id: string;
  ticker: string;
  commodity: string;
  price: number | null;
  currency: string;
  date: string;
  exchange_rate: number | null;
  source: string;
  price_unit: string | null;
  exp_date: string | null;
  ndf_spot: number | null;
  ndf_estimated: number | null;
  ndf_spread: number | null;
  ndf_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface PricingSnapshot {
  id: string;
  warehouse_id: string;
  commodity: string;
  benchmark: string;
  ticker: string;
  trade_date: string;
  payment_date: string;
  grain_reception_date: string;
  sale_date: string;
  origination_price_brl: number;
  futures_price_brl: number;
  target_basis_brl: number;
  exchange_rate: number | null;
  additional_discount_brl: number;
  inputs_json: Record<string, unknown>;
  outputs_json: Record<string, unknown>;
  insurance_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface HedgeOrder {
  id: string;
  operation_id: string;
  commodity: string;
  exchange: string;
  volume_sacks: number;
  origination_price_brl: number;
  legs: unknown[];
  status: string;
  order_message: string | null;
  confirmation_message: string | null;
  stonex_confirmation_text: string | null;
  display_code: string | null;
  notes: string | null;
  executed_legs: unknown[] | null;
  executed_at: string | null;
  executed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  operation?: {
    warehouse_id: string;
    warehouses: { display_name: string } | null;
    pricing_snapshots: { trade_date: string; payment_date: string; grain_reception_date: string; sale_date: string; outputs_json?: Record<string, unknown> } | null;
  } | null;
}


export interface Operation {
  id: string;
  warehouse_id: string;
  commodity: string;
  volume_sacks: number;
  status: string;
  pricing_snapshot_id: string | null;
  notes: string | null;
  parent_operation_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MtmSnapshot {
  id: string;
  operation_id: string;
  volume_sacks: number;
  physical_price_current: number;
  futures_price_current: number;
  spot_rate_current: number | null;
  mtm_physical_brl: number;
  mtm_futures_brl: number;
  mtm_ndf_brl: number;
  mtm_option_brl: number;
  mtm_total_brl: number;
  mtm_per_sack_brl: number;
  total_exposure_brl: number;
  calculated_by: string | null;
  calculated_at: string;
  snapshot_date: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  status: 'pending' | 'active' | 'disabled';
  access_level: 'limited' | 'full';
  is_admin: boolean;
  theme: 'dark' | 'light';
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface PricingCombination {
  id: string;
  warehouse_id: string;
  commodity: string;
  benchmark: string;
  ticker: string;
  exp_date: string | null;
  sale_date: string;
  payment_date: string | null;
  is_spot: boolean;
  grain_reception_date: string | null;
  target_basis: number;
  interest_rate: number | null;
  storage_cost: number | null;
  storage_cost_type: string | null;
  reception_cost: number | null;
  brokerage_per_contract: number | null;
  desk_cost_pct: number | null;
  shrinkage_rate_monthly: number | null;
  additional_discount_brl: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingParameter {
  id: string;
  sigma: number;
  target_profit_brl_per_sack: number;
  execution_spread_pct: number;
  updated_at: string;
}

export interface OperationWithDetails {
  id: string;
  warehouse_id: string;
  commodity: string;
  volume_sacks: number;
  status: string;
  pricing_snapshot_id: string | null;
  notes: string | null;
  parent_operation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  warehouses: { display_name: string } | null;
  pricing_snapshots: {
    trade_date: string;
    payment_date: string;
    grain_reception_date: string;
    sale_date: string;
    ticker: string;
    origination_price_brl: number;
    futures_price_brl: number;
    exchange_rate: number | null;
    outputs_json?: Record<string, unknown>;
  } | null;
}
