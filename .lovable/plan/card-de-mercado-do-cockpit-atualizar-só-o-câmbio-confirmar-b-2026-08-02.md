# Card de Mercado do cockpit: atualizar só o câmbio + confirmar B3

Dois botões que hoje só existem na aba Mercado passam a existir dentro do card de Mercado do cockpit.

## 1. Terceira opção no menu "Atualizar cotações"

Nova entrada: **"Atualizar só o câmbio"**.

- Busca as cotações e grava apenas o dólar (`persistFX`), sem tocar em soja, milho CBOT ou milho B3.
- Marca o ticker `USD/BRL` como alterado (âmbar) e trava o Publicar até recalcular, igual às duas opções existentes.
- Usa as funções já existentes em `src/lib/marketWrites.ts` — mesma sequência que a aba Mercado usa no botão de câmbio.

## 2. Botão "Confirmar atualização" no Milho B3

- Aparece no cabeçalho da seção Milho B3 do card, só quando há tickers visíveis.
- Renova o carimbo `updated_at` dos tickers B3 visíveis, sem alterar nenhum preço.
- Atualiza o "Xh · fonte" na hora e marca esses tickers como alterados, travando o Publicar até recalcular.
- Estado "Confirmando..." enquanto roda.

## Onde a lógica mora

Hoje o "Confirmar atualização" está escrito dentro do componente da aba Mercado. Ele vai para `src/lib/marketWrites.ts` como uma função (`confirmB3Update`), recebendo a lista de tickers e devolvendo o carimbo aplicado. A aba Mercado é tocada apenas para passar a chamar essa função — comportamento idêntico ao de hoje.

## Detalhes técnicos

- `src/lib/marketWrites.ts`: nova função `confirmB3Update(tickers: string[]): Promise<string>` que dá `update({ updated_at })` em `market_data` para cada ticker e devolve o ISO usado. Erros continuam propagando para o chamador exibir o toast.
- `src/pages/market/MarketBolsa.tsx`: `handleConfirmB3Update` passa a chamar `confirmB3Update`; mantém `confirmingB3`, o `setB3Prices` local e os toasts.
- `src/components/cockpit/cards/MarketCard.tsx`:
  - `handleFetchFxOnly`: `fetchQuotes` → `persistFX` → `markTouched(['USD/BRL'])` → toast.
  - Novo item no `DropdownMenuContent`: "Atualizar só o câmbio".
  - Botão "Confirmar atualização" na `action` da `Section` "Milho B3 (manual)", chamando `confirmB3Update(visibleB3.map(t => t.ticker))`, atualizando `b3Prices` e chamando `markTouched` com esses tickers.

## Fora de escopo

Aba Mercado (exceto a troca de import), card de parâmetros, card da tabela de preços, mecânica de recalcular/publicar e layout salvo permanecem intactos.
