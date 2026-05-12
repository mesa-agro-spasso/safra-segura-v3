UPDATE staging.warehouse_closing_batches
   SET notes = COALESCE(notes || ' | ', '') ||
               'LEGACY: backfilled physical_sale_price_executed from physical_prices on 2026-05-12. ' ||
               'operations.physical_sale_price_brl_per_sack and physical_sales rows NOT populated.'
 WHERE id IN (
   '3ded4206-5389-4872-8839-f76b95c81550',
   '22c63986-5827-4132-a5f7-258aa4f3dc19'
 );