
-- ============================================================
-- STAGING SCHEMA: ambiente de testes isolado dentro do banco prod
-- ============================================================

-- 1) Schema + privilégios
CREATE SCHEMA IF NOT EXISTS staging;
GRANT USAGE ON SCHEMA staging TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 2) Tabelas (estrutura idêntica a public via LIKE INCLUDING ALL)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'warehouses','user_profiles','users','producers','approval_policies',
    'pricing_parameters','market_data','market_data_history','historical_basis',
    'physical_prices','pricing_combinations','pricing_snapshots','operations',
    'orders','signatures','mtm_snapshots','warehouse_closing_batches'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS staging.%I (LIKE public.%I INCLUDING ALL)',
      t, t
    );
  END LOOP;
END $$;

-- 3) Garantir UNIQUE em market_data.ticker (para upserts ON CONFLICT)
DO $$ BEGIN
  ALTER TABLE staging.market_data ADD CONSTRAINT market_data_ticker_key UNIQUE (ticker);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 4) Foreign keys (LIKE não copia FKs; criamos staging->staging)
DO $$ BEGIN
  ALTER TABLE staging.operations ADD CONSTRAINT operations_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.operations ADD CONSTRAINT operations_pricing_snapshot_id_fkey
    FOREIGN KEY (pricing_snapshot_id) REFERENCES staging.pricing_snapshots(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.pricing_snapshots ADD CONSTRAINT pricing_snapshots_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.pricing_combinations ADD CONSTRAINT pricing_combinations_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.orders ADD CONSTRAINT orders_operation_id_fkey
    FOREIGN KEY (operation_id) REFERENCES staging.operations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.orders ADD CONSTRAINT orders_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES staging.warehouse_closing_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.orders ADD CONSTRAINT orders_closes_order_id_fkey
    FOREIGN KEY (closes_order_id) REFERENCES staging.orders(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.signatures ADD CONSTRAINT signatures_operation_id_fkey
    FOREIGN KEY (operation_id) REFERENCES staging.operations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.signatures ADD CONSTRAINT signatures_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES staging.warehouse_closing_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.mtm_snapshots ADD CONSTRAINT mtm_snapshots_operation_id_fkey
    FOREIGN KEY (operation_id) REFERENCES staging.operations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.warehouse_closing_batches ADD CONSTRAINT wcb_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.historical_basis ADD CONSTRAINT historical_basis_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE staging.physical_prices ADD CONSTRAINT physical_prices_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES staging.warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) RLS — habilitar em todas e dar acesso total a authenticated
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='staging' LOOP
    EXECUTE format('ALTER TABLE staging.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "staging_full_access" ON staging.%I; '
      'CREATE POLICY "staging_full_access" ON staging.%I '
      'FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- 6) Funções helper em staging (espelham as de public, mas operam em staging.*)
CREATE OR REPLACE FUNCTION staging.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = staging
AS $$ SELECT COALESCE((SELECT is_admin FROM staging.user_profiles WHERE id = _user_id), false); $$;

CREATE OR REPLACE FUNCTION staging.get_user_status(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = staging
AS $$ SELECT status FROM staging.user_profiles WHERE id = _user_id; $$;

CREATE OR REPLACE FUNCTION staging.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = staging
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION staging.set_operation_display_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = staging
AS $$
DECLARE
  v_abbr text; v_commodity_pt text; v_date_part text;
  v_prefix text; v_sequence integer; v_new_code text;
BEGIN
  IF NEW.display_code IS NOT NULL THEN RETURN NEW; END IF;
  SELECT abbr INTO v_abbr FROM staging.warehouses WHERE id = NEW.warehouse_id;
  IF v_abbr IS NULL THEN
    RAISE EXCEPTION 'Warehouse % not found or has no abbr', NEW.warehouse_id;
  END IF;
  v_commodity_pt := CASE NEW.commodity
    WHEN 'soybean' THEN 'SOJA' WHEN 'corn' THEN 'MILHO' ELSE upper(NEW.commodity) END;
  v_date_part := to_char(NEW.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYMMDD');
  v_prefix := v_abbr || '_' || v_commodity_pt || '_' || v_date_part || '_';
  SELECT COALESCE(MAX(CAST(SUBSTRING(display_code FROM length(v_prefix)+1) AS integer)), 0) + 1
    INTO v_sequence FROM staging.operations WHERE display_code LIKE v_prefix || '%';
  NEW.display_code := v_prefix || lpad(v_sequence::text, 3, '0');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION staging.set_operation_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION staging.advance_operation_after_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = staging
AS $$
DECLARE
  v_operation staging.operations%ROWTYPE;
  v_balance jsonb; v_opening_count integer; v_closing_count integer;
  v_all_zero boolean; v_new_status text;
BEGIN
  SELECT * INTO v_operation FROM staging.operations WHERE id = NEW.operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation % not found', NEW.operation_id; END IF;
  IF v_operation.status IN ('CLOSED','CANCELLED') THEN
    RAISE EXCEPTION 'Cannot insert order on operation % in terminal status %', v_operation.id, v_operation.status;
  END IF;
  SELECT jsonb_object_agg(instrument_type, coalesce(opening_total,0)-coalesce(closing_total,0))
    INTO v_balance FROM (
      SELECT instrument_type,
        sum(CASE WHEN is_closing=false THEN volume_units ELSE 0 END) AS opening_total,
        sum(CASE WHEN is_closing=true  THEN volume_units ELSE 0 END) AS closing_total
      FROM staging.orders WHERE operation_id = NEW.operation_id GROUP BY instrument_type
    ) sub;
  SELECT count(*) FILTER (WHERE is_closing=false), count(*) FILTER (WHERE is_closing=true)
    INTO v_opening_count, v_closing_count
    FROM staging.orders WHERE operation_id = NEW.operation_id;
  IF v_opening_count = 0 THEN v_new_status := v_operation.status;
  ELSIF v_closing_count = 0 THEN v_new_status := 'ACTIVE';
  ELSE
    SELECT bool_and((value)::numeric = 0) INTO v_all_zero FROM jsonb_each_text(v_balance);
    v_new_status := CASE WHEN v_all_zero THEN 'CLOSED' ELSE 'PARTIALLY_CLOSED' END;
  END IF;
  IF v_new_status = 'CLOSED' THEN
    UPDATE staging.operations SET status=v_new_status, balance_snapshot=v_balance,
      closed_at=COALESCE(closed_at, now()), fully_closed_volume_sacks=volume_sacks
      WHERE id = NEW.operation_id;
  ELSE
    UPDATE staging.operations SET status=v_new_status, balance_snapshot=v_balance
      WHERE id = NEW.operation_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION staging.reject_order_modification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Orders are immutable. Insert a new order with is_closing=true.'; END $$;

CREATE OR REPLACE FUNCTION staging.protect_hedge_plan_after_active()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND OLD.hedge_plan IS DISTINCT FROM NEW.hedge_plan THEN
    RAISE EXCEPTION 'hedge_plan is immutable once operation leaves DRAFT';
  END IF;
  RETURN NEW;
END $$;

-- 7) Triggers em staging
DROP TRIGGER IF EXISTS trg_set_operation_display_code ON staging.operations;
CREATE TRIGGER trg_set_operation_display_code BEFORE INSERT ON staging.operations
  FOR EACH ROW EXECUTE FUNCTION staging.set_operation_display_code();

DROP TRIGGER IF EXISTS trg_operations_updated_at ON staging.operations;
CREATE TRIGGER trg_operations_updated_at BEFORE UPDATE ON staging.operations
  FOR EACH ROW EXECUTE FUNCTION staging.set_operation_updated_at();

DROP TRIGGER IF EXISTS trg_advance_operation_after_order ON staging.orders;
CREATE TRIGGER trg_advance_operation_after_order AFTER INSERT ON staging.orders
  FOR EACH ROW EXECUTE FUNCTION staging.advance_operation_after_order();

DROP TRIGGER IF EXISTS trg_reject_order_modification ON staging.orders;
CREATE TRIGGER trg_reject_order_modification BEFORE UPDATE OR DELETE ON staging.orders
  FOR EACH ROW EXECUTE FUNCTION staging.reject_order_modification();

DROP TRIGGER IF EXISTS trg_protect_hedge_plan ON staging.operations;
CREATE TRIGGER trg_protect_hedge_plan BEFORE UPDATE ON staging.operations
  FOR EACH ROW EXECUTE FUNCTION staging.protect_hedge_plan_after_active();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON staging.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON staging.user_profiles
  FOR EACH ROW EXECUTE FUNCTION staging.update_updated_at_column();

-- 8) Estender handle_new_user_profile para criar profile nos DOIS schemas
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO staging.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- 9) Seed: dados de referência + perfis existentes
INSERT INTO staging.warehouses SELECT * FROM public.warehouses
  ON CONFLICT (id) DO NOTHING;
INSERT INTO staging.pricing_parameters SELECT * FROM public.pricing_parameters
  ON CONFLICT (id) DO NOTHING;
INSERT INTO staging.approval_policies SELECT * FROM public.approval_policies
  ON CONFLICT (id) DO NOTHING;
INSERT INTO staging.user_profiles SELECT * FROM public.user_profiles
  ON CONFLICT (id) DO NOTHING;
INSERT INTO staging.users SELECT * FROM public.users
  ON CONFLICT (id) DO NOTHING;

-- 10) Recarregar PostgREST
NOTIFY pgrst, 'reload schema';
