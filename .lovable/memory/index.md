# Project Memory

## Core
Dark mode (dark cyan/teal), primary #123332 (HSL 178 48%). Logo in sidebar.
API Python no Render = motor de pricing. Edge Function api-proxy = proxy.
market_data upsert onConflict:'ticker', freshness via updated_at.
Supabase Auth email/senha. user_profiles = autorização. public.users = legado, NÃO usar para auth.
Sidebar com 5 abas + admin condicional. Cadastro com aprovação admin.

## Memories
- [Architecture](mem://features/architecture) — Frontend→Edge Function→API Python on Render, zero cálculo local
- [Market data rules](mem://features/market-data) — Upsert ticker, B3 corn manual, 24h alerts
- [Database schema](mem://features/db-schema) — 7 tables, RLS policies, existing warehouses
- [Pricing combinations contract](mem://features/pricing-combinations-contract) — Restricted field values, null-inheritance rules, domain constraints
- [Auth & Access Control](mem://features/auth-access-control) — user_profiles, approval flow, admin panel, RLS, useAuthorization
