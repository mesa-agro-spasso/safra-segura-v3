# Datas editáveis no card de parâmetros

Hoje o card de parâmetros só edita custos. As datas ficam fixas no cadastro da combinação. Passam a ser ajustáveis na linha, com o mesmo tratamento visual e o mesmo ciclo recalcular → publicar dos demais campos.

## O que muda

Quatro colunas novas por linha, depois de "Basis alvo":

- À vista (is_spot) — interruptor
- Pagamento — data
- Recepção do grão — data
- Venda — data

Regras:

- Com "À vista" ligado, o campo de pagamento fica desabilitado (a API resolve a data).
- Valor sempre visível: se a linha não tem data própria, mostra o que já é usado hoje na chamada.
- Campo editado e ainda não recalculado: borda âmbar; depois do recálculo, borda primária — igual aos custos.
- O cabeçalho do grupo da praça continua sinalizando "edições não recalculadas".
- Editar uma data trava o Publicar até recalcular.
- Vencimento do contrato (exp_date) segue somente leitura.

Sem validação de data no frontend. Data impossível vai para a API; a linha volta na lista de descartadas com o motivo, que o cockpit já exibe abaixo do recálculo, e as demais linhas calculam normalmente.

## Detalhes técnicos

`src/lib/cockpitPayload.ts`

- `CockpitOverrides` ganha `payment_date`, `grain_reception_date`, `sale_date` (string | null) e `is_spot` (boolean).
- `EDITABLE_FIELDS` ganha os quatro campos, para que o Publicar grave-os na combinação junto com os custos (mesma escrita, mesmos campos a mais).
- `buildCockpitPayload`: `is_spot`, `payment_date`, `grain_reception_date` e `sale_date` passam a ser lidos via `effectiveValue` em vez de direto do `combo`. Continuam no nível de cima da combinação; com `is_spot` verdadeiro, `payment_date` não é enviado. Nada de aritmética.
- O guarda atual "Sem data de pagamento cadastrada" continua valendo apenas quando não é à vista e não há data nem no override nem no cadastro.

`src/components/cockpit/cards/ParametersCard.tsx`

- Célula de data reutilizando `DateInput` (digitação + calendário), em largura compacta; célula de switch para `is_spot`.
- `COLUMN_COUNT` passa de 13 para 17; colunas congeladas (praça, commodity) e rolagem do card inalteradas.
- `onChange` existente é reaproveitado, aceitando também `boolean`.

Nada muda na mecânica de recalcular/publicar, no layout salvo, no agrupamento por praça, nem fora da pasta do cockpit (além do `cockpitPayload.ts`, que é o payload do próprio cockpit).
