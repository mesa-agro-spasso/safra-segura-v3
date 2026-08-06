# Ajustes na aba Mercado

## 1. Card do dólar no topo de Futuros

Um card compacto acima das tabelas, com três coisas: a cotação USD/BRL, o badge de frescor (o mesmo da aba Dólar) e um botão "Atualizar câmbio".

Não é estado novo: o card lê a mesma linha `USD/BRL` de `market_data` pelo mesmo hook (`useMarketData`) e atualiza pela mesma função (`fetchQuotes` + `persistFX`). Atualizar num lugar reflete no outro assim que a query invalida.

Para não duplicar código, o bloco de cotação + badge + botão vira um componente compartilhado, usado pela aba Dólar e pela aba Futuros. A aba Dólar continua sendo a tela completa do dólar (com edição manual do valor); em Futuros o card entra na versão compacta, sem edição manual — quem quer corrigir à mão vai na aba Dólar.

O frescor continua sendo aviso: nada é bloqueado, nenhum botão desabilitado.

## 2. Rótulos dos dois botões do topo

Trocar por rótulos que digam o que acontece:

- "Atualizar Mercados" → **"Atualizar futuros"** (soja CBOT, milho CBOT, milho B3; mantém o câmbio atual, exatamente como hoje)
- "Atualizar Tudo" → **"Atualizar câmbio + futuros"** (botão primário, atalho da rotina da manhã)

O efeito do segundo fica visível porque o card do dólar reage: a cotação e o badge de frescor mudam na mesma tela.

Os textos de estado vazio que hoje dizem "Clique em 'Atualizar Tudo'" passam a citar o rótulo novo.

## 3. Botão de atualizar só o dólar

Vive dentro do card, chamando a mesma função que a aba Dólar já usa. Enquanto qualquer atualização estiver rodando, os botões mostram o spinner e ficam desabilitados como já acontece hoje.

## Fora de escopo

- Nenhuma mudança em como dólar e futuros são buscados ou persistidos.
- Nenhum cálculo novo, nenhuma conversão nova.
- Nenhuma trava por frescor.
- Colunas, valores e edição das tabelas de futuros ficam iguais.

## Detalhe técnico

- Novo `src/components/market/FxQuoteCard.tsx`: recebe a linha `USD/BRL`, renderiza valor, badge (`formatFreshness`) e botão de atualizar; aceita `compact` e um slot opcional para a edição manual usada na aba Dólar.
- `MarketDolar.tsx` passa a renderizar esse componente no lugar do bloco atual, mantendo a edição manual.
- `MarketFuturos.tsx` ganha o card no topo e um handler `handleFetchFX` idêntico ao da aba Dólar (`fetchQuotes` → `persistFX`), integrado ao mesmo `fetchingOp` que já controla os outros botões.
