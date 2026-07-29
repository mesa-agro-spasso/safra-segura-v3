## Escopo

Arquivo único: `src/pages/Settings.tsx`, componente `CombinationsTab`. Nada mais é tocado.

## Parte 1 — Duplicar

Novo botão (ícone `Copy`) em cada linha da tabela, entre editar e excluir.

Ao clicar:

```
const { id, created_at, updated_at, ...rest } = c;
setEditing({ ...rest });   // sem id → upsert insere linha nova
setOpen(true); setCostsOpen(false); setCalcResult(null);
```

- Abre o mesmo diálogo de criação pré-preenchido (título "Nova Combinação", pois `editing.id` é `undefined`). Não grava nada até a operadora clicar em Salvar.
- Copia todos os demais campos, inclusive as quatro datas, `is_spot`, `active`, método e custos.
- Campos de custo `null` continuam `null` — o spread copia o valor cru da linha; o valor herdado do armazém aparece apenas como texto cinza no input (comportamento atual de `numField`, que só lê `editing[key]` para decidir se é override). Trocar o armazém recalcula a herança exibida automaticamente, porque `inheritedValueFor` deriva de `selectedWarehouse`.
- Salvamento passa pelo `handleSave` existente sem alteração: ele já normaliza método (`target_basis`/`origination_price_net_brl` mutuamente exclusivos, `additional_discount_brl = 0` em TARGET_PRICE) e valida obrigatórios.

Nenhuma mudança em `usePricingCombinations` / `useUpsertPricingCombination`: o upsert com `onConflict: 'id'` e sem `id` no payload gera um insert com id novo pelo default da tabela.

## Parte 2 — Reorganizar o formulário

Reordenar o JSX do diálogo em quatro blocos, cada um com um título curto (`text-xs uppercase text-muted-foreground`) e separador:

1. **Identidade** — Armazém, Commodity, Benchmark, Ticker, Exp Date
2. **Método** — seletor LONG_BASIS/TARGET_PRICE; se LONG_BASIS: Target Basis + Desconto adicional; se TARGET_PRICE: Preço de Originação Net + o painel de pré-cálculo existente (mantido como está)
3. **Datas** — switch Spot, Data de pagamento (oculta quando spot), Data de venda, Recepção de grão
4. **Custos** — `Collapsible` atual, **fechado por padrão** (já é o comportamento: `setCostsOpen(false)` ao abrir), com os sete campos e a herança visível

O switch "Ativa" e o botão Salvar ficam no rodapé, fora dos blocos.

Nenhum rótulo, validação, handler ou regra de campo muda — apenas ordem, agrupamento e títulos. `handleCalculate`, `handleSave`, `numField`, `inheritedValueFor` permanecem intactos.

## Regras respeitadas

- Zero cálculo financeiro no frontend (o pré-cálculo continua chamando `/pricing/table`).
- Nenhum valor inventado para campos restritos; listas de opções inalteradas.
- Sem mudança de schema, Edge Function, tabela de preços ou formulário de armazéns.

## Validação manual (Eduardo)

1. Duplicar uma LONG_BASIS com custos herdados → formulário abre preenchido, custos em cinza, nada virou valor fixo.
2. Trocar só o armazém e salvar → linha nova, original intacta.
3. Gerar a tabela → nova combinação com preço coerente com a praça.
4. Duplicar uma TARGET_PRICE e salvar sem mexer → salva sem erro.
5. Duplicar LONG_BASIS, trocar para TARGET_PRICE, preencher o preço net, salvar → salva e `target_basis` fica nulo.
