ALTER TABLE public.warehouse_closing_batches
  ADD COLUMN IF NOT EXISTS order_message text,
  ADD COLUMN IF NOT EXISTS confirmation_message text;