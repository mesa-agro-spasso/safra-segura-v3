

# Corrigir bugs no modal de execução em Orders.tsx

## Escopo
Apenas `src/pages/Orders.tsx` — funções `openExecutionModal` e `handleExecutionConfirm` + 2 helpers no topo do arquivo. Nenhuma alteração em `autoPopulateLegs`, `handleBuildOrder`, `handleSaveOrder`, `handleManualSave`, drawer, schema do banco ou outros arquivos.

## Mudanças

### 1. Helpers no topo do arquivo (antes do componente `Orders`)
```ts
const CONTRACT_SIZE_BY_COMMODITY: Record<string, Record<string, number>> = {
  soybean: { cbot: 5000 },
  corn: { cbot: 5000, b3: 450 },
};

function getContractSize(commodity: string, exchange: string): number {
  const size = CONTRACT_SIZE_BY_COMMODITY[commodity]?.[exchange.toLowerCase()];
  if (!size) throw new Error(`Contract size unknown for ${commodity}/${exchange}`);
  return size;
}

function getExecutionPriceLabel(leg_type: string, commodity: string, exchange: string): string {
  if (leg_type === 'ndf') return 'BRL/USD';
  if (exchange.toLowerCase() === 'cbot') return 'USD/bushel';
  if (exchange.toLowerCase() === 'b3') return 'BRL/sc';
  return '';
}
```

### 2. `openExecutionModal` — pré-preenchimento por tipo de leg
Remover qualquer multiplicação `*100`. Filtrar legs `seguro` antes do map:
```ts
const orderLegs = ((order.legs as any[]) ?? []).filter(l => l.leg_type !== 'seguro');
```

Para cada leg em `orderLegs`:
- `futures` / `option`:
  - `_displayQty = String(leg.contracts ?? '')`, label "Contratos"
  - `_displayPrice = String(leg.price ?? '')` (canônico, sem dividir por 100)
- `ndf`:
  - `_displayQty = String(leg.volume_units ?? '')`, label "Volume USD"
  - `_displayPrice = String(leg.ndf_rate ?? '')` — **NÃO** usar `leg.price` (dado legado corrompido pelo bug 2)

`unit_label` preservado via spread `...leg` no estado local.

### 3. `handleExecutionConfirm` — gravação por tipo de leg
Para cada leg editada, montar `executed_legs[i]` preservando todos os campos originais via spread (`...leg`) e sobrescrevendo apenas:

**futures / option:**
```ts
{
  ...leg,                                  // preserva ticker, currency, direction, unit_label etc.
  contracts: parseFloat(_displayQty),
  volume_units: parseFloat(_displayQty) * getContractSize(order.commodity, order.exchange),
  price: parseFloat(_displayPrice),        // canônico, sem /100
  // ndf_rate NÃO é tocado
}
```

**ndf:**
```ts
const merged = {
  ...leg,                                  // preserva currency, direction, unit_label="USD" etc.
  volume_units: parseFloat(_displayQty),
  ndf_rate: parseFloat(_displayPrice),     // BRL/USD canônico
};
delete merged.price;                       // garante que nenhum price residual fique gravado
return merged;
```

### 4. UI do modal
- Label do campo quantidade muda dinamicamente: "Contratos" para futures/option, "Volume USD" para NDF.
- Label do campo preço continua "Preço", com texto discreto (`text-xs text-muted-foreground` abaixo do input) exibindo `getExecutionPriceLabel(leg.leg_type, order.commodity, order.exchange)`.

### 5. Validações (em `handleExecutionConfirm`)
- Manter `qty > 0` e `price > 0` existentes.
- Envolver chamadas a `getContractSize` em `try/catch`; em erro: `toast.error('Tamanho de contrato desconhecido', { description: e.message })` e `return` (sem propagar exceção).

### 6. Preservações obrigatórias
- `stopPropagation` dos botões de ação na tabela.
- Update de `operations.status = 'HEDGE_CONFIRMADO'` após execução.
- Invalidação de queries react-query (`hedge_orders`, `pending-operations`, etc.) já existentes.
- `unit_label` vem do spread `...leg` — não reescrever manualmente.

## Resultado esperado (exemplo MAD_SOJA_260422_001)
Mesa digita: futures `Contratos=0.66, Preço=11.885`; NDF `Volume USD=8218.33, Preço=5.12`.

`executed_legs` gravado:
```json
[
  { "leg_type":"futures","ticker":"ZSQ26","currency":"USD","direction":"sell",
    "contracts":0.66,"volume_units":3300,"unit_label":"bushels","price":11.885 },
  { "leg_type":"ndf","currency":"USD","direction":"sell",
    "volume_units":8218.33,"unit_label":"USD","ndf_rate":5.12 }
]
```

## Fora de escopo
Backfill das 5 ordens seed, nova seção "Preço de Entrada (Executado)" no MTM, qualquer outro arquivo, schema do banco, autoPopulate/build/save originais.

