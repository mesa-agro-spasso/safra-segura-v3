import { supabase } from '@/integrations/supabase/client';
import type {
  AllocateBatchRequest,
  AllocateBatchResponse,
  HedgePlanItemIn,
  OperationBalanceOut,
  OperationIn,
  OrderIn,
  PricingSnapshotIn,
  ValidationAlertOut,
} from '@/types/d24';

export interface BuildHedgePlanResponse {
  plan: HedgePlanItemIn[];
  order_message: string;
  confirmation_message: string;
}

export interface CalculateBalanceResponse {
  balance: OperationBalanceOut;
}

export interface ValidateExecutionResponse {
  is_valid: boolean;
  structural_errors: string[];
  business_alerts: ValidationAlertOut[];
  balance_after: OperationBalanceOut;
}

export async function buildHedgePlan(
  operation: OperationIn,
  pricingSnapshot: PricingSnapshotIn,
): Promise<BuildHedgePlanResponse> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: {
      endpoint: '/operations/build-plan',
      body: { operation, pricing_snapshot: pricingSnapshot },
    },
  });
  if (error) throw error;
  return data as BuildHedgePlanResponse;
}

export async function calculateBalance(
  operation: OperationIn,
  existingOrders: OrderIn[],
): Promise<CalculateBalanceResponse> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: {
      endpoint: '/operations/balance',
      body: { operation, existing_orders: existingOrders },
    },
  });
  if (error) throw error;
  return data as CalculateBalanceResponse;
}

export async function validateExecution(
  operation: OperationIn,
  existingOrders: OrderIn[],
  newOrder: OrderIn,
): Promise<ValidateExecutionResponse> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: {
      endpoint: '/orders/validate-execution',
      body: { operation, existing_orders: existingOrders, new_order: newOrder },
    },
  });
  if (error) throw error;
  return data as ValidateExecutionResponse;
}

export async function allocateClosingBatch(
  payload: AllocateBatchRequest,
): Promise<AllocateBatchResponse> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: {
      endpoint: '/closing-batches/allocate',
      body: payload,
    },
  });
  if (error) throw error;
  return data as AllocateBatchResponse;
}
