# Plano: distinguir falha técnica de "cadastro em análise" no login

## Problema
Quando a Data API do Supabase retorna erro (5xx, timeout, etc.), `AuthContext.fetchProfile` faz `console.error` e `setProfile(null)`. `ProtectedRoute` interpreta `profile === null` como usuário pendente e redireciona para `/aguardando-aprovacao`. Infraestrutura fora do ar aparece como "seu cadastro está em análise".

## Objetivo
Separar três situações distintas:
1. Perfil não existe → continua indo para `/aguardando-aprovacao`.
2. Perfil existe com status `pending` → continua indo para `/aguardando-aprovacao`.
3. Consulta ao perfil FALHOU → mostrar erro técnico com ação de tentar novamente, sem redirecionar para análise.

## Escopo
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/ProtectedRoute.test.tsx`

Não altera cliente Supabase, não muda lógica de status `pending`/`disabled`, não muda roteamento de login.

## Implementação

### 1. AuthContext — expor falha técnica
- Adicionar estado `profileError: Error | null` (ou string) ao contexto.
- Alterar `fetchProfile` para retornar um discriminated result ou, no mínimo, setar `profileError` quando `error` for truthy.
- Diferenciar:
  - `error` truthy → `setProfileError(error)` + `setProfile(null)`.
  - `error` null e `data` null → perfil realmente ausente → `setProfileError(null)` + `setProfile(null)`.
  - `error` null e `data` presente → `setProfileError(null)` + `setProfile(data)`.
- Limpar `profileError` no início de toda chamada de `fetchProfile` e em `refreshProfile`.
- Adicionar `profileError` no value do provider.

### 2. ProtectedRoute — tratar erro técnico
- Ler `profileError` do contexto.
- Ordem de decisão:
  1. `isPasswordRecovery` → renderiza children (mantido).
  2. `loading && (!user || !profile)` → spinner (mantido).
  3. `!user` → `/login` (mantido).
  4. `profileError` → renderizar tela de erro técnico (não redirecionar).
  5. `!profile || profile.status === 'pending'` → `/aguardando-aprovacao` (mantido).
  6. `profile.status === 'disabled'` → `/acesso-desativado` (mantido).
  7. Caso contrário → children.

### 3. Tela de erro técnico (inline no ProtectedRoute)
- Card centralizado com:
  - Título: "Falha ao carregar perfil" ou similar.
  - Mensagem curta explicando que houve um problema técnico.
  - Botão "Tentar novamente" chamando `refreshProfile()`.
  - Botão secundário "Sair".
- Usar componentes existentes (`Card`, `Button`, ícone `AlertTriangle` ou `WifiOff`).

### 4. Testes
- Atualizar `ProtectedRoute.test.tsx` para mockar `profileError`.
- Adicionar casos:
  - `profileError` definido → mostra mensagem de erro técnico e botão de retry, não redireciona.
  - `profile` null sem erro → continua redirecionando para `/aguardando-aprovacao`.
  - `profile.status === 'pending'` → redireciona para `/aguardando-aprovacao`.
  - Retry limpa erro e refetch (simulado).

## Critérios de aceite
- Usuário com status `pending` continua indo para `/aguardando-aprovacao`.
- Usuário sem perfil e sem erro continua indo para `/aguardando-aprovacao`.
- Falha de consulta mostra erro técnico com ação de retry, sem redirecionar para análise.
- Usuário ativo com API saudável entra normalmente.
- Testes de `ProtectedRoute` cobrem os três cenários.
