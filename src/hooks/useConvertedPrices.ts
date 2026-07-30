import { useQueries } from '@tanstack/react-query';
import { callApi } from '@/lib/api';

/**
 * Conversão de preço USD/bushel → BRL/saca via API (POST /utils/convert-price).
 *
 * REGRA DA CASA (P07): ZERO aritmética financeira ou de unidade no frontend.
 * Nenhum fator bushel/saca aparece aqui — a API devolve o número pronto.
 *
 * O câmbio usado é o `ndf_estimated` DA LINHA (dólar do vencimento daquele
 * contrato). Nunca o spot: são números diferentes e substituir um pelo outro
 * em silêncio esconderia a ausência do dado. Linha sem NDF → sem chamada.
 *
 * O endpoint não aceita lista (Swagger: `value` é escalar), então é uma
 * requisição por linha, com cache por ticker + preço + NDF.
 */
export interface ConvertibleRow {
  ticker: string;
  price: number | null;
  ndf_estimated: number | null;
}

interface ConvertPriceResponse {
  value_converted: number;
  exchange_rate_used: number;
}

export function useConvertedPrices(
  rows: ConvertibleRow[],
  commodity: 'soybean' | 'corn',
): Map<string, number> {
  const convertible = rows.filter(
    (r) => r.price != null && r.ndf_estimated != null,
  );

  const results = useQueries({
    queries: convertible.map((r) => ({
      queryKey: ['convert_price', commodity, r.ticker, r.price, r.ndf_estimated],
      staleTime: 1000 * 60 * 60,
      retry: false,
      queryFn: async () => {
        const data = await callApi<ConvertPriceResponse>('/utils/convert-price', {
          value: r.price,
          from_unit: 'usd_per_bushel',
          to_unit: 'brl_per_sack',
          commodity,
          exchange_rate: r.ndf_estimated,
        });
        return data;
      },
    })),
  });

  const map = new Map<string, number>();
  convertible.forEach((r, i) => {
    const value = results[i]?.data?.value_converted;
    if (typeof value === 'number') map.set(r.ticker, value);
  });
  return map;
}
