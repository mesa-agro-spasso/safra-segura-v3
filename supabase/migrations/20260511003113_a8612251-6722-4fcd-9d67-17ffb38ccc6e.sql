DO $$
DECLARE
  v_op_ids uuid[] := ARRAY(SELECT id FROM public.operations WHERE warehouse_id = 'alta_floresta');
  v_ps_ids uuid[] := ARRAY(
    SELECT DISTINCT pricing_snapshot_id
    FROM public.operations
    WHERE warehouse_id = 'alta_floresta' AND pricing_snapshot_id IS NOT NULL
  );
BEGIN
  ALTER TABLE public.orders DISABLE TRIGGER USER;

  DELETE FROM public.signatures                WHERE operation_id = ANY(v_op_ids);
  DELETE FROM public.mtm_snapshots             WHERE operation_id = ANY(v_op_ids);
  DELETE FROM public.orders                    WHERE operation_id = ANY(v_op_ids);
  DELETE FROM public.warehouse_closing_batches WHERE warehouse_id = 'alta_floresta';
  DELETE FROM public.operations                WHERE warehouse_id = 'alta_floresta';
  DELETE FROM public.pricing_snapshots
    WHERE id = ANY(v_ps_ids)
      AND NOT EXISTS (SELECT 1 FROM public.operations o WHERE o.pricing_snapshot_id = pricing_snapshots.id);

  ALTER TABLE public.orders ENABLE TRIGGER USER;
END $$;