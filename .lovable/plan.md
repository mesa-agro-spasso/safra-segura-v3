# Corrigir ResetPassword.tsx

## Problema
O `AuthContext` registra o listener `onAuthStateChange` no mount do app e processa o evento `PASSWORD_RECOVERY` antes do componente `ResetPassword` montar. O listener local dentro do componente nunca recebe o evento, então `sessionReady` nunca vira `true` e o spinner fica permanente.

O `AuthContext` já expõe `isPasswordRecovery` exatamente para esse caso.

## Mudança em `src/pages/ResetPassword.tsx`

1. Importar `useAuth` de `@/contexts/AuthContext`.
2. Remover:
   - `useEffect` import (não será mais necessário).
   - `useState` para `sessionReady`.
   - O bloco `useEffect` com `onAuthStateChange` + `getSession`.
3. Derivar `sessionReady` do contexto:
   ```ts
   const { isPasswordRecovery, user } = useAuth();
   const sessionReady = isPasswordRecovery || !!user;
   ```
4. Manter o restante igual: spinner enquanto `!sessionReady`, formulário quando `sessionReady`, botão "Alterar senha" desabilitado quando `!sessionReady || loading`, `supabase.auth.updateUser({ password })` no submit, redirect para `/` após sucesso.

## Arquivos
- `src/pages/ResetPassword.tsx` (único)

Nenhuma alteração no `AuthContext` ou em outros arquivos.
