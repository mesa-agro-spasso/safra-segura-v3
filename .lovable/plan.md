# Corrigir fluxo de reset de senha

Quando o usuário clica no link de recuperação enviado por email, o Supabase emite o evento `PASSWORD_RECOVERY` e cria uma sessão temporária. Hoje o app trata isso como login normal, então o `ProtectedRoute` pode redirecionar antes da página `/redefinir-senha` montar (ex.: se o link cair em outra rota, ou em corridas com o `loading`). A correção expõe esse estado no contexto e faz o `ProtectedRoute` deixar passar.

## Arquivos alterados (2)

### 1. `src/contexts/AuthContext.tsx`

- Adicionar state `isPasswordRecovery: boolean` (default `false`).
- No callback do `supabase.auth.onAuthStateChange`, antes da lógica existente:
  - Se `event === 'PASSWORD_RECOVERY'` → `setIsPasswordRecovery(true)`.
  - Caso contrário → `setIsPasswordRecovery(false)`.
- Adicionar `isPasswordRecovery` à interface `AuthContextType`.
- Incluir `isPasswordRecovery` no `value` do `AuthContext.Provider`.
- Nenhuma outra lógica (fetchProfile, theme, signIn/signUp/signOut) é tocada.

### 2. `src/components/ProtectedRoute.tsx`

- Consumir `isPasswordRecovery` do `useAuth()`.
- Logo no início do componente (antes de checar `loading`, `user`, `profile`), se `isPasswordRecovery` for `true`, retornar `<>{children}</>` — bypass total dos redirects.
- Resto do componente permanece igual.

## Fora do escopo

- `Login.tsx`, `ResetPassword.tsx`, `App.tsx` e demais arquivos não são alterados.
- Sem migrations, sem Edge Functions.
