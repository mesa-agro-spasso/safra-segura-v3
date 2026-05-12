-- ============================================================
-- PUBLIC SCHEMA
-- ============================================================

ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS physical_sale_price_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_registered_at timestamptz;

ALTER TABLE public.warehouse_closing_batches
  ADD COLUMN IF NOT EXISTS physical_sale_price_estimated_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_price_executed_brl_per_sack numeric;

CREATE TABLE IF NOT EXISTS public.physical_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id),
  batch_id uuid NOT NULL REFERENCES public.warehouse_closing_batches(id),
  volume_sacks numeric NOT NULL CHECK (volume_sacks > 0),
  price_brl_per_sack numeric NOT NULL CHECK (price_brl_per_sack > 0),
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid,
  notes text,
  UNIQUE (operation_id, batch_id)
);
CREATE INDEX IF NOT EXISTS idx_physical_sales_operation ON public.physical_sales(operation_id);
CREATE INDEX IF NOT EXISTS idx_physical_sales_batch ON public.physical_sales(batch_id);

ALTER TABLE public.physical_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated full access" ON public.physical_sales;
CREATE POLICY "authenticated full access" ON public.physical_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill EXECUTED legados (public)
UPDATE public.warehouse_closing_batches b
   SET physical_sale_price_executed_brl_per_sack = COALESCE(
     (SELECT pp.price_brl_per_sack FROM public.physical_prices pp
      WHERE pp.warehouse_id = b.warehouse_id AND pp.commodity = b.commodity
      ORDER BY pp.reference_date DESC, pp.updated_at DESC LIMIT 1),
     0)
 WHERE status = 'EXECUTED' AND physical_sale_price_executed_brl_per_sack IS NULL;

ALTER TABLE public.warehouse_closing_batches
  DROP CONSTRAINT IF EXISTS physical_price_required_on_execution;
ALTER TABLE public.warehouse_closing_batches
  ADD CONSTRAINT physical_price_required_on_execution
  CHECK (status <> 'EXECUTED' OR physical_sale_price_executed_brl_per_sack IS NOT NULL);

CREATE OR REPLACE FUNCTION public.execute_block_trade_physical(
  p_batch_id uuid,
  p_user_id uuid,
  p_sales jsonb,
  p_weighted_price numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale jsonb;
  v_op_id uuid;
  v_vol numeric;
  v_price numeric;
  v_current_vol numeric;
  v_existing_price numeric;
  v_original_vol numeric;
  v_previously_closed_vol numeric;
  v_final_price numeric;
BEGIN
  FOR sale IN SELECT * FROM jsonb_array_elements(p_sales) LOOP
    v_op_id       := (sale->>'operation_id')::uuid;
    v_vol         := (sale->>'volume_sacks')::numeric;
    v_price       := (sale->>'price_brl_per_sack')::numeric;
    v_current_vol := (sale->>'current_volume_sacks')::numeric;

    INSERT INTO public.physical_sales
      (operation_id, batch_id, volume_sacks, price_brl_per_sack, registered_by, notes)
    VALUES
      (v_op_id, p_batch_id, v_vol, v_price, p_user_id, 'Block trade ' || p_batch_id::text);

    SELECT physical_sale_price_brl_per_sack, volume_sacks
      INTO v_existing_price, v_original_vol
      FROM public.operations WHERE id = v_op_id;

    v_previously_closed_vol := v_original_vol - v_current_vol;

    IF v_existing_price IS NULL OR v_previously_closed_vol <= 0 THEN
      v_final_price := v_price;
    ELSE
      v_final_price := (v_existing_price * v_previously_closed_vol + v_price * v_vol)
                       / (v_previously_closed_vol + v_vol);
    END IF;

    UPDATE public.operations
       SET physical_sale_price_brl_per_sack = v_final_price,
           physical_sale_registered_at = now()
     WHERE id = v_op_id;
  END LOOP;

  UPDATE public.warehouse_closing_batches
     SET physical_sale_price_executed_brl_per_sack = p_weighted_price
   WHERE id = p_batch_id;
END;
$$;

-- ============================================================
-- STAGING SCHEMA
-- ============================================================

ALTER TABLE staging.operations
  ADD COLUMN IF NOT EXISTS physical_sale_price_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_registered_at timestamptz;

ALTER TABLE staging.warehouse_closing_batches
  ADD COLUMN IF NOT EXISTS physical_sale_price_estimated_brl_per_sack numeric,
  ADD COLUMN IF NOT EXISTS physical_sale_price_executed_brl_per_sack numeric;

CREATE TABLE IF NOT EXISTS staging.physical_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES staging.operations(id),
  batch_id uuid NOT NULL REFERENCES staging.warehouse_closing_batches(id),
  volume_sacks numeric NOT NULL CHECK (volume_sacks > 0),
  price_brl_per_sack numeric NOT NULL CHECK (price_brl_per_sack > 0),
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid,
  notes text,
  UNIQUE (operation_id, batch_id)
);
CREATE INDEX IF NOT EXISTS idx_staging_physical_sales_operation ON staging.physical_sales(operation_id);
CREATE INDEX IF NOT EXISTS idx_staging_physical_sales_batch ON staging.physical_sales(batch_id);

ALTER TABLE staging.physical_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_full_access" ON staging.physical_sales;
CREATE POLICY "staging_full_access" ON staging.physical_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill EXECUTED legados (staging)
UPDATE staging.warehouse_closing_batches b
   SET physical_sale_price_executed_brl_per_sack = COALESCE(
     (SELECT pp.price_brl_per_sack FROM staging.physical_prices pp
      WHERE pp.warehouse_id = b.warehouse_id AND pp.commodity = b.commodity
      ORDER BY pp.reference_date DESC, pp.updated_at DESC LIMIT 1),
     0)
 WHERE status = 'EXECUTED' AND physical_sale_price_executed_brl_per_sack IS NULL;

ALTER TABLE staging.warehouse_closing_batches
  DROP CONSTRAINT IF EXISTS physical_price_required_on_execution;
ALTER TABLE staging.warehouse_closing_batches
  ADD CONSTRAINT physical_price_required_on_execution
  CHECK (status <> 'EXECUTED' OR physical_sale_price_executed_brl_per_sack IS NOT NULL);

CREATE OR REPLACE FUNCTION staging.execute_block_trade_physical(
  p_batch_id uuid,
  p_user_id uuid,
  p_sales jsonb,
  p_weighted_price numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staging
AS $$
DECLARE
  sale jsonb;
  v_op_id uuid;
  v_vol numeric;
  v_price numeric;
  v_current_vol numeric;
  v_existing_price numeric;
  v_original_vol numeric;
  v_previously_closed_vol numeric;
  v_final_price numeric;
BEGIN
  FOR sale IN SELECT * FROM jsonb_array_elements(p_sales) LOOP
    v_op_id       := (sale->>'operation_id')::uuid;
    v_vol         := (sale->>'volume_sacks')::numeric;
    v_price       := (sale->>'price_brl_per_sack')::numeric;
    v_current_vol := (sale->>'current_volume_sacks')::numeric;

    INSERT INTO staging.physical_sales
      (operation_id, batch_id, volume_sacks, price_brl_per_sack, registered_by, notes)
    VALUES
      (v_op_id, p_batch_id, v_vol, v_price, p_user_id, 'Block trade ' || p_batch_id::text);

    SELECT physical_sale_price_brl_per_sack, volume_sacks
      INTO v_existing_price, v_original_vol
      FROM staging.operations WHERE id = v_op_id;

    v_previously_closed_vol := v_original_vol - v_current_vol;

    IF v_existing_price IS NULL OR v_previously_closed_vol <= 0 THEN
      v_final_price := v_price;
    ELSE
      v_final_price := (v_existing_price * v_previously_closed_vol + v_price * v_vol)
                       / (v_previously_closed_vol + v_vol);
    END IF;

    UPDATE staging.operations
       SET physical_sale_price_brl_per_sack = v_final_price,
           physical_sale_registered_at = now()
     WHERE id = v_op_id;
  END LOOP;

  UPDATE staging.warehouse_closing_batches
     SET physical_sale_price_executed_brl_per_sack = p_weighted_price
   WHERE id = p_batch_id;
END;
$$;