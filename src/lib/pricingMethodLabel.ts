/**
 * Rótulos canônicos dos métodos de precificação.
 * Característica imutável da combinação — este módulo é somente leitura.
 * Valor desconhecido/ausente renderiza '-' (nunca quebra a linha).
 */
export const PRICING_METHOD_LABELS: Record<string, string> = {
  LONG_BASIS: 'Long Basis',
  TARGET_PRICE: 'Target Price',
};

export function pricingMethodLabel(value: unknown): string {
  return typeof value === 'string' ? (PRICING_METHOD_LABELS[value] ?? '-') : '-';
}
