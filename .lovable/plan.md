## Estado atual (verificado)

- `getNextTuesday` existe apenas em `src/components/GeneratePricingModal.tsx` (linha 17). É usada em dois pontos: pagamento spot (linha 187) e o "empurrão" de `payment_date` vencido (linha 204). Nenhum outro arquivo do projeto a consome — remoção é segura.
- O payload de `POST /pricing/table` hoje **não** envia `is_spot` nem `trade_date`; `payment_date` é sempre calculado/normalizado no frontend.
- `trade_date` do snapshot vem de `r.trade_date_used` com fallback para `new Date()` (relógio do navegador).

## O que muda — apenas `src/components/GeneratePricingModal.tsx`

**1. Data de negócio de Brasília**
- Novo helper local `getTradeDateBRT()`: formata `new Date()` em `America/Sao_Paulo` via `Intl.DateTimeFormat` (`en-CA` → `YYYY-MM-DD`). É formatação de fuso, não cálculo de regra de negócio.
- Calculado uma vez por geração e enviado como `trade_date` **global no topo da requisição**, junto de `combinations`.

**2. `is_spot` por linha**
- Cada item do payload passa a incluir `is_spot: combo.is_spot ?? false`, repassando a coluna sem transformação.

**3. `payment_date`**
- `is_spot=true`: campo **omitido** do payload. A API resolve.
- `is_spot=false`: `payment_date` continua obrigatório e vai exatamente como cadastrado; se ausente, mantém o `toast.warning` + pular a linha (comportamento atual).

**4. Remoção do `getNextTuesday`**
- Função apagada do arquivo, junto do bloco de "proteção" que empurrava `payment_date` vencido para a próxima terça.
- No lugar do bloco removido, um comentário: o tratamento de `payment_date` vencido é responsabilidade da API e está sendo implementado no backend.
- Import `format` de `date-fns` permanece (ainda usado em outros pontos).

**5. Snapshot**
- `trade_date` do snapshot: `r.trade_date_used ?? tradeDate` (o global de Brasília), eliminando o fallback pelo relógio do navegador.
- `payment_date` do snapshot: `r.payment_date ?? orig.payment_date` — para linha spot, `orig.payment_date` não existe mais, então o valor gravado e exibido é o que a API devolveu. Mesma coisa em `inputs_json`, que passa a refletir o payload realmente enviado.

## Regras respeitadas

- Zero cálculo de data de precificação no frontend: nenhuma terça é calculada, nem para enviar, nem para exibir, nem para comparar.
- `rounding_increment` não entra no payload.
- `is_spot` e `trade_date` entram na mesma entrega — nunca um sem o outro.

## Fora do escopo

Schema, Edge Function, formulários de combinações e armazéns, detalhamento de custos, painel de basis.

## Aviso de impacto no preço

Ao subir, combinação spot negociada numa **segunda-feira** passa a pagar oito dias depois em vez de um: soja +0,30 · milho CBOT +0,15 · milho B3 +0,20 R$/saca. Nos demais dias, nada muda. Não há combinação spot ativa hoje, então o efeito prático é zero até alguém cadastrar uma.

## Validação manual (Eduardo)

1. Gerar tabela sem nenhuma combinação spot: preços idênticos aos de antes.
2. Criar uma combinação spot e gerar num dia que não seja segunda: pagamento na próxima terça.
3. Gerar numa segunda (ou simular): pagamento na terça da semana seguinte, oito dias à frente.
4. Conferir no snapshot que `trade_date` é o hoje de Brasília (inclusive gerando depois das 21h).
5. Apagar a combinação spot de teste.

## Entrega

Arquivo alterado: `src/components/GeneratePricingModal.tsx` (único). Confirmação explícita de que `getNextTuesday` foi **removida do código**, não apenas desativada.