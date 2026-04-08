

# Refatorar aba "Criar Ordem" — Plano de Implementação

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/types/index.ts` | Adicionar `parent_operation_id?: string \| null` ao tipo Operation (linha 79, antes do `}`) |
| `src/pages/Orders.tsx` | Reestruturar aba "Criar Ordem" com commodity select, filtro de snapshots, pernas automáticas, editor de pernas, vinculação a operação |

## 1. `src/types/index.ts`

Adicionar campo na interface Operation (após `notes`, antes de `created_by`):

```ts
parent_operation_id?: string | null;
```

## 2. `src/pages/Orders.tsx` — mudanças na aba "Criar Ordem"

### Imports

- Adicionar `useEffect` ao import do React
- Adicionar `useOperations` ao import de `@/hooks/useOperations`
- Adicionar `Trash2` ao import de lucide-react

### Tipo local + novos estados

Tipo `Leg` definido fora do componente (não exportado). Novos estados: `commodityType`, `legs`, `linkedOperationId`. Instanciar `useOperations()`.

### Filtro de snapshots

Substituir o Select atual de snapshots por lógica filtrada:
- Extrair `com` e `bench` de `commodityType.split('|')`
- `latestDate` = `snapshots?.[0]?.created_at`
- `filteredSnapshots` via `useMemo` filtrando por `created_at === latestDate`, commodity, benchmark, warehouse

### Geração automática de pernas

`useEffect` que observa `selectedSnapshot` + `commodityType`:
- `corn|b3` → 1 perna (futures sell)
- Outros → 2 pernas (futures sell + NDF sell)
- Preenche ticker do snapshot selecionado

### Layout do formulário (grid 2 colunas)

- Linha 1: Praça | Commodity (novo)
- Linha 2: Preço de Referência (span 2, label: `DD/MM pgto · DD/MM venda · R$XX.XX`, disabled se commodityType vazio)
- Linha 3: Volume | Vinculada à operação (Select de operations, default "Nenhuma")
- Linha 4: ID da Operação auto (span 2, existente)

### Editor de pernas

Seção visível se `legs.length > 0`, com título "Pernas da Operação". Cada perna em row com selects (leg_type, direction) e inputs (ticker, contracts, price) + campos condicionais (ndf_rate, option_type/strike/premium). Botão Trash por perna. Botão "+ Adicionar Perna" ao final.

### handleBuildOrder

- Validar `commodityType` preenchido
- Se `linkedOperationId` preenchido: incluir `parent_operation_id` no insert da operação
- Incluir `legs` no payload da API e no insert do hedge_order
- Reset completo ao final: selectedSnapshot, commodityType, legs, linkedOperationId, volume

### previewLabel

Atualizar para usar `com` derivado de `commodityType` (fallback 'SOJA').

## O que NÃO muda

- Abas "Ordens Existentes" e "Registro Manual" — intactas
- Nenhum outro arquivo além dos dois listados

## Memória

Salvar em memória: contrato de `parent_operation_id` (referência lógica, não FK, operação anterior permanece intacta) e estrutura do tipo `Leg`.

