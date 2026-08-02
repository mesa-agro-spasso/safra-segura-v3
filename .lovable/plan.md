# Conversão de preços em lote

## 1. Allowlist do api-proxy

`supabase/functions/api-proxy/index.ts`: acrescentar `/utils/convert-prices` (plural) ao array `ALLOWED_POST_ENDPOINTS`, logo abaixo de `/utils/convert-price`, que permanece na lista. Nenhuma outra entrada muda. A função é redeployada a partir do repositório.

Motivo: a verificação de POST usa `includes(endpoint)` (comparação exata), diferente do GET que usa `startsWith` — o singular não cobre o plural.

## 2. useConvertedPrices em lote

`src/hooks/useConvertedPrices.ts` passa de `useQueries` (N requisições) para um único `useQuery`.

- Filtro preservado: só entram linhas com `price` e `ndf_estimated` preenchidos.
- Monta `items` na ordem das linhas filtradas, com os mesmos cinco campos de hoje (`value`, `from_unit`, `to_unit`, `commodity`, `exchange_rate`).
- Uma chamada `callApi('/utils/convert-prices', { items })`.
- Junção por posição: `results[i]` pertence a `convertible[i].ticker`. Sem busca por conteúdo.
- Retorno continua `Map<string, number>`; consumidores inalterados.
- Zero aritmética no hook.

### Cache

A chave passa a ser do conjunto: uma assinatura estável derivada da lista filtrada (commodity + `ticker:price:ndf` de cada linha, concatenados na ordem). Mesmo conjunto → mesma chave → nenhuma requisição nova entre renders. `staleTime` de 1 hora e `retry: false` mantidos.

### Erro

422 derruba a lista inteira (comportamento deliberado do backend). O hook não trata parcialmente: sem dados, o Map sai vazio e a coluna mostra traço, como já ocorre hoje quando a chamada falha.

### Comentário do topo

O trecho que diz que o endpoint não aceita lista deixa de ser verdade — reescrito para descrever a chamada única e a junção posicional.

## Escopo negativo

Nenhuma outra allowlist, hook, tela, componente ou schema é tocado.

## Verificação

Typecheck e conferência na tela de Mercado: mesmos valores de antes, uma requisição por carregamento, linhas sem NDF com traço.
