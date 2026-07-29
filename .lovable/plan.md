## Situação atual (verificada no código)

Em `src/pages/PricingTable.tsx` a linha de Recepção **já existe** nas duas superfícies:

- Tooltip de resumo (linha 416): `{costs.reception_brl != null && <p>Recepção: R$ …</p>}`
- Diálogo de detalhamento completo (linha 513): `<DetailRow label="Recepção" …>` com a mesma guarda

A guarda `!= null` já atende as decisões 3 e 4: campo ausente → linha não renderiza; campo presente com valor 0 → linha aparece como R$ 0,00. Não há cálculo no frontend: `total_brl` vem da API e é exibido cru.

## O que falta

Apenas apresentação: hoje "Recepção" aparece **depois** de Mesa, e a especificação pede a linha ao lado de Armazenagem.

### Mudança única

`src/pages/PricingTable.tsx` — mover a linha de Recepção para logo após Armazenagem nas duas superfícies, ficando a ordem:

```text
Financeiro
Armazenagem
Recepção
Corretagem
Mesa
Total
```

Nenhuma outra alteração: sem tocar em Edge Functions, schema, `ExportPricingModal`, geração de tabela ou outras telas.

## Observação (fora de escopo, só registro)

`src/pages/OperacoesD24.tsx` tem um breakdown de custos próprio (Financeiro/Armazenagem/Corretagem, ~linha 2489) sem a linha de Recepção. Essa tela está suspensa da navegação desde o refactor Wave 1, e o escopo negativo proíbe mexer nela — não será alterada.

## Validação manual (Eduardo)

1. Gerar tabela nova, abrir detalhamento: "Recepção" aparece com R$ 0,00, logo abaixo de Armazenagem.
2. Somar as linhas exibidas e conferir contra o Total — tem que fechar.
3. Abrir snapshot antigo: linha "Recepção" não aparece e a armazenagem segue igual.
4. Conferir que o preço de originação está idêntico ao anterior.
