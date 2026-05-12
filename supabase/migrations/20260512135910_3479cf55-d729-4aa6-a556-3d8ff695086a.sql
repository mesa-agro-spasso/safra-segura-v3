ALTER TABLE public.physical_sales ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE staging.physical_sales ALTER COLUMN batch_id DROP NOT NULL;