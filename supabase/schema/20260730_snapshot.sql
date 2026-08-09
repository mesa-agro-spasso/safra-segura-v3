-- =====================================================================
-- SNAPSHOT DECLARATIVO DO SCHEMA — 30/07/2026
--
-- Isto NÃO é uma migration. Não é aplicado automaticamente por deploy,
-- db push ou db reset. É um documento de referência do estado do banco
-- de produção nesta data, para ser aplicado MANUALMENTE ao recriar o
-- projeto do zero.
--
-- As migrations em supabase/migrations/ estão INCOMPLETAS a partir de
-- 28/05/2026: alterações feitas por SQL direto nunca foram versionadas
-- (spot_settings, pricing_parameters.rounding_increment e .ticker_count,
-- market_data.raw_price e .raw_unit, triggers updated_at de
-- spot_settings e fx_parameters, linha corn_cbot de pricing_parameters).
--
-- Extraído do catálogo do Postgres do projeto ngwhatepvofvwgzbudth.
-- Contém apenas dados de CONFIGURAÇÃO (pricing_parameters,
-- spot_settings, fx_parameters, warehouses). Nenhum dado transacional.
-- =====================================================================


-- =====================================================================
-- 1. TIPOS
-- =====================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user');


-- =====================================================================
-- 2. TABELAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_staging boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  threshold_x_tons numeric NOT NULL,
  threshold_y_tons numeric NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fx_parameters (
  id text DEFAULT 'default'::text NOT NULL,
  short_bucket_carry_ann numeric NOT NULL,
  short_bucket_max_days integer NOT NULL,
  long_bucket_carry_ann numeric NOT NULL,
  spot_adjustment_factor numeric DEFAULT 1.0 NOT NULL,
  safety_haircut_brl numeric DEFAULT 0.0 NOT NULL,
  calibration_date date,
  calibration_source text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.historical_basis (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  benchmark text NOT NULL,
  reference_date date NOT NULL,
  basis_brl_per_sack numeric NOT NULL,
  source text DEFAULT 'stonex_interpolated'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  series_year text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.insurance_snapshots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pricing_snapshot_id uuid NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  premium_brl numeric NOT NULL,
  coverage_pct numeric NOT NULL,
  insurance_cost_brl numeric NOT NULL,
  adjusted_price_brl numeric NOT NULL,
  premium_source text DEFAULT 'theoretical'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  carry_enabled boolean DEFAULT false NOT NULL,
  payment_receipt_date date,
  carry_cost_brl numeric DEFAULT 0 NOT NULL,
  carry_interest_rate numeric,
  carry_interest_rate_period text
);

CREATE TABLE IF NOT EXISTS public.market_data (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  date date NOT NULL,
  ticker text NOT NULL,
  commodity text NOT NULL,
  price numeric,
  currency text NOT NULL,
  exchange_rate numeric,
  source text DEFAULT 'yfinance'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  exp_date date,
  price_unit text,
  ndf_spot numeric,
  ndf_estimated numeric,
  ndf_spread numeric,
  ndf_override numeric,
  raw_price numeric,
  raw_unit text
);

CREATE TABLE IF NOT EXISTS public.market_data_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticker text NOT NULL,
  commodity text,
  benchmark text,
  reference_date date NOT NULL,
  price numeric NOT NULL,
  currency text NOT NULL,
  price_unit text NOT NULL,
  exp_date date,
  source text DEFAULT 'yfinance'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.mtm_snapshots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operation_id uuid NOT NULL,
  futures_price_current numeric NOT NULL,
  physical_price_current numeric NOT NULL,
  spot_rate_current numeric,
  option_premium_current numeric,
  mtm_physical_brl numeric NOT NULL,
  mtm_futures_brl numeric NOT NULL,
  mtm_ndf_brl numeric DEFAULT 0 NOT NULL,
  mtm_option_brl numeric DEFAULT 0 NOT NULL,
  mtm_total_brl numeric NOT NULL,
  mtm_per_sack_brl numeric NOT NULL,
  total_exposure_brl numeric NOT NULL,
  volume_sacks numeric NOT NULL,
  calculated_by uuid,
  calculated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.operations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  display_code text,
  producer_id uuid,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  exchange text NOT NULL,
  volume_sacks numeric NOT NULL,
  origination_price_brl numeric NOT NULL,
  pricing_snapshot_id uuid,
  trade_date date NOT NULL,
  payment_date date NOT NULL,
  grain_reception_date date NOT NULL,
  sale_date date NOT NULL,
  hedge_plan jsonb DEFAULT '[]'::jsonb NOT NULL,
  status text DEFAULT 'DRAFT'::text NOT NULL,
  balance_snapshot jsonb DEFAULT '{}'::jsonb,
  closed_at timestamp with time zone,
  fully_closed_volume_sacks numeric,
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  cancellation_reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  internal_tags text[] DEFAULT '{}'::text[],
  closing_plan jsonb,
  physical_sale_price_brl_per_sack numeric,
  physical_sale_registered_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operation_id uuid NOT NULL,
  batch_id uuid,
  instrument_type text NOT NULL,
  direction text NOT NULL,
  is_closing boolean DEFAULT false NOT NULL,
  closes_order_id uuid,
  ticker text,
  contracts numeric(10,2) NOT NULL,
  volume_units numeric NOT NULL,
  price numeric,
  currency text NOT NULL,
  ndf_rate numeric,
  ndf_maturity date,
  ndf_table_version_id uuid,
  option_type text,
  strike numeric,
  premium numeric,
  expiration_date date,
  is_counterparty_insurance boolean DEFAULT false,
  brokerage_per_contract numeric,
  exchange_rate_at_execution numeric,
  executed_at timestamp with time zone DEFAULT now() NOT NULL,
  executed_by uuid NOT NULL,
  stonex_confirmation_text text,
  source_hedge_plan_item jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS public.physical_prices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  reference_date date NOT NULL,
  price_brl_per_sack numeric NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.physical_sales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operation_id uuid NOT NULL,
  batch_id uuid,
  volume_sacks numeric NOT NULL,
  price_brl_per_sack numeric NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  registered_by uuid,
  notes text
);

CREATE TABLE IF NOT EXISTS public.pricing_combinations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  benchmark text NOT NULL,
  ticker text NOT NULL,
  exp_date date,
  payment_date date,
  is_spot boolean DEFAULT false NOT NULL,
  grain_reception_date date,
  sale_date date NOT NULL,
  target_basis numeric,
  interest_rate numeric,
  storage_cost numeric,
  storage_cost_type text,
  reception_cost numeric,
  brokerage_per_contract numeric,
  desk_cost_pct numeric,
  shrinkage_rate_monthly numeric,
  additional_discount_brl numeric DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  pricing_method text DEFAULT 'LONG_BASIS'::text NOT NULL,
  origination_price_net_brl numeric
);

CREATE TABLE IF NOT EXISTS public.pricing_parameters (
  id text NOT NULL,
  sigma numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  target_profit_brl_per_sack numeric DEFAULT 2.0,
  execution_spread_pct numeric DEFAULT 0.05,
  cbot_ticker_count integer DEFAULT 5 NOT NULL,
  b3_corn_ticker_count integer DEFAULT 10 NOT NULL,
  rounding_increment numeric,
  ticker_count integer
);

CREATE TABLE IF NOT EXISTS public.pricing_snapshots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  benchmark text NOT NULL,
  trade_date date NOT NULL,
  payment_date date NOT NULL,
  grain_reception_date date NOT NULL,
  sale_date date NOT NULL,
  ticker text NOT NULL,
  target_basis_brl numeric NOT NULL,
  origination_price_brl numeric NOT NULL,
  futures_price_brl numeric NOT NULL,
  exchange_rate numeric,
  inputs_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  outputs_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  insurance_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  additional_discount_brl numeric DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.producers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  responsible_name text,
  tax_id text,
  phone text,
  email text,
  farm_address text,
  warehouse_ids text[] DEFAULT '{}'::text[],
  credit_rating smallint,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.signatures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operation_id uuid NOT NULL,
  batch_id uuid,
  flow_type text NOT NULL,
  user_id uuid NOT NULL,
  role_used text NOT NULL,
  decision text NOT NULL,
  signed_at timestamp with time zone DEFAULT now() NOT NULL,
  substituting_commercial_n1 boolean DEFAULT false,
  below_authorized_price boolean DEFAULT false,
  justification text,
  policy_version_id uuid,
  ip_address text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.spot_settings (
  id text DEFAULT 'default'::text NOT NULL,
  mode text DEFAULT 'weekday'::text NOT NULL,
  weekday integer DEFAULT 2 NOT NULL,
  skip_current_week boolean DEFAULT true NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  status text DEFAULT 'pending'::text NOT NULL,
  access_level text DEFAULT 'limited'::text NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  approved_at timestamp with time zone,
  approved_by uuid,
  theme text DEFAULT 'dark'::text NOT NULL,
  forced_env text,
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  full_name text NOT NULL,
  roles text[] DEFAULT '{}'::text[] NOT NULL,
  warehouse_id text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.warehouse_closing_batches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  warehouse_id text NOT NULL,
  commodity text NOT NULL,
  exchange text NOT NULL,
  total_volume_sacks numeric NOT NULL,
  allocation_strategy text NOT NULL,
  mtm_snapshot_used_at timestamp with time zone,
  mtm_staleness_warning text,
  allocation_snapshot jsonb DEFAULT '[]'::jsonb,
  affected_operations_count integer DEFAULT 0,
  generated_orders_count integer DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  status text DEFAULT 'DRAFT'::text NOT NULL,
  cancellation_reason text,
  order_message text,
  confirmation_message text,
  physical_sale_price_estimated_brl_per_sack numeric,
  physical_sale_price_executed_brl_per_sack numeric
);

CREATE TABLE IF NOT EXISTS public.warehouses (
  id text NOT NULL,
  display_name text NOT NULL,
  city text,
  state text,
  type text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  basis_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  abbr text NOT NULL,
  interest_rate numeric,
  interest_rate_period text DEFAULT 'monthly'::text,
  storage_cost numeric,
  storage_cost_type text DEFAULT 'fixed'::text,
  reception_cost numeric,
  brokerage_per_contract_cbot numeric,
  brokerage_per_contract_b3 numeric,
  desk_cost_pct numeric,
  shrinkage_rate_monthly numeric,
  deleted_at timestamp with time zone
);


-- =====================================================================
-- 3. GRANTS (estado atual: ALL para anon, authenticated e service_role
--    em todas as tabelas do schema public — o controle efetivo é feito
--    pelas policies de RLS da seção 5)
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO service_role;


-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_basis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_closing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- 5. POLICIES
-- NOTA: as policies referenciam public.is_admin(), definida na seção 8.
-- Ao aplicar do zero, rode a seção 8 antes desta.
-- =====================================================================

CREATE POLICY "Admin reads all profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "Admin updates profiles" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Authenticated full access" ON public.market_data AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.pricing_combinations AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.pricing_snapshots AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.users AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.warehouses AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users read own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = auth.uid()));
CREATE POLICY "authenticated can insert mtm_snapshots" ON public.mtm_snapshots AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "authenticated can insert operations" ON public.operations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid()));
CREATE POLICY "authenticated can insert orders" ON public.orders AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((executed_by = auth.uid()));
CREATE POLICY "authenticated can insert signatures" ON public.signatures AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "authenticated can select mtm_snapshots" ON public.mtm_snapshots AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated can select operations" ON public.operations AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated can select orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated can select signatures" ON public.signatures AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated can update operations" ON public.operations AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated can update signatures" ON public.signatures AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated full access" ON public.approval_policies AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated full access" ON public.physical_sales AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated full access" ON public.pricing_parameters AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "authenticated users can insert" ON public.warehouse_closing_batches AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "authenticated users can select" ON public.warehouse_closing_batches AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated users can update" ON public.warehouse_closing_batches AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "users can update own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));
CREATE POLICY "users insert own activity" ON public.activity_log AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
CREATE POLICY activity_log_select_admin ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY fx_parameters_read ON public.fx_parameters AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY historical_basis_all_authenticated ON public.historical_basis AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY insurance_snapshots_insert_authenticated ON public.insurance_snapshots AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY insurance_snapshots_select_authenticated ON public.insurance_snapshots AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY insurance_snapshots_update_authenticated ON public.insurance_snapshots AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY market_data_history_all_authenticated ON public.market_data_history AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY physical_prices_all_authenticated ON public.physical_prices AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY producers_all_authenticated ON public.producers AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY spot_settings_read ON public.spot_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY spot_settings_write ON public.spot_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- =====================================================================
-- 6. CONSTRAINTS
-- =====================================================================

ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.approval_policies ADD CONSTRAINT approval_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.approval_policies ADD CONSTRAINT approval_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.fx_parameters ADD CONSTRAINT fx_parameters_pkey PRIMARY KEY (id);
ALTER TABLE public.fx_parameters ADD CONSTRAINT fx_parameters_single_row CHECK ((id = 'default'::text));
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_benchmark_check CHECK ((benchmark = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_pkey PRIMARY KEY (id);
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_unique_key UNIQUE (warehouse_id, commodity, benchmark, reference_date, series_year);
ALTER TABLE public.historical_basis ADD CONSTRAINT historical_basis_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.cockpit_layouts ADD CONSTRAINT cockpit_layouts_pkey PRIMARY KEY (user_id);
ALTER TABLE public.cockpit_layouts ADD CONSTRAINT cockpit_layouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- A unicidade (id, benchmark) de insurance_options existe só para sustentar a FK
-- composta de insurance_option_quotes: cotação nunca troca de benchmark.
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_pkey PRIMARY KEY (id);
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_id_benchmark_uk UNIQUE (id, benchmark);
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_commodity_chk CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_benchmark_chk CHECK ((benchmark = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_pair_chk CHECK ((((commodity || '+'::text) || benchmark) = ANY (ARRAY['soybean+cbot'::text, 'corn+cbot'::text, 'corn+b3'::text])));
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_type_chk CHECK ((option_type = ANY (ARRAY['call'::text, 'put'::text])));
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_unit_chk CHECK ((((benchmark = 'cbot'::text) AND (strike_usd_bushel IS NOT NULL) AND (strike_brl_sack IS NULL)) OR ((benchmark = 'b3'::text) AND (strike_brl_sack IS NOT NULL) AND (strike_usd_bushel IS NULL))));
ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_positive_chk CHECK (((COALESCE(strike_usd_bushel, (1)::numeric) > (0)::numeric) AND (COALESCE(strike_brl_sack, (1)::numeric) > (0)::numeric)));
ALTER TABLE public.insurance_option_quotes ADD CONSTRAINT insurance_option_quotes_pkey PRIMARY KEY (id);
ALTER TABLE public.insurance_option_quotes ADD CONSTRAINT insurance_option_quotes_option_fk FOREIGN KEY (option_id, benchmark) REFERENCES insurance_options(id, benchmark);
ALTER TABLE public.insurance_option_quotes ADD CONSTRAINT insurance_option_quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.insurance_option_quotes ADD CONSTRAINT insurance_option_quotes_unit_chk CHECK ((((benchmark = 'cbot'::text) AND (premium_usd_bushel IS NOT NULL) AND (premium_brl_sack IS NULL)) OR ((benchmark = 'b3'::text) AND (premium_brl_sack IS NOT NULL) AND (premium_usd_bushel IS NULL))));
ALTER TABLE public.insurance_option_quotes ADD CONSTRAINT insurance_option_quotes_positive_chk CHECK (((COALESCE(premium_usd_bushel, (1)::numeric) > (0)::numeric) AND (COALESCE(premium_brl_sack, (1)::numeric) > (0)::numeric)));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_commodity_check CHECK ((commodity = ANY (ARRAY['SOJA'::text, 'MILHO_CBOT'::text, 'MILHO'::text, 'FX'::text])));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'BRL'::text])));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_pkey PRIMARY KEY (id);
ALTER TABLE public.market_data ADD CONSTRAINT market_data_price_unit_check CHECK (((price_unit IS NULL) OR (price_unit = ANY (ARRAY['usd_per_bushel'::text, 'brl_per_sack'::text, 'brl_per_usd'::text]))));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_raw_pair_check CHECK (((raw_price IS NULL) = (raw_unit IS NULL)));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_raw_unit_check CHECK (((raw_unit IS NULL) OR (raw_unit = ANY (ARRAY['cents_per_bushel'::text, 'brl_per_sack'::text]))));
ALTER TABLE public.market_data ADD CONSTRAINT market_data_ticker_key UNIQUE (ticker);
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_benchmark_check CHECK (((benchmark IS NULL) OR (benchmark = ANY (ARRAY['cbot'::text, 'b3'::text]))));
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_commodity_check CHECK (((commodity IS NULL) OR (commodity = ANY (ARRAY['soybean'::text, 'corn'::text, 'fx'::text]))));
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'BRL'::text])));
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_pkey PRIMARY KEY (id);
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_price_check CHECK ((price > (0)::numeric));
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_price_unit_check CHECK ((price_unit = ANY (ARRAY['usd_per_bushel'::text, 'brl_per_sack'::text, 'brl_per_usd'::text])));
ALTER TABLE public.market_data_history ADD CONSTRAINT market_data_history_ticker_reference_date_key UNIQUE (ticker, reference_date);
ALTER TABLE public.mtm_snapshots ADD CONSTRAINT mtm_snapshots_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES auth.users(id);
ALTER TABLE public.mtm_snapshots ADD CONSTRAINT mtm_snapshots_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES operations(id);
ALTER TABLE public.mtm_snapshots ADD CONSTRAINT mtm_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.operations ADD CONSTRAINT operations_cancellation_required CHECK (((status = 'CANCELLED'::text) = (cancellation_reason IS NOT NULL)));
ALTER TABLE public.operations ADD CONSTRAINT operations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);
ALTER TABLE public.operations ADD CONSTRAINT operations_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.operations ADD CONSTRAINT operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.operations ADD CONSTRAINT operations_dates_consistent CHECK (((trade_date <= payment_date) AND (trade_date <= grain_reception_date)));
ALTER TABLE public.operations ADD CONSTRAINT operations_display_code_key UNIQUE (display_code);
ALTER TABLE public.operations ADD CONSTRAINT operations_exchange_check CHECK ((exchange = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.operations ADD CONSTRAINT operations_origination_price_brl_check CHECK ((origination_price_brl > (0)::numeric));
ALTER TABLE public.operations ADD CONSTRAINT operations_pkey PRIMARY KEY (id);
ALTER TABLE public.operations ADD CONSTRAINT operations_pricing_snapshot_id_fkey FOREIGN KEY (pricing_snapshot_id) REFERENCES pricing_snapshots(id);
ALTER TABLE public.operations ADD CONSTRAINT operations_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(id) ON DELETE SET NULL;
ALTER TABLE public.operations ADD CONSTRAINT operations_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'PARTIALLY_CLOSED'::text, 'CLOSED'::text, 'CANCELLED'::text])));
ALTER TABLE public.operations ADD CONSTRAINT operations_volume_sacks_check CHECK ((volume_sacks > (0)::numeric));
ALTER TABLE public.operations ADD CONSTRAINT operations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES warehouse_closing_batches(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_closes_only_when_closing CHECK (((closes_order_id IS NULL) OR (is_closing = true)));
ALTER TABLE public.orders ADD CONSTRAINT orders_closes_order_id_fkey FOREIGN KEY (closes_order_id) REFERENCES orders(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_contracts_check CHECK ((contracts > (0)::numeric));
ALTER TABLE public.orders ADD CONSTRAINT orders_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'BRL'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_direction_check CHECK ((direction = ANY (ARRAY['buy'::text, 'sell'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES auth.users(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_futures_price_required CHECK (((instrument_type <> 'futures'::text) OR (price IS NOT NULL)));
ALTER TABLE public.orders ADD CONSTRAINT orders_instrument_type_check CHECK ((instrument_type = ANY (ARRAY['futures'::text, 'ndf'::text, 'option'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_ndf_fields_required CHECK (((instrument_type <> 'ndf'::text) OR ((ndf_rate IS NOT NULL) AND (ndf_maturity IS NOT NULL))));
ALTER TABLE public.orders ADD CONSTRAINT orders_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES operations(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_option_fields_required CHECK (((instrument_type <> 'option'::text) OR ((option_type IS NOT NULL) AND (strike IS NOT NULL) AND (expiration_date IS NOT NULL))));
ALTER TABLE public.orders ADD CONSTRAINT orders_option_type_check CHECK (((option_type IS NULL) OR (option_type = ANY (ARRAY['call'::text, 'put'::text]))));
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_volume_units_check CHECK ((volume_units > (0)::numeric));
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_pkey PRIMARY KEY (id);
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_price_brl_per_sack_check CHECK ((price_brl_per_sack > (0)::numeric));
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_warehouse_id_commodity_reference_date_key UNIQUE (warehouse_id, commodity, reference_date);
ALTER TABLE public.physical_prices ADD CONSTRAINT physical_prices_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES warehouse_closing_batches(id);
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_operation_id_batch_id_key UNIQUE (operation_id, batch_id);
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES operations(id);
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_pkey PRIMARY KEY (id);
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_price_brl_per_sack_check CHECK ((price_brl_per_sack > (0)::numeric));
ALTER TABLE public.physical_sales ADD CONSTRAINT physical_sales_volume_sacks_check CHECK ((volume_sacks > (0)::numeric));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_benchmark_check CHECK ((benchmark = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_method_input_coherent CHECK ((((pricing_method = 'LONG_BASIS'::text) AND (target_basis IS NOT NULL) AND (origination_price_net_brl IS NULL)) OR ((pricing_method = 'TARGET_PRICE'::text) AND (origination_price_net_brl IS NOT NULL) AND (target_basis IS NULL))));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_pricing_method_valid CHECK ((pricing_method = ANY (ARRAY['LONG_BASIS'::text, 'TARGET_PRICE'::text])));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_target_price_no_discount CHECK (((pricing_method <> 'TARGET_PRICE'::text) OR (COALESCE(additional_discount_brl, (0)::numeric) = (0)::numeric)));
ALTER TABLE public.pricing_combinations ADD CONSTRAINT pricing_combinations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.pricing_parameters ADD CONSTRAINT pricing_parameters_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_snapshots ADD CONSTRAINT pricing_snapshots_benchmark_check CHECK ((benchmark = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.pricing_snapshots ADD CONSTRAINT pricing_snapshots_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.pricing_snapshots ADD CONSTRAINT pricing_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.pricing_snapshots ADD CONSTRAINT pricing_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_snapshots ADD CONSTRAINT pricing_snapshots_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.producers ADD CONSTRAINT producers_credit_rating_check CHECK (((credit_rating IS NULL) OR ((credit_rating >= 1) AND (credit_rating <= 3))));
ALTER TABLE public.producers ADD CONSTRAINT producers_pkey PRIMARY KEY (id);
ALTER TABLE public.signatures ADD CONSTRAINT signatures_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES warehouse_closing_batches(id);
ALTER TABLE public.signatures ADD CONSTRAINT signatures_decision_check CHECK ((decision = ANY (ARRAY['APPROVE'::text, 'REJECT'::text])));
ALTER TABLE public.signatures ADD CONSTRAINT signatures_flow_type_check CHECK ((flow_type = ANY (ARRAY['OPENING'::text, 'CLOSING'::text])));
ALTER TABLE public.signatures ADD CONSTRAINT signatures_justification_required CHECK ((((substituting_commercial_n1 = false) AND (below_authorized_price = false)) OR (justification IS NOT NULL)));
ALTER TABLE public.signatures ADD CONSTRAINT signatures_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES operations(id);
ALTER TABLE public.signatures ADD CONSTRAINT signatures_pkey PRIMARY KEY (id);
ALTER TABLE public.signatures ADD CONSTRAINT signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.spot_settings ADD CONSTRAINT spot_settings_mode_check CHECK ((mode = ANY (ARRAY['weekday'::text, 'next_day'::text, 'same_day'::text])));
ALTER TABLE public.spot_settings ADD CONSTRAINT spot_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.spot_settings ADD CONSTRAINT spot_settings_single_row CHECK ((id = 'default'::text));
ALTER TABLE public.spot_settings ADD CONSTRAINT spot_settings_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)));
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_access_level_check CHECK ((access_level = ANY (ARRAY['limited'::text, 'full'::text])));
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_forced_env_check CHECK (((forced_env IS NULL) OR (forced_env = 'staging'::text)));
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text])));
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_theme_check CHECK ((theme = ANY (ARRAY['dark'::text, 'light'::text])));
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT physical_price_required_on_execution CHECK (((status <> 'EXECUTED'::text) OR (physical_sale_price_executed_brl_per_sack IS NOT NULL)));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_allocation_strategy_check CHECK ((allocation_strategy = ANY (ARRAY['MAX_PROFIT'::text, 'MAX_LOSS'::text, 'PROPORTIONAL'::text])));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_commodity_check CHECK ((commodity = ANY (ARRAY['soybean'::text, 'corn'::text])));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_exchange_check CHECK ((exchange = ANY (ARRAY['cbot'::text, 'b3'::text])));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'EXECUTED'::text, 'CANCELLED'::text])));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_total_volume_sacks_check CHECK ((total_volume_sacks > (0)::numeric));
ALTER TABLE public.warehouse_closing_batches ADD CONSTRAINT warehouse_closing_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_abbr_format CHECK ((abbr ~ '^[A-Z]{2,5}$'::text));
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_type_check CHECK ((type = ANY (ARRAY['ARMAZEM'::text, 'HQ'::text])));


-- =====================================================================
-- 7. ÍNDICES
-- =====================================================================

CREATE INDEX idx_activity_log_occurred_at ON public.activity_log USING btree (occurred_at DESC);
CREATE INDEX idx_activity_log_user_id ON public.activity_log USING btree (user_id);
CREATE INDEX idx_batches_created_at ON public.warehouse_closing_batches USING btree (created_at DESC);
CREATE INDEX idx_batches_warehouse_commodity ON public.warehouse_closing_batches USING btree (warehouse_id, commodity);
CREATE INDEX idx_market_data_history_by_commodity ON public.market_data_history USING btree (commodity, benchmark, reference_date DESC) WHERE (commodity IS NOT NULL);
CREATE INDEX idx_mtm_snapshots_operation_id ON public.mtm_snapshots USING btree (operation_id, calculated_at DESC);
CREATE INDEX idx_operations_commodity ON public.operations USING btree (commodity, exchange);
CREATE INDEX idx_operations_created_at ON public.operations USING btree (created_at DESC);
CREATE INDEX idx_operations_producer ON public.operations USING btree (producer_id) WHERE (producer_id IS NOT NULL);
CREATE INDEX idx_operations_producer_id ON public.operations USING btree (producer_id);
CREATE INDEX idx_operations_status ON public.operations USING btree (status);
CREATE INDEX idx_operations_warehouse_status ON public.operations USING btree (warehouse_id, status);
CREATE INDEX idx_orders_batch ON public.orders USING btree (batch_id) WHERE (batch_id IS NOT NULL);
CREATE INDEX idx_orders_executed_at ON public.orders USING btree (executed_at DESC);
CREATE INDEX idx_orders_instrument_type ON public.orders USING btree (instrument_type);
CREATE INDEX idx_orders_operation ON public.orders USING btree (operation_id);
CREATE INDEX idx_orders_operation_closing ON public.orders USING btree (operation_id, is_closing);
CREATE INDEX idx_physical_sales_batch ON public.physical_sales USING btree (batch_id);
CREATE INDEX idx_physical_sales_operation ON public.physical_sales USING btree (operation_id);
CREATE INDEX idx_producers_warehouse_ids ON public.producers USING gin (warehouse_ids);
CREATE INDEX idx_signatures_batch ON public.signatures USING btree (batch_id) WHERE (batch_id IS NOT NULL);
CREATE INDEX idx_signatures_operation_flow ON public.signatures USING btree (operation_id, flow_type);
CREATE INDEX idx_signatures_signed_at ON public.signatures USING btree (signed_at DESC);
CREATE INDEX idx_signatures_user ON public.signatures USING btree (user_id);
CREATE INDEX insurance_option_quotes_lookup_idx ON public.insurance_option_quotes USING btree (option_id, trade_date DESC, created_at DESC);
CREATE UNIQUE INDEX warehouses_abbr_unique_active ON public.warehouses USING btree (abbr) WHERE (deleted_at IS NULL);


-- =====================================================================
-- 8. FUNÇÕES
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_admin FROM user_profiles WHERE id = _user_id), false);
$function$;

CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT status FROM user_profiles WHERE id = _user_id;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, full_name, roles, warehouse_id, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    ARRAY['mesa'],
    'hq',
    true
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO staging.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.set_operation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_operation_display_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_abbr text;
  v_commodity_pt text;
  v_date_part text;
  v_prefix text;
  v_sequence integer;
  v_new_code text;
BEGIN
  IF NEW.display_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT abbr INTO v_abbr
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF v_abbr IS NULL THEN
    RAISE EXCEPTION 'Warehouse % not found or has no abbr', NEW.warehouse_id;
  END IF;

  v_commodity_pt := CASE NEW.commodity
    WHEN 'soybean' THEN 'SOJA'
    WHEN 'corn' THEN 'MILHO'
    ELSE upper(NEW.commodity)
  END;

  v_date_part := to_char(NEW.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYMMDD');

  v_prefix := v_abbr || '_' || v_commodity_pt || '_' || v_date_part || '_';

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(display_code FROM length(v_prefix) + 1)
        AS integer
      )
    ),
    0
  ) + 1
  INTO v_sequence
  FROM public.operations
  WHERE display_code LIKE v_prefix || '%';

  v_new_code := v_prefix || lpad(v_sequence::text, 3, '0');
  NEW.display_code := v_new_code;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_hedge_order_display_code(p_warehouse_id text, p_commodity text, p_trade_date date)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_abbr text;
  v_commodity_pt text;
  v_date_str text;
  v_prefix text;
  v_next_seq int;
  v_code text;
BEGIN
  SELECT abbr INTO v_abbr
  FROM warehouses
  WHERE id = p_warehouse_id;

  IF v_abbr IS NULL THEN
    RAISE EXCEPTION 'Warehouse % has no abbr set', p_warehouse_id;
  END IF;

  v_commodity_pt := CASE p_commodity
    WHEN 'soybean' THEN 'SOJA'
    WHEN 'corn'    THEN 'MILHO'
    ELSE upper(p_commodity)
  END;

  v_date_str := to_char(p_trade_date, 'YYMMDD');

  v_prefix := v_abbr || '_' || v_commodity_pt || '_' || v_date_str || '_';

  SELECT COALESCE(
    MAX(CAST(substring(display_code FROM length(v_prefix) + 1) AS int)),
    0
  ) + 1
  INTO v_next_seq
  FROM hedge_orders
  WHERE display_code LIKE v_prefix || '%';

  v_code := v_prefix || lpad(v_next_seq::text, 3, '0');
  RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_hedge_order_display_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_warehouse_id text;
  v_trade_date date;
BEGIN
  IF NEW.display_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.warehouse_id, COALESCE(o.created_at::date, CURRENT_DATE)
  INTO v_warehouse_id, v_trade_date
  FROM operations o
  WHERE o.id = NEW.operation_id;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Cannot generate display_code: operation % not found or has no warehouse', NEW.operation_id;
  END IF;

  NEW.display_code := generate_hedge_order_display_code(
    v_warehouse_id,
    NEW.commodity,
    v_trade_date
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_hedge_plan_after_active()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status <> 'DRAFT' AND OLD.hedge_plan IS DISTINCT FROM NEW.hedge_plan THEN
    RAISE EXCEPTION
      'hedge_plan is immutable once operation leaves DRAFT status (operation %, current status %)',
      OLD.id, OLD.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_order_modification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'Orders are immutable. To reverse a position, insert a new order with is_closing=true. '
    'Attempted operation: % on order %', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_operation_after_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_operation public.operations%ROWTYPE;
  v_balance jsonb;
  v_opening_count integer;
  v_closing_count integer;
  v_all_zero boolean;
  v_new_status text;
BEGIN
  SELECT * INTO v_operation
  FROM public.operations
  WHERE id = NEW.operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation % not found', NEW.operation_id;
  END IF;

  IF v_operation.status IN ('CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION
      'Cannot insert order on operation % in terminal status %',
      v_operation.id, v_operation.status;
  END IF;

  SELECT jsonb_object_agg(
    instrument_type,
    coalesce(opening_total, 0) - coalesce(closing_total, 0)
  )
  INTO v_balance
  FROM (
    SELECT
      instrument_type,
      sum(CASE WHEN is_closing = false THEN volume_units ELSE 0 END) AS opening_total,
      sum(CASE WHEN is_closing = true  THEN volume_units ELSE 0 END) AS closing_total
    FROM public.orders
    WHERE operation_id = NEW.operation_id
    GROUP BY instrument_type
  ) sub;

  SELECT
    count(*) FILTER (WHERE is_closing = false),
    count(*) FILTER (WHERE is_closing = true)
  INTO v_opening_count, v_closing_count
  FROM public.orders
  WHERE operation_id = NEW.operation_id;

  IF v_opening_count = 0 THEN
    v_new_status := v_operation.status;
  ELSIF v_closing_count = 0 THEN
    v_new_status := 'ACTIVE';
  ELSE
    SELECT bool_and((value)::numeric = 0)
    INTO v_all_zero
    FROM jsonb_each_text(v_balance);

    IF v_all_zero THEN
      v_new_status := 'CLOSED';
    ELSE
      v_new_status := 'PARTIALLY_CLOSED';
    END IF;
  END IF;

  IF v_new_status = 'CLOSED' THEN
    UPDATE public.operations
    SET
      status = v_new_status,
      balance_snapshot = v_balance,
      closed_at = COALESCE(closed_at, now()),
      fully_closed_volume_sacks = volume_sacks
    WHERE id = NEW.operation_id;
  ELSE
    UPDATE public.operations
    SET
      status = v_new_status,
      balance_snapshot = v_balance
    WHERE id = NEW.operation_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_operation_on_order_executed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' AND OLD.status != 'EXECUTED' THEN
    UPDATE operations
    SET status = 'HEDGE_CONFIRMADO'
    WHERE id = NEW.operation_id
      AND status != 'HEDGE_CONFIRMADO';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revert_operation_on_order_cancelled()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM hedge_orders
      WHERE operation_id = NEW.operation_id
        AND status != 'CANCELLED'
        AND id != NEW.id
    ) THEN
      UPDATE operations
      SET status = 'CANCELADA'
      WHERE id = NEW.operation_id
        AND status NOT IN ('CANCELADA', 'HEDGE_CONFIRMADO', 'ENCERRADA');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_block_trade_physical(p_batch_id uuid, p_user_id uuid, p_sales jsonb, p_weighted_price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;


-- =====================================================================
-- 9. TRIGGERS
-- =====================================================================

CREATE TRIGGER fx_parameters_updated_at BEFORE UPDATE ON public.fx_parameters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER historical_basis_updated_at BEFORE UPDATE ON public.historical_basis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER market_data_updated_at BEFORE UPDATE ON public.market_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_operations_freeze_hedge_plan BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION protect_hedge_plan_after_active();
CREATE TRIGGER trg_operations_set_display_code BEFORE INSERT ON public.operations FOR EACH ROW EXECUTE FUNCTION set_operation_display_code();
CREATE TRIGGER trg_operations_updated_at BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION set_operation_updated_at();
CREATE TRIGGER trg_orders_advance_operation AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION advance_operation_after_order();
CREATE TRIGGER trg_orders_block_delete BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION reject_order_modification();
CREATE TRIGGER trg_orders_block_update BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION reject_order_modification();
CREATE TRIGGER physical_prices_updated_at BEFORE UPDATE ON public.physical_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pricing_combinations_updated_at BEFORE UPDATE ON public.pricing_combinations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_producers_updated_at BEFORE UPDATE ON public.producers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER spot_settings_updated_at BEFORE UPDATE ON public.spot_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- NOTA: o trigger em auth.users que popula user_profiles é criado no
-- schema auth (reservado pelo Supabase) e NÃO faz parte deste snapshot.
-- Ao recriar o projeto, recrie-o manualmente apontando para
-- public.handle_new_user_profile().


-- =====================================================================
-- 10. DADOS DE CONFIGURAÇÃO
-- (sem dado transacional: pricing_combinations, pricing_snapshots,
--  operations, orders, market_data, historical_basis,
--  market_data_history, activity_log, users ficam vazios)
-- =====================================================================

-- pricing_parameters (3 linhas, uma por mercado)
INSERT INTO public.pricing_parameters (id, target_profit_brl_per_sack, execution_spread_pct, cbot_ticker_count, b3_corn_ticker_count, rounding_increment, ticker_count) VALUES ('soybean_cbot', 2, 0.02, 8, 6, 0.5, 8) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_parameters (id, target_profit_brl_per_sack, execution_spread_pct, cbot_ticker_count, b3_corn_ticker_count, rounding_increment, ticker_count) VALUES ('corn_cbot', 2, 0.02, 8, 6, 0.25, 8) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_parameters (id, target_profit_brl_per_sack, execution_spread_pct, cbot_ticker_count, b3_corn_ticker_count, rounding_increment, ticker_count) VALUES ('corn_b3', 2, 0.02, 8, 6, 0.25, 8) ON CONFLICT (id) DO NOTHING;

-- spot_settings (linha única)
INSERT INTO public.spot_settings (id, mode, weekday, skip_current_week) VALUES ('default', 'weekday', 2, true) ON CONFLICT (id) DO NOTHING;

-- fx_parameters (linha única)
INSERT INTO public.fx_parameters (id, short_bucket_carry_ann, short_bucket_max_days, long_bucket_carry_ann, spot_adjustment_factor, safety_haircut_brl, calibration_date, calibration_source) VALUES ('default', 0.082175, 270, 0.079336, 1.0, 0.0, '2026-03-15', 'stonex_curve_percentile_40') ON CONFLICT (id) DO NOTHING;

-- warehouses (14 linhas: 12 armazéns ativos, a sede 'hq', e '123' com soft delete)
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('050', '050', 'Uberaba', 'Minas Gerais', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -18}}'::jsonb, 'ZCI', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('123', 'Madcap', 'Belo Horizonte', 'MG', 'ARMAZEM', false, '{"corn": {"mode": "fixed", "value": -8}, "soybean": {"mode": "fixed", "value": -10}}'::jsonb, 'MAD', 4, 'monthly', 35, 'monthly', 0, 15, 12, 0.05, -0.997, '2026-07-20 16:19:54.812+00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('alta_floresta', 'Alta Floresta', 'Alta Floresta', 'MT', 'ARMAZEM', true, '{"corn": {"mode": "reference_delta", "delta_brl": -2, "reference_warehouse_id": "matupa"}, "soybean": {"mode": "reference_delta", "delta_brl": -2, "reference_warehouse_id": "matupa"}}'::jsonb, 'ALT', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('confresa', 'Confresa', 'Confresa', 'MT', 'ARMAZEM', true, '{"corn": {"mode": "fixed", "value": -25}, "soybean": {"mode": "fixed", "value": -30}}'::jsonb, 'CON', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('coromandel', 'Coromandel', 'Coromandel', 'Minas Gerais', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -21}}'::jsonb, 'COR', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('hq', 'Sede ', 'Belo Horizonte', 'MG', 'HQ', true, '{}'::jsonb, 'HQ', NULL, 'monthly', NULL, 'fixed', NULL, NULL, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('ibia', 'Ibiá', 'Ibiá', 'Minas Gerais', 'ARMAZEM', true, '{"corn": {"mode": "fixed", "value": -9}, "soybean": {"mode": "fixed", "value": -20}}'::jsonb, 'IBI', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('matupa', 'Matupá', 'Matupá', 'MT', 'ARMAZEM', true, '{"corn": {"mode": "fixed", "value": -25}, "soybean": {"mode": "fixed", "value": -28}}'::jsonb, 'MAT', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('nova_crixas', 'Nova Crixás', 'Nova Crixás', 'Goiás', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -22}}'::jsonb, 'NCX', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('sacramento', 'Sacramento', 'Sacramento', 'Minas Gerais', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -18}}'::jsonb, 'SAC', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('uberaba', 'Uberaba', 'Uberaba', 'Minas Gerais', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -18}}'::jsonb, 'UBR', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('uberlandia', 'Uberlândia', 'Uberlândia', 'Minas Gerais', 'ARMAZEM', true, '{"corn": {"mode": "fixed", "value": -11}, "soybean": {"mode": "fixed", "value": -18}}'::jsonb, 'UBL', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('uruaçu', 'Uruaçu', 'Uruaçu', 'Goias', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -22}}'::jsonb, 'URU', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.warehouses (id, display_name, city, state, type, active, basis_config, abbr, interest_rate, interest_rate_period, storage_cost, storage_cost_type, reception_cost, brokerage_per_contract_cbot, brokerage_per_contract_b3, desk_cost_pct, shrinkage_rate_monthly, deleted_at) VALUES ('vianopolis', 'Vianópolis', 'Vianópolis', 'GO', 'ARMAZEM', true, '{"soybean": {"mode": "fixed", "value": -19}}'::jsonb, 'VIA', 1.4, 'monthly', 4, 'fixed', 0, 15, 12, 0.003, 0.003, NULL) ON CONFLICT (id) DO NOTHING;

-- FIM DO SNAPSHOT

-- AVISOS DE FIDELIDADE (o banco atual é assim, não corrigimos aqui):
--  - public.has_role() referencia public.user_roles, que NÃO existe no
--    banco. A função é legado e não é usada por nenhuma policy.
--  - public.handle_new_user_profile() escreve também em
--    staging.user_profiles (schema staging, depreciado).
--  - public.generate_hedge_order_display_code() e
--    set_hedge_order_display_code() referenciam hedge_orders, tabela que
--    não existe mais. Legado, sem trigger associado.
