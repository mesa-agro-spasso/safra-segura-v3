

# Adicionar Coluna "Função" em AdminUsers

Arquivo único: `src/pages/AdminUsers.tsx`

## Mudanças

### 1. Imports e constantes (topo)
- Importar `Popover, PopoverTrigger, PopoverContent` de `@/components/ui/popover`
- Importar `Checkbox` de `@/components/ui/checkbox`
- Importar `cn` de `@/lib/utils`
- Adicionar constante `AVAILABLE_ROLES` com 6 roles
- Adicionar mapa `ROLE_COLORS` (Tailwind classes) para cada role:
  - `mesa` → bg-blue-500
  - `comercial_n1` → bg-orange-400
  - `comercial_n2` → bg-orange-600
  - `financeiro_n1` → bg-purple-400
  - `financeiro_n2` → bg-purple-600
  - `presidencia` → bg-amber-500

### 2. Estado e fetch
- Novo state `rolesMap: Record<string, string[]>`
- Em `fetchProfiles`, após o fetch de `user_profiles`, fazer segundo fetch em `public.users` (`select('id, roles')`)
- Construir o mapa por id e setar via `setRolesMap`

### 3. Handler de atualização
- Nova função `handleUpdateRoles(userId: string, newRoles: string[])`
- Chama `supabase.from('users').update({ roles: newRoles }).eq('id', userId)`
- Toast de sucesso/erro
- Atualiza `rolesMap` localmente após sucesso (sem refetch completo)

### 4. Coluna "Função" na tabela
- Adicionar `<TableHead>Função</TableHead>` entre "Acesso" e "Admin"
- Atualizar `colSpan` de 8 → 9 nos estados loading/empty
- Para cada linha: célula com `<Popover>` contendo:
  - **Trigger**: badges coloridos clicáveis (ou "—" se vazio). Cursor pointer apenas para admin; usuários não-admin veem somente leitura.
  - **Content**: lista de checkboxes com os 6 roles disponíveis. Estado local controlado; ao fechar (`onOpenChange={false}`), se mudou, dispara `handleUpdateRoles`.

### 5. Permissão de edição
- Usar `profile?.is_admin` do `useAuth` (já disponível via context) para condicionar o Popover trigger ser interativo. Não-admin: badges renderizados como `<div>` estático.

## Notas

- Nada mais é alterado: filtros, demais colunas e lógica permanecem idênticos.
- O fetch de roles é tolerante a falha (se erro, `rolesMap` fica vazio e exibe "—").

