
-- Expand producers in public schema
ALTER TABLE public.producers RENAME COLUMN name TO full_name;
ALTER TABLE public.producers ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS responsible_name text;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS farm_address text;
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS warehouse_ids text[] DEFAULT '{}'::text[];
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS credit_rating smallint;
ALTER TABLE public.producers ADD CONSTRAINT producers_credit_rating_check CHECK (credit_rating IS NULL OR (credit_rating BETWEEN 1 AND 3));
ALTER TABLE public.producers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_producers_warehouse_ids ON public.producers USING GIN (warehouse_ids);

DROP TRIGGER IF EXISTS trg_producers_updated_at ON public.producers;
CREATE TRIGGER trg_producers_updated_at
  BEFORE UPDATE ON public.producers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public RLS for producers (full access for authenticated, mirroring project pattern)
ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "producers_all_authenticated" ON public.producers;
CREATE POLICY "producers_all_authenticated" ON public.producers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FK from operations.producer_id -> producers.id (ON DELETE SET NULL)
ALTER TABLE public.operations DROP CONSTRAINT IF EXISTS operations_producer_id_fkey;
ALTER TABLE public.operations
  ADD CONSTRAINT operations_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.producers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operations_producer_id ON public.operations(producer_id);

-- ===== Replicate in staging schema =====
ALTER TABLE staging.producers RENAME COLUMN name TO full_name;
ALTER TABLE staging.producers ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS responsible_name text;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS farm_address text;
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS warehouse_ids text[] DEFAULT '{}'::text[];
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS credit_rating smallint;
ALTER TABLE staging.producers ADD CONSTRAINT producers_credit_rating_check CHECK (credit_rating IS NULL OR (credit_rating BETWEEN 1 AND 3));
ALTER TABLE staging.producers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_producers_warehouse_ids ON staging.producers USING GIN (warehouse_ids);

DROP TRIGGER IF EXISTS trg_producers_updated_at ON staging.producers;
CREATE TRIGGER trg_producers_updated_at
  BEFORE UPDATE ON staging.producers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE staging.producers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "producers_all_authenticated" ON staging.producers;
CREATE POLICY "producers_all_authenticated" ON staging.producers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE staging.operations DROP CONSTRAINT IF EXISTS operations_producer_id_fkey;
ALTER TABLE staging.operations
  ADD CONSTRAINT operations_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES staging.producers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operations_producer_id ON staging.operations(producer_id);
