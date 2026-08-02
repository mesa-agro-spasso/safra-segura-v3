import { useQuery } from '@tanstack/react-query';
import { callApi } from '@/lib/api';

/**
 * Conversão de preço USD/bushel → BRL/saca via API (POST /utils/convert-prices).
 *
 * REGRA DA CASA (P07): ZERO aritmética financeira ou de unidade no frontend.
 * Nenhum fator bushel/saca aparece aqui — a API devolve o número pronto.
 *
 * O câmbio usado é o `ndf_estimated` DA LINHA (dólar do vencimento daquele
 * contrato). Nunca o spot: são números diferentes e substituir um pelo outro
 * em silêncio esconderia a ausência do dado. Linha sem NDF → fora do lote.
 *
 * O endpoint aceita lote: uma única requisição com `items`, e `results` volta
 * NA MESMA ORDEM dos itens enviados. Não há campo de identificação — a junção
 * ticker → valor é POSICIONAL, nunca por busca de conteúdo. Um item inválido
 * derruba a lista inteira com 422 (sem resultado parcial), o que é deliberado:
 * um buraco no meio de uma lista posicional desalinharia tudo em silêncio.
 *
 * O cache é do conjunto: a chave carrega uma assinatura estável das linhas
 * convertíveis, então nada é refeito enquanto o conjunto não mudar.
 */
export interface ConvertibleRow {
  ticker: string;
  price: number | null;
  ndf_estimated: number | null;
}

interface ConvertPriceResult {
  value_converted: number;
  exchange_rate_used: number;
}

interface ConvertPricesResponse {
  results: ConvertPriceResult[];
}

export function useConvertedPrices(
  rows: ConvertibleRow[],
  commodity: 'soybean' | 'corn',
): Map<string, number> {
  const convertible = rows.filter(
    (r) => r.price != null && r.ndf_estimated != null,
  );

  const signature = convertible
    .map((r) => `${r.ticker}:${r.price}:${r.ndf_estimated}`)
    .join('|');

  const { data } = useQuery({
    queryKey: ['convert_prices', commodity, signature],
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      const items = convertible.map((r) => ({
        value: r.price,
        from_unit: 'usd_per_bushel',
        to_unit: 'brl_per_sack',
        commodity,
        exchange_rate: r.ndf_estimated,
      }));
      return await callApi<ConvertPricesResponse>('/utils/convert-prices', {
        items,
      });
    },
  });

  const map = new Map<string, number>();
  const results = data?.results ?? [];
  convertible.forEach((r, i) => {
    const value = results[i]?.value_converted;
    if (typeof value === 'number') map.set(r.ticker, value);
  });
  return map;
}
