import type { AllocateBatchResponse } from '@/types/d24';
import type { MarketData } from '@/types';

type ExecutionBatchLike = {
  id: string;
};

export function resolveExecutionBatch<T extends ExecutionBatchLike>(
  executionBatch: T | null,
  batches: T[] | undefined,
): T | null {
  if (!executionBatch) return null;
  return batches?.find((batch) => batch.id === executionBatch.id) ?? executionBatch;
}

export function getSuggestedExecutionPrices(
  batchInstruments: string[],
  tickerByInstrument: Record<string, string>,
  marketData: MarketData[] | undefined,
): Record<string, { value: number; ticker: string } | undefined> {
  const out: Record<string, { value: number; ticker: string } | undefined> = {};
  if (!marketData?.length) return out;

  for (const instrument of batchInstruments) {
    const ticker = tickerByInstrument[instrument];
    if (!ticker) continue;

    const md = marketData.find((row) => row.ticker === ticker);
    if (!md) continue;

    if (instrument === 'futures' && md.price != null) {
      out[instrument] = { value: Number(md.price), ticker };
      continue;
    }

    if (instrument === 'ndf') {
      const ndfValue = md.ndf_override ?? md.ndf_estimated ?? md.ndf_spot;
      if (ndfValue != null) {
        out[instrument] = { value: Number(ndfValue), ticker };
        continue;
      }

      const fx = marketData.find((row) => row.ticker === 'USD/BRL');
      if (fx?.price != null) {
        out[instrument] = { value: Number(fx.price), ticker: 'USD/BRL spot' };
      }
    }
  }

  return out;
}

export function toExecutionProposals(batch: {
  id: string;
  allocation_snapshot?: AllocateBatchResponse['proposals'] | null;
  total_volume_sacks: number;
  allocation_strategy: string;
}): AllocateBatchResponse {
  return {
    proposals: batch.allocation_snapshot ?? [],
    total_volume_allocated_sacks: batch.total_volume_sacks,
    strategy_used: batch.allocation_strategy,
    warnings: [],
  };
}