

# Fluxo de Aprovação de Operações

Quatro arquivos. Sem migration — todas as tabelas (`operations`, `signatures`, `approval_policies`, `users`) já existem.

**Regra confirmada:** verificação por **contagem** — `comercial_n2` no tier `mid` exige 2 assinaturas de usuários distintos.

## Helpers de contagem (em Approvals.tsx e AppSidebar.tsx)

```ts
const countBy = (arr: string[]) => arr.reduce<Record<string, number>>(
  (acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {}
);

// Roles que ainda faltam, considerando duplicatas
const getMissingRoles = (required: string[], collected: string[]) => {
  const req = countBy(required);
  const col = countBy(collected);
  const missing: string[] = [];
  for (const [role, n] of Object.entries(req)) {
    const remaining = n - (col[role] ?? 0);
    for (let i = 0; i < remaining; i++) missing.push(role);
  }
  return missing; // ex: ['comercial_n2'] se só 1 dos 2 já assinou
};

const allSigned = (required: string[], collected: string[]) =>
  getMissingRoles(required, collected).length === 0;
```

Como `signatures.user_id` é único por operation por usuário (filtro de tela impede assinar 2x), 2 entradas com `role_used='comercial_n2'` implicam 2 usuários distintos.

## Arquivos

### 1. `src/pages/Orders.tsx` — Drawer de detalhes
- Imports: `Sheet, SheetContent, SheetHeader, SheetTitle`
- Reusar state `selectedOrder`
- `useQuery` roles do user logado em `public.users`
- `useQuery` signatures da operation selecionada (join `users.full_name`)
- Sheet com: info da ordem, lista de assinaturas (nome, role_used, signed_at), botão "Submeter para Aprovação" — visível se `status === 'RASCUNHO'` e `userRoles.includes('mesa')`. Update → `EM_APROVACAO`, toast, fecha, invalida queries

### 2. `src/pages/Approvals.tsx` (novo)
Constantes no topo:
```ts
const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};
```
- `getRequiredRoles(volumeTons, policy)` por faixa
- Conversão volume: `volume_sacks * 0.06` (60kg → ton, conversão de unidade física)
- Fetches: `currentUser.roles`, `policy` ativa (`maybeSingle`), operations `EM_APROVACAO` com joins, signatures por `operation_id`
- Filtro de tela: usuário não assinou ainda E tem role em `getMissingRoles(required, collected)`
- Tabela: Código, Praça, Commodity, Volume, Valor, Assinaturas (badges verdes coletadas + cinzas faltantes, contando duplicatas), Ação
- Dialog "Assinar": Select com (`userRoles ∩ missingRoles`), Textarea notas, Confirmar → insert em `signatures` com `signature_type:'APROVACAO'`. Recalcula com helper de contagem; se `allSigned`, update status `APROVADA`. Toast + invalida queries

### 3. `src/components/AppSidebar.tsx` — Item + badge
- Imports: `ClipboardCheck`, `Badge`
- Adicionar `{ title: 'Aprovações', url: '/aprovacoes', icon: ClipboardCheck }` após "Ordens"
- `useQuery` `pendingApprovalsCount` com `refetchInterval: 60000` aplicando o mesmo filtro (helper de contagem)
- `<Badge variant="destructive">` quando count > 0 e `!collapsed`

### 4. `src/App.tsx` — Rota
- Importar `Approvals`
- `<Route path="/aprovacoes" element={<Approvals />} />` dentro de `ProtectedRoute > AppLayout`

## Fora de escopo
- Não tocar `handleExecutionConfirm`, formulário de criação, ações existentes na tabela de ordens
- Sem Edge Functions, sem cálculo financeiro, sem migration

