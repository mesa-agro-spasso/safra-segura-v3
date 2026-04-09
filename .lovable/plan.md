

# Refatorar aba "Ordens Existentes" — Orders.tsx

## Arquivo: `src/pages/Orders.tsx`

### Edição 1 — Imports (linha 17)

Adicionar `Filter` ao import de lucide-react e novos imports de `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` e `Separator`.

### Edição 2 — Novos estados (após linha 51)

Adicionar `warehouseFilter`, `listFiltersExpanded`, `selectedOrder`. Renomear `data: orders` para `data: ordersRaw` e adicionar `useMemo` para filtro de warehouse via operations.

### Edição 3 — Substituir TabsContent value="list" (linhas 527-579)

Substituir inteiro pelo novo layout:
- Filtros colapsáveis com botão toggle (Filter icon + badge de filtros ativos)
- 3 selects: Commodity, Status, Praça (usando warehouses)
- Botão "Limpar filtros" condicional
- Tabela com colunas: ID Operação, Commodity, Ticker, Volume, Preço orig., Pernas, Status, Data
- Linhas clicáveis (`cursor-pointer`) que abrem modal
- Modal Dialog com seções: Identificação, Volume/Preço, Pernas detalhadas, Mensagens

### O que NÃO muda

Abas "Criar Ordem" e "Registro Manual", hooks, handlers.

