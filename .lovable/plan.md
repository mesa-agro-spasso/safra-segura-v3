## Suporte a ambiente staging com Supabase separado

### 1. Novo arquivo `src/integrations/supabase/client-staging.ts`
Cliente Supabase apontando para o projeto staging (`bocsovenbertyepsiobp`), com mesma config de auth (localStorage, persist, autoRefresh).

### 2. Modificar `src/integrations/supabase/client.ts`
Selecionar URL/key dinamicamente via `localStorage.getItem('mesa_env') === 'staging'`. Mantém o export `supabase` único — todo o app continua funcionando sem alterações em hooks/páginas.

### 3. Toggle de ambiente no `AppSidebar.tsx`
- Renderizado apenas se `isAdmin()` (via `useAuthorization`).
- Posicionado no `SidebarFooter`, acima do bloco de perfil/logout.
- UI: um `Switch` (shadcn) com label "Staging" + um badge vermelho fixo "STAGING" quando ativo.
- Estado inicial lido de `localStorage.getItem('mesa_env')`.
- Ao alternar:
  - ON → `localStorage.setItem('mesa_env', 'staging')`
  - OFF → `localStorage.removeItem('mesa_env')`
  - Em seguida `window.location.reload()` para reinstanciar o cliente Supabase.
- Quando colapsada, mostrar apenas um pequeno indicador "S" vermelho (sem o switch) para preservar visibilidade.

### 4. Indicador global "STAGING"
Quando `mesa_env === 'staging'`:
- Badge vermelho fixo no topo da sidebar (logo abaixo da logo), visível em todas as rotas porque a sidebar é parte do `AppLayout`.
- Sem alterações adicionais em outras páginas.

### Detalhes técnicos
- O toggle não precisa ser reativo entre abas — o reload garante consistência.
- `client-staging.ts` é mantido como export auxiliar caso se queira acesso simultâneo aos dois ambientes no futuro, mas não é importado em lugar algum nesta tarefa.
- Edge Functions (`api-proxy`) continuam sendo chamadas via o cliente ativo, então automaticamente apontam para o projeto correspondente.
- Tipos do Database são compartilhados — assume-se que ambos os projetos têm o mesmo schema.

### Arquivos alterados
- `src/integrations/supabase/client-staging.ts` (novo)
- `src/integrations/supabase/client.ts` (modificado)
- `src/components/AppSidebar.tsx` (modificado)

### Fora de escopo
- Nenhuma mudança em hooks, páginas, edge functions ou schema.
- Sincronização de sessão entre ambientes (cada ambiente tem sua própria sessão no localStorage do Supabase).
