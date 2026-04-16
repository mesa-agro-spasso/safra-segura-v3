

# Drawer de detalhes da ordem em Orders.tsx

Arquivo único: `src/pages/Orders.tsx`. Substituir o `Dialog` de detalhe atual (linhas 1213–1278) por um `Sheet` lateral, mantendo conteúdo de identificação/volume/pernas/mensagens, e adicionando bloco **Aprovações** + botão **Submeter para Aprovação**.

## Verificação de imports

Vou checar `useQuery` / `useQueryClient` no arquivo antes de adicionar — se já existirem, apenas estendo a lista; não duplico.

## Estado atual já presente
- `selectedOrder` — reusar
- `onClick` na `<TableRow>` — manter
- `useAuth()` com `user` — disponível
- `Dialog` em 1213–1278 — converter para Sheet

## Mudanças

### 1. Imports
- Adicionar `Sheet, SheetContent, SheetHeader, SheetTitle` de `@/components/ui/sheet`
- Adicionar `useQuery` e/ou `useQueryClient` de `@tanstack/react-query` **somente se ainda não estiverem importados** (verificação antes do edit)
- Manter `Dialog*` (ainda usado por outros modais)

### 2. Hooks no componente
- `queryClient` (se não existir)
- `useQuery` `current-user-roles` por `user.id` em `users.roles` → `userRoles: string[]`
- `useQuery` `signatures` por `selectedOrder?.operation_id` com `signer:users(full_name)`, ordenado por `signed_at`
- `useQuery` `operation-status` por `selectedOrder?.operation_id` em `operations.status` (necessário porque `hedge_orders.status` ≠ `operations.status`)

### 3. `handleSubmitForApproval`
- Update `operations.status = 'EM_APROVACAO'` por `id = selectedOrder.operation_id`
- Toast de sucesso/erro, fecha Sheet, invalida `['operations']`, `['hedge-orders']`, `['operation-status']`

### 4. Substituir Dialog → Sheet
```tsx
<Sheet open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }}>
  <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
    <SheetHeader><SheetTitle>Ordem — {selectedOrder?.display_code}</SheetTitle></SheetHeader>
    {/* Identificação, Volume/Preço, Pernas, Mensagens — JSX atual mantido */}
    {/* Aprovações: lista signer.full_name · role_used · signed_at (pt-BR), ou "Nenhuma assinatura ainda." */}
    {/* Botão "Submeter para Aprovação" — visível só se operationStatus === 'RASCUNHO' && userRoles.includes('mesa') */}
  </SheetContent>
</Sheet>
```

## Fora de escopo
Criação, registro manual, execução, cancelamento, modal de seguro, tabela de ordens — intactos. Sem migration, sem Edge Functions.

