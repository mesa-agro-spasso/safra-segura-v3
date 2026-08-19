/** Rótulo de exibição da commodity. Só apresentação: o banco segue em inglês. */
const LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };

export function commodityLabel(commodity: string | null | undefined): string {
  if (!commodity) return '—';
  return LABELS[commodity] ?? commodity;
}
