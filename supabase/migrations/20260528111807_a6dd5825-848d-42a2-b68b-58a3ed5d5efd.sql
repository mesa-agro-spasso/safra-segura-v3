ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS forced_env text NULL
  CHECK (forced_env IS NULL OR forced_env IN ('staging'));

ALTER TABLE staging.user_profiles
  ADD COLUMN IF NOT EXISTS forced_env text NULL
  CHECK (forced_env IS NULL OR forced_env IN ('staging'));