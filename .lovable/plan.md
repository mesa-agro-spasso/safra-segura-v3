## Objetivo

No modal "Ajustar Volumes e Preços" (execução de Block Trade em Armazéns), os campos **Preço — Futures (USD/bushel)** e **Preço — NDF (R$/USD)** hoje começam vazios. Vamos pré-preenchê-los automaticamente com a cotação mais recente disponível em `market_data`, mantendo a possibilidade de o usuário sobrescrever antes de confirmar.

## Como funciona a fonte de dados

A tabela `market_data` (já carregada via `useMarketData()`) guarda, por `ticker`, o preço atual e os campos de NDF:
- `price` → cotação Futures (USD/bushel para soja, etc.)
- `ndf_override ?? ndf_estimated ?? ndf_spot` → cotação NDF associada àquele vencimento

Cada ordem aberta do batch (`d24Orders`) já carrega o seu `ticker` e o seu `instrument_type` (`futures`, `ndf`, `option`). Isso é tudo que precisamos para casar com `market_data`.

## Mudanças

Arquivo: `src/pages/ArmazensD24.tsx` (componente `BlockTradeExecutionModal`)

1. **Importar `useMarketData`** e consultar a tabela dentro do modal.
2. **Calcular os tickers do batch por instrumento** a partir de `openOrdersByOpId` (o ticker da primeira ordem aberta de cada `instrument_type` é representativo, já que um batch é homogêneo por instrumento/vencimento).
3. **Pré-preencher `prices`** quando o modal abrir (ou quando `proposals`, `openOrdersByOpId` e `market_data` estiverem disponíveis):
   - Para `futures`: `market_data.find(m => m.ticker === tickerFutures)?.price`
   - Para `ndf`: do mesmo registro de market_data, usar `ndf_override ?? ndf_estimated ?? ndf_spot`
   - Para `option`: deixar vazio (não há fonte de prêmio em `market_data`).
4. **Não sobrescrever edição manual**: o `useEffect` de pré-preenchimento só roda quando o modal abre e quando o slot daquele instrumento ainda está vazio (`prices[i] === '' || prices[i] == null`).
5. **Indicação visual leve** abaixo do input quando o valor veio do mercado: pequeno texto `Sugerido: {valor} ({ticker})` em `text-xs text-muted-foreground`, para o usuário saber que pode ajustar.

## Comportamento resultante

- Ao abrir o modal, os campos de Futures e NDF já aparecem preenchidos com a última cotação salva em `market_data` para o ticker do batch.
- Usuário pode editar livremente; o botão "Revisar →" continua exigindo valor > 0.
- Caso não haja market_data para o ticker (ex.: ticker não cadastrado), o campo permanece vazio como hoje.

## Fora de escopo

- Buscar cotação em tempo real da API (usamos o que já está em `market_data`, que é atualizado pela tela de Mercado).
- Pré-preencher prêmio de opções.
- Alterar a lógica de execução/inserção de orders.
