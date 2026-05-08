## Objetivo

Adicionar na aba MTM um atalho de "Preço Físico por Praça/Commodity" que preenche todos os inputs individuais das operações daquele grupo de uma só vez. Comportamento puramente de UI — o valor continua sendo salvo por operação, e cada linha permanece editável individualmente.

## Mudança em `src/pages/MTM.tsx`

### 1. Novo card acima da tabela "Operações Ativas"

```
┌─ Preço Físico por Praça (atalho) ────────────────────┐
│ Praça      Commodity   Preço (R$/sc)   Aplicar       │
│ Sorriso    Soja        [ 145.00 ]      [Aplicar]     │
│ Sorriso    Milho       [  62.50 ]      [Aplicar]     │
│ Lucas      Soja        [ 144.20 ]      [Aplicar]     │
└──────────────────────────────────────────────────────┘
```

- Lista derivada de `orders`, agrupada por `warehouse_display_name + commodity` (uma linha por combinação única).
- Estado local `groupPrices: Record<string, string>` (chave `${warehouse}__${commodity}`), persistido em `sessionStorage` como `mtm_group_prices`.
- Botão **Aplicar**: copia o valor digitado para `physicalPrices[operation_id]` de todas as operações daquele grupo (sobrescreve o que estiver lá), e persiste em `sessionStorage` como já é feito hoje.

### 2. Tabela "Operações Ativas"

Sem mudanças de comportamento — o input por linha continua editável e o valor segue salvo por `operation_id` em `physicalPrices`. Edições manuais após o "Aplicar" simplesmente sobrescrevem o valor da linha.

## Detalhes técnicos

- Tudo isolado em `src/pages/MTM.tsx`, sem mudanças de schema, hooks ou backend.
- Sem lógica de override/tracking — atalho é puro "preencher de uma vez".
- Reaproveita o padrão existente de persistência em `sessionStorage`.