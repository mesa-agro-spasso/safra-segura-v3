# Reorganizar a aba Mercado em sub-abas

Separar a aba Mercado por natureza do dado: **Físico · Futuros · Dólar**, com estrutura pronta para receber **Opções** depois, sem refatoração.

## O que muda

**Estrutura de abas**
- A lista de sub-abas passa a vir de um array de configuração (`{ id, label, element, enabled }`) em `src/pages/Market.tsx`, no lugar dos ternários atuais. Adicionar "Opções" no futuro = uma entrada no array.
- Ordem: Físico, Futuros, Dólar. A sub-aba continua controlada pelo parâmetro `?tab=` da URL, como hoje.
- `Histórico` continua como está (segue atrás dos mesmos feature flags).

**Físico**
- Continua sendo exatamente a tela atual (`MarketFisico`). Só muda o rótulo/posição. Zero mudança de comportamento.

**Futuros**
- Recebe o conteúdo atual da aba "Bolsa" **menos o card do dólar**: Soja CBOT, Milho CBOT e Milho B3, com os mesmos botões de atualizar por tabela, as mesmas colunas, os mesmos valores e a mesma edição manual.
- O botão "Atualizar Mercados" (que hoje já preserva o câmbio) fica em Futuros.
- O botão "Atualizar Tudo" também fica em Futuros, com o mesmo comportamento de hoje (atualiza câmbio + mercados). Nada é reescrito: as mesmas funções de `src/lib/marketWrites.ts` continuam sendo chamadas.

**Dólar**
- Recebe o card USD/BRL: valor, origem (`source`), edição manual e o botão de atualizar só o câmbio — exatamente as funções de hoje, apenas em outro lugar.

## Badge de frescor do dólar

Na aba Dólar, ao lado da cotação, um badge que diz **quando a cotação foi observada**, legível de relance:
- Texto relativo com granularidade útil: "agora", "há 2 min", "há 40 min", "há 2 h", "há 1 d" — a leitura atual em horas inteiras mostra "0h" tanto para 2 minutos quanto para 50.
- Data e hora completas no `title` (tooltip) e a origem (`source`) ao lado.
- Cor por faixa, usando tokens semânticos existentes: neutro quando recente, `--warning` quando velho (mantendo o limite de 24 h que a tela já usa hoje).

**É aviso, não trava.** Nenhum botão é desabilitado, nenhuma geração de preço é bloqueada por dólar velho. Se um dia virar regra, ela nasce no backend.

## Fora de escopo

- Nenhuma mudança em como o dólar é buscado, persistido ou convertido.
- Nenhum cálculo novo, nenhuma conversão nova, nenhuma chamada de API nova.
- Nenhuma alteração de colunas, valores ou comportamento em Físico e Futuros.
- Aba Opções não é criada agora.

## Detalhe técnico

- `src/pages/market/MarketBolsa.tsx` é dividido em dois componentes de página: `MarketFuturos.tsx` (tabelas CBOT/B3) e `MarketDolar.tsx` (card FX). A lógica compartilhada de fetch/persistência continua em `src/lib/marketWrites.ts`; cada página usa só as funções de que precisa. `MarketBolsa.tsx` deixa de existir (ou vira reexport de Futuros para não quebrar imports).
- O helper de frescor (formatação relativa) entra em `src/hooks/useMarketData.ts`, ao lado de `getHoursAgo`, que continua existindo para as demais telas.
- Rotas antigas com `?tab=bolsa` caem no mapeamento para `futuros`, para não quebrar links salvos.
