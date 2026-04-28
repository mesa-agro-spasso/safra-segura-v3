// D24 backend contract — espelha schemas Pydantic da API Python.
// Strings simples (sem unions estreitos) para preservar paridade com backend.

export interface PricingSnapshotIn {
  ticker: string;
  payment_date: string;
  futures_price_usd?: number;
  futures_price_brl?: number;
  exchange_rate?: number;
}

export interface HedgePlanItemIn {
  instrument_type: string; // 'futures' | 'ndf' | 'option'
  direction: string; // 'buy' | 'sell'
  currency: string; // 'USD' | 'BRL'
  ticker?: string;
  contracts?: number;
  volume_units?: number;
  price_estimated?: number;
  ndf_rate?: number;
  ndf_maturity?: string;
  option_type?: string;
  strike?: number;
  premium?: number;
  expiration_date?: string;
  is_counterparty_insurance: boolean;
  notes?: string;
}

export interface OperationIn {
  id?: string; // Opcional pois DRAFT pode não estar salvo
  warehouse_id: string;
  commodity: string;
  exchange: string;
  volume_sacks: number;
  origination_price_brl: number;
  trade_date: string;
  payment_date: string;
  grain_reception_date: string;
  sale_date: string;
  display_code?: string;
  status: string;
  hedge_plan: HedgePlanItemIn[];
  notes?: string;
}

export interface OrderIn {
  operation_id?: string;
  instrument_type: string; // 'futures' | 'ndf' | 'option'
  direction: string; // 'buy' | 'sell'
  currency: string; // 'USD' | 'BRL'
  contracts: number;
  volume_units: number;
  executed_at: string; // ISO datetime
  executed_by: string; // UUID string
  is_closing?: boolean;
  closes_order_id?: string;
  ticker?: string;
  price?: number;
  ndf_rate?: number;
  ndf_maturity?: string;
  ndf_table_version_id?: string;
  option_type?: string;
  strike?: number;
  premium?: number;
  expiration_date?: string;
  is_counterparty_insurance?: boolean;
  exchange_rate_at_execution?: number;
  notes?: string;
}

export interface ValidationAlertOut {
  level: string; // 'ERROR' | 'WARNING' | 'INFO'
  code: string;
  message: string;
  leg_ref?: string;
}

export interface OperationBalanceOut {
  operation_id?: string;
  balance_per_instrument: Record<string, Record<string, number>>;
  total_volume_sacks_closed: number;
  is_fully_closed: boolean;
  is_partially_closed: boolean;
}

export interface OperationSummaryIn {
  operation_id: string;
  display_code: string;
  volume_sacks: number;
  existing_orders: OrderIn[];
  mtm_total_brl?: number;
}

export interface ClosingAllocationProposalOut {
  operation_id: string;
  display_code: string;
  current_volume_sacks: number;
  volume_to_close_sacks: number;
  allocation_reason: string;
  mtm_at_allocation?: number;
}

export interface AllocateBatchRequest {
  warehouse_id: string;
  commodity: string;   // 'soybean' | 'corn'
  exchange: string;    // 'cbot' | 'b3'
  target_volume_sacks: number;
  strategy: string;    // 'MAX_PROFIT' | 'MAX_LOSS' | 'PROPORTIONAL'
  operations: OperationSummaryIn[];
}

export interface AllocateBatchResponse {
  proposals: ClosingAllocationProposalOut[];
  total_volume_allocated_sacks: number;
  strategy_used: string;
  warnings: string[];
}
