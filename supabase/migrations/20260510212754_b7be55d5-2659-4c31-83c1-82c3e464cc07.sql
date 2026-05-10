
-- 1) Trigger de updated_at em staging.market_data (já existe em public)
CREATE TRIGGER market_data_updated_at
BEFORE UPDATE ON staging.market_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Colunas configuráveis para quantidade de tickers
ALTER TABLE public.pricing_parameters
  ADD COLUMN IF NOT EXISTS cbot_ticker_count integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS b3_corn_ticker_count integer NOT NULL DEFAULT 10;

ALTER TABLE staging.pricing_parameters
  ADD COLUMN IF NOT EXISTS cbot_ticker_count integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS b3_corn_ticker_count integer NOT NULL DEFAULT 10;
