# Cinco correções no fluxo de preço físico

## 1. Entrada numérica formatando ao digitar

`src/lib/numericInput.ts` + `src/components/ui/numeric-input.tsx`: o campo passa a formatar em tempo real, estilo app de banco. Enquanto o usuário digita apenas dígitos, os algarismos entram pelos centavos: 4 → "0,04", 45 → "0,45", 456 → "4,56", 4567 → "45,67", com separador de milhar surgindo naturalmente ("1.234,56"). Backspace remove o último dígito.

- Nova função `formatDigitsLive(digits, precision)` em `numericInput.ts` (só formatação, nenhum cálculo).
- No `NumericInput`, quando o texto digitado contém somente dígitos, o modo "ao vivo" formata e emite o número correspondente a cada tecla.
- Se o usuário digitar "." ou "," (ou colar um texto), o componente cai no comportamento atual de `sanitizeNumericText` + `parseNumericInput`, inclusive na regra de colagem ("78,43" continua sendo lido como 78,43).
- O blur segue normalizando para a precisão fixa; o valor emitido continua sendo um número simples idêntico ao exibido.
- Precisão 4 (câmbio) segue a mesma regra ao vivo, com 4 casas.

## 2. Detalhes da cotação visíveis no Painel

`src/pages/market/MarketFisico.tsx` — visão **Painel**: cada linha praça × commodity ganha um botão de expandir. Ao abrir, uma sub-linha lista as cotações da data de referência daquela linha, com: comprador, data de pagamento, preço nominal (R$/sc), valor presente (ou selo "calculando"), incoterm, notas e quem registrou.

- Novo hook `useQuotesForDay(locationId, commodity, referenceDate)` em `usePhysicalPrices.ts` (leitura de `physical_prices` com `deleted_at is null`).
- Nomes de quem registrou: resolvidos por um hook leve que lê `id, full_name` de `users` para os `created_by` presentes (sem nome → e-mail/identificador curto ou "—").
- A tabela "Todas as cotações" (Por praça) passa a exibir também incoterm, notas e quem registrou, para ficar consistente.

## 3. Excluir cotação

O botão de exclusão já existe em "Todas as cotações" e usa `useDeleteQuote` com confirmação. Estender:

- Mesmo botão (com o diálogo "Excluir esta cotação?") em cada cotação da linha expandida do Painel e no diálogo de detalhes do histórico.
- Após sucesso, as listas são atualizadas pela invalidação de `['physical_prices']` já existente no hook.

## 4. Atalhos de data de pagamento

`src/components/market/PhysicalQuoteDialog.tsx`: **+3d** = 3 dias corridos e, se cair em sábado ou domingo, avança para a segunda-feira seguinte. **+30d** continua exatamente 30 dias corridos, sem ajuste. A regra de fim de semana entra como helper em `usePhysicalPrices.ts` (`addBusinessSafeDays`), sem tocar na validação `pagamento >= referência`.

## 5. Remover "Repetir ontem"

- Remover o componente `RepeatYesterdayButton` e seus dois usos (Painel e Por praça) em `MarketFisico.tsx`.
- Remover `useRepeatYesterday` e `useYesterdayWinner` de `usePhysicalPrices.ts` (sem outros consumidores).
- Endpoint do backend permanece intocado.

## Histórico

Em `src/pages/market/historico/HistoricoFisico.tsx`, cada linha do histórico canônico passa a abrir um diálogo com as cotações daquele dia/praça/commodity, exibindo os mesmos campos do item 2 e com a ação de excluir.

## Fora de escopo

`api-proxy`, tratamento de erro em `api.ts`, fluxo de criação, Pendências, Cockpit, qualquer cálculo ou formato de payload.
