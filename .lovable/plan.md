

# Etapa 3 — Página Aprovações + rota

## Arquivos

### 1. `src/pages/Approvals.tsx` (novo)

**Constantes**:
- `KG_PER_SACK = 60`
- `ROLES_TIERS` com `low`/`mid`/`high` (mid: `comercial_n2` duplicado → exige 2 assinaturas distintas)
- Helpers `countBy`, `getMissingRoles` (preserva duplicatas), `allSigned`
- `getRequiredRoles(volumeTons, policy)` — escolhe tier por threshold
- Fallback quando policy ausente: `{ threshold_x_tons: Infinity, threshold_y_tons: 0 }` → tier low

**Fetches (useQuery)**:
1. `current-user-roles` — `users.roles` por `user.id`
2. `approval-policy` — `approval_policies` com `is_active=true` (`maybeSingle`)
3. `pending-operations` — `operations` com `status='EM_APROVACAO'`, joins `pricing_snapshot:pricing_snapshots(payment_date)` e `warehouse:warehouses(display_name)`
4. `pending-hedge-orders` — `hedge_orders` por `operation_id IN (...)` para `display_code`, `origination_price_brl`, `volume_sacks`
5. `pending-signatures` — `signatures` por `operation_id IN (...)`, com `signer:users(full_name)`

Queries 4 e 5 dependem de 3, `enabled: !!operationIds.length`.

**Derivação por operação**:
- `collectedRoles` = signatures.map(s => s.role_used)
- `userAlreadySigned` = signatures.some(s => s.user_id === user.id)
- `volumeTons = volume_sacks * 60 / 1000`
- `requiredRoles = getRequiredRoles(volumeTons, policy)`
- `missing = getMissingRoles(requiredRoles, collectedRoles)`
- `availableRolesForUser = userRoles.filter(r => missing.includes(r))`

**Filtro**: exibir apenas operações com `!userAlreadySigned && availableRolesForUser.length > 0`.

**Tabela**:
Colunas Código, Praça, Commodity, Volume (sacas), Valor (`volume_sacks * origination_price_brl` em BRL), Data Pagamento (pt-BR), Assinaturas (badges verdes coletadas + cinza outline faltantes), Ação (botão "Assinar").

**Dialog "Assinar"**:
- Estado: `signingOperation`, `selectedRole`, `notes`
- Texto: `Assinando como [role] na operação [display_code]`
- `<Select>` com `availableRolesForUser` (default = primeiro)
- `<Textarea>` opcional
- Cancelar / Confirmar

**`handleSign`**:
1. Insert em `signatures` (`signature_type='APROVACAO'`, `signed_at=now`)
2. Recalcular `newCollected`; se `allSigned` → update `operations.status='APROVADA'`
3. Toast, invalidar `['pending-signatures']`, `['pending-operations']`, `['operations']`, `['hedge-orders']`
4. Fechar dialog

**Layout**: header "Aprovações", Card com tabela. Empty state: "Nenhuma operação aguardando sua assinatura." Se policy ausente, warning sutil no header.

### 2. `src/App.tsx`

- Import `Approvals from "./pages/Approvals"`
- Adicionar `<Route path="/aprovacoes" element={<Approvals />} />` no grupo protegido, após `/ordens`

## Fora de escopo
Sidebar, edge functions, migrations, qualquer outro arquivo. Zero cálculo financeiro além de multiplicação de exibição e conversão saca→tonelada.

