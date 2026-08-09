# Grão já entregue + ativar/desativar combinação no cockpit

## 3. Resposta à pergunta (nada muda)

O frontend **não** lê a view `pricing_snapshots_clean`. A única menção está em
`src/integrations/supabase/types.ts` (arquivo gerado automaticamente pelo Supabase, linhas 581 e 1418),
que apenas descreve o schema. Nenhum hook, página ou componente consulta essa view.

## 1. Chave "Grão já entregue" na combinação

A coluna `pricing_combinations.grain_already_delivered` (booleano, padrão falso) **já existe no banco** — nenhuma migração será criada.

Formulário da combinação (`src/pages/Settings.tsx`, seção DATAS):
- Toggle "Grão já entregue", mesmo padrão visual do "Pagamento à vista".
- Ligado: o campo "Recepção de grão" some da tela e a data cadastrada é limpa (`null`).

Payload — os **dois** produtores mudam com a mesma regra:
- `src/components/GeneratePricingModal.tsx`: quando ligado, `grain_reception_date = trade_date` da geração.
- `src/lib/cockpitPayload.ts` (`buildCockpitPayload`): idem, usando o `trade_date` do cockpit
  (`getTradeDateBRT()`), passado como argumento para a função. Quando desligado, a lógica atual
  (data própria, senão data de pagamento) permanece intacta.
- A validação "sem data de recepção" deixa de barrar linhas com a chave ligada.

Contrato da API inalterado: continua recebendo `grain_reception_date` normalmente.

## 2. Desativar / reativar combinação pelo cockpit

Forma escolhida: dentro do card **Parâmetros das combinações**.
- Cada linha ganha um botão de desativar (ícone), que escreve `active = false`.
- No topo do card, um trecho colapsável "Inativas (N)" — fechado por padrão, um clique para abrir.
  Lista as combinações inativas em tabela enxuta (praça, commodity, ticker, método) com botão "Reativar".
- Ativas continuam sendo a visão padrão; inativas não aparecem na tabela principal nem na geração de preços.

Técnico: o cockpit passa a buscar todas as combinações (`usePricingCombinations()` sem filtro) e separa
ativas/inativas em memória; a tabela de preços e o payload seguem usando só as ativas. A escrita usa o
hook existente `useTogglePricingCombinationActive`, a mesma coluna `active` de Configurações — o log de
atividade e a invalidação de cache já vêm de graça.

## Ordem de execução

1. Migração da coluna `grain_already_delivered`.
2. Tipo `PricingCombination` em `src/types/index.ts`.
3. Formulário em `Settings.tsx`.
4. Payload nos dois produtores.
5. Ativar/reativar no cockpit.

## Correção pendente (fora do escopo pedido)

`src/types/index.ts` ainda declara `sigma` em `PricingParameter`, campo que não existe mais na tabela —
isso quebra o typecheck em `src/hooks/usePricingParameters.ts:15`. Removo essa propriedade junto.
