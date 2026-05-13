/**
 * Feature flags — single source of truth.
 *
 * Vite injects env vars as strings. The `=== 'true'` comparison is intentional:
 * any missing/undefined var resolves to `false` (safe-hide default).
 *
 * NEVER read `import.meta.env.VITE_FEATURE_*` outside this module.
 */
export const FEATURES = {
  FINANCIAL_CALENDAR: import.meta.env.VITE_FEATURE_FINANCIAL_CALENDAR === 'true',
  PRODUCERS: import.meta.env.VITE_FEATURE_PRODUCERS === 'true',
  MARKET_PHYSICAL: import.meta.env.VITE_FEATURE_MARKET_PHYSICAL === 'true',
  MARKET_HISTORICAL: import.meta.env.VITE_FEATURE_MARKET_HISTORICAL === 'true',
  AUTHORIZATION_TIERS: import.meta.env.VITE_FEATURE_AUTHORIZATION_TIERS === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURES;
