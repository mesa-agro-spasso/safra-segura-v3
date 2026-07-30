## 1. Allowlist do api-proxy (fonte da verdade volta ao repositório)

`supabase/functions/api-proxy/index.ts` — substituir apenas as duas listas pelas fornecidas. Nada mais no arquivo muda: verificação, timeout de 120s, headers `X-API-Key`, tratamento de abort/erro ficam idênticos.

Confirmado contra o Swagger de produção (`/openapi.json`), que hoje expõe: `/pricing/table`, `/pricing/insurance-layer`, `/market/quotes`, `/market/b3-corn-quotes`, `/market/fx-parameters`, `/utils/sacks-to-contracts`, `/utils/convert-price`, `/health`. `/pricing/option-premium` de fato não existe mais.

Observação de comportamento, não uma mudança: POST usa `includes()` (match exato), então `'/closing/'` só libera o path literal `/closing/`. GET usa `startsWith()`, então prefixos funcionam. Mantenho a lógica como está, conforme instruído.

Depois da edição, deploy do `api-proxy`.

## 2. Warm-up

`src/lib/warmup.ts` — trocar a chamada por `callApi('/health', undefined, { method: 'GET' })`, sem `query`, e remover o comentário NOTA sobre a allowlist. Continua silencioso, uma vez por sessão, erro engolido.

## 3. `/utils/convert-price` NÃO aceita lista

Contrato do Swagger:

```text
POST /utils/convert-price
{ value: number, from_unit, to_unit, commodity, exchange_rate: number }
→ { value_converted, from_unit, to_unit, commodity, exchange_rate_used }
```

`value` é escalar e não há endpoint de lote. Reportado conforme instruído: **fica uma chamada por linha**.

Quantas chamadas a tela passa a fazer: uma por linha CBOT **que tenha `ndf_estimated` e `price`**, ou seja no máximo 8 de soja + 8 de milho CBOT = **16 por carregamento**, com cache do React Query por `ticker + price + ndf_estimated` — remontar a aba sem mudança de dado não refaz as chamadas; um novo fetch de mercado refaz só as linhas cujo preço ou NDF mudou.

## 4. Coluna "Preço (R$/sc)" na tela de Mercado

Novo hook `src/hooks/useConvertedPrices.ts`:
- Recebe a lista de linhas (`ticker`, `price`, `ndf_estimated`, commodity da API: `soybean` | `corn`).
- Um `useQueries` do React Query, uma query por linha com NDF presente, chamando `callApi('/utils/convert-price', { value: price, from_unit: 'usd_per_bushel', to_unit: 'brl_per_sack', commodity, exchange_rate: ndf_estimated })`.
- `staleTime` alto; linhas sem `ndf_estimated` ou sem `price` não geram query.
- Devolve `Map<ticker, number | null>`.

`src/pages/market/MarketBolsa.tsx`:
- Coluna nova logo após "Preço (USD/bu)", nas tabelas de **Soja CBOT** e **Milho CBOT**: cabeçalho `Preço (R$/sc)`, alinhado à direita.
- Célula: `value_converted` formatado em pt-BR com 2 casas; `—` quando não há NDF estimado, enquanto carrega ou se a chamada falhar. Nunca usa o spot como substituto.
- **Milho B3**: nenhuma alteração — preço já é BRL/saca.

Zero aritmética: nenhuma multiplicação, nenhum fator bushel/saca em TypeScript. Só `toLocaleString` do número devolvido pela API.

## Escopo negativo respeitado
Sem schema, sem tabela de preços, sem `/pricing/table`, sem formulários de combinação/armazém, sem tocar em NDF estimado ou spread.

## Validação manual (Eduardo)
1. Aplicar seguro manual numa linha da tabela de preços — prova que a allowlist não regrediu.
2. Gerar tabela de preços normalmente.
3. Tela de Mercado: coluna R$/sc em Soja CBOT e Milho CBOT; Milho B3 inalterado; linha sem NDF mostra traço.
4. Login com servidor dormindo: sem erro no console (warm-up via `/health`).
5. O valor em R$/sc diverge do câmbio da tabela de preços — esperado, são prazos diferentes.
