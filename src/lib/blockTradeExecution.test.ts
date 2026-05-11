import { describe, expect, it } from 'vitest';
import { getSuggestedExecutionPrices, resolveExecutionBatch, toExecutionProposals } from './blockTradeExecution';
import type { MarketData } from '@/types';

const marketData = [
  {
    id: '1',
    ticker: 'USD/BRL',
    commodity: 'FX',
    price: 4.8908,
    currency: 'BRL',
    date: '2026-05-11',
    exchange_rate: null,
    source: 'api',
    price_unit: null,
    exp_date: null,
    ndf_spot: null,
    ndf_estimated: null,
    ndf_spread: null,
    ndf_override: null,
    created_at: '2026-05-11T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
  },
  {
    id: '2',
    ticker: 'ZSQ26',
    commodity: 'SOJA',
    price: 12.145,
    currency: 'USD',
    date: '2026-05-11',
    exchange_rate: null,
    source: 'api',
    price_unit: null,
    exp_date: null,
    ndf_spot: 4.9449,
    ndf_estimated: 5.0507,
    ndf_spread: null,
    ndf_override: null,
    created_at: '2026-05-11T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
  },
] satisfies MarketData[];

describe('blockTradeExecution helpers', () => {
  it('usa o batch explicitamente selecionado, sem fallback para outro draft', () => {
    const selected = { id: 'batch-2', status: 'DRAFT' };
    const batches = [{ id: 'batch-1', status: 'DRAFT' }];

    expect(resolveExecutionBatch(selected, batches)).toEqual(selected);
  });

  it('monta proposals de execução a partir do batch sem metadados extras', () => {
    const proposals = toExecutionProposals({
      id: 'batch-1',
      total_volume_sacks: 555,
      allocation_strategy: 'PROPORTIONAL',
      allocation_snapshot: [{ operation_id: 'op-1', display_code: 'MAT_SOJA_001', current_volume_sacks: 1000, volume_to_close_sacks: 555, allocation_reason: 'ok' }],
    });

    expect(proposals).toEqual({
      proposals: [{ operation_id: 'op-1', display_code: 'MAT_SOJA_001', current_volume_sacks: 1000, volume_to_close_sacks: 555, allocation_reason: 'ok' }],
      total_volume_allocated_sacks: 555,
      strategy_used: 'PROPORTIONAL',
      warnings: [],
    });
  });

  it('usa NDF estimado quando existe e cai para USD/BRL spot quando faltar NDF', () => {
    const withNdf = getSuggestedExecutionPrices(['ndf'], { ndf: 'ZSQ26' }, marketData);
    expect(withNdf.ndf).toEqual({ value: 5.0507, ticker: 'ZSQ26' });

    const withoutNdf = getSuggestedExecutionPrices(
      ['ndf'],
      { ndf: 'USD/BRL' },
      marketData,
    );
    expect(withoutNdf.ndf).toEqual({ value: 4.8908, ticker: 'USD/BRL spot' });
  });
});