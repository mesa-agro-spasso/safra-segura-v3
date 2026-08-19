# Preço físico: escrita pelo backend, entrada numérica robusta e alertas em Pendências

## 1. api-proxy (supabase/functions/api-proxy/index.ts)

- Acrescentar `/basis/physical-prices` à lista de POST permitidos.
- Passar a encaminhar o método `DELETE`, permitindo caminhos que começam com `/basis/physical-prices/` (id dinâmico, prefix match). Query string já é encaminhada — usada para `deleted_by`.
- Manter o status HTTP da API no retorno (já é o comportamento atual), para que 422 e 503 cheguem ao frontend.

## 2. Erros do servidor legíveis no frontend

`src/lib/api.ts` hoje transforma qualquer falha numa `Error` genérica e perde o status. Vai passar a lançar um erro tipado com `status` e a mensagem em português vinda da API (lida do corpo da resposta da Edge Function). Sem isso não dá para distinguir 422 de 503.

## 3. Reroteamento das escritas (src/hooks/usePhysicalPrices.ts)

- `useCreateQuote` e `useRepeatYesterday` → `POST /basis/physical-prices` via `callApi`, com os campos atuais mais `updated_by` (id do usuário autenticado). `created_by` não é enviado. Re-registro da mesma chave passa a atualizar.
- `useDeleteQuote` → `DELETE /basis/physical-prices/{id}?deleted_by=<user id>`.
- `triggerNormalize` continua sendo disparado após criar/repetir; não é disparado após excluir.
- Nenhum `insert`/`upsert`/`delete` direto em `physical_prices` permanece em `src/`.

## 4. Linhas excluídas ficam invisíveis

Todas as leituras diretas de `physical_prices` ganham `.is('deleted_at', null)`: `useQuotes`, `useQuoteCounts`, `useYesterdayWinner` e o leitor em `src/pages/market/historico/HistoricoFisico.tsx`. Leituras seguem diretas no Supabase.

## 5. Componente de entrada numérica reutilizável

Novo `src/components/ui/numeric-input.tsx` com precisão fixa por campo (2 ou 4 casas):

- Aceita dígitos, `.`, `,` e `-` inicial.
- O último separador é o decimal; os anteriores são milhar e são descartados (`11.111,11` → `11111.11`).
- Menos casas que a precisão → completa com zeros à direita.
- Mais casas que a precisão → erro inline, sem arredondar.
- Sem separador: campos de 2 casas leem os dois últimos dígitos como centavos (`11111` → `111,11`); campos de 4 casas leem como inteiro (`78` → `78,0000`).
- Exibição sempre pt-BR com precisão fixa.
- Expõe estado de validade; enquanto houver campo inválido, o botão de envio/publicação do formulário fica desabilitado.

Aplicado a todos os campos numéricos editáveis dos cards do Cockpit (`MarketCard`, `ParametersCard`, `PhysicalPricesCard`) e ao diálogo de cotação física. Os payloads continuam levando números simples; nenhuma conta muda de lugar.

## 6. Diálogo de cotação física (PhysicalQuoteDialog)

- Preço passa a usar o componente numérico (2 casas).
- Datas apenas pelo calendário: digitação livre desabilitada; atalhos +3d/+30d mantidos.
- Campos obrigatórios bloqueiam o envio com mensagens inline em português.
- Erro 422 do servidor aparece inline ao lado do campo de preço, com o texto exato da API; erro 503 aparece como mensagem de erro do formulário. Em ambos os casos o que foi digitado permanece.

## 7. Rótulos de commodity na tela de combinações

Helper de exibição (`commodityLabel`) mapeando `corn` → "Milho" e `soybean` → "Soja", usado na tabela e no formulário de combinações em Configurações. Valores gravados e payloads continuam em inglês.

## 8. Pendências: alertas de alteração de preço físico

- Novo hook lendo `physical_price_change_alerts` com `acknowledged_at IS NULL`, mais recentes primeiro, resolvendo `changed_by` para o nome em `public.users` (fallback: o id).
- Nova seção "Alterações de preço físico" em `/pendencias`, mostrando tipo em português (Edição / Exclusão / Reativação), quando, quem e os valores relevantes de `changes`: antes → depois dos campos que diferem (edit/revive) ou os dados-chave da cotação excluída (praça, commodity, data, comprador, preço).
- Botão "Ciente" por item grava `acknowledged_by` e `acknowledged_at` e remove o item da lista.
- `usePendenciasCounts` passa a somar esses alertas ao badge da barra lateral.

## Fora de escopo

Fluxo de publicação do Cockpit, formatos de payload de precificação, `GeneratePricingModal`, `cockpitPayload.ts` e qualquer cálculo.
