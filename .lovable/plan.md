## Corrigir fluxo de espera do token em ResetPassword

Substituir a implementação de `src/pages/ResetPassword.tsx` para aguardar o Supabase processar o token de recuperação antes de exibir o formulário.

### Mudanças em `src/pages/ResetPassword.tsx`

1. **Imports**: adicionar `useEffect` ao import de `react`.

2. **Estado novo**: `sessionReady: boolean` (default `false`).

3. **useEffect na montagem**:
   - Subscrever em `supabase.auth.onAuthStateChange` — quando o evento for `PASSWORD_RECOVERY` e houver `session`, setar `sessionReady = true`.
   - Em paralelo, chamar `supabase.auth.getSession()` e, se já houver sessão, setar `sessionReady = true` (cobre o caso do evento já ter disparado antes do mount).
   - Cleanup: `subscription.unsubscribe()`.

4. **Render condicional dentro do `<CardContent>`**:
   - Se `!sessionReady`: exibir um spinner centralizado (ícone `Loader2` do `lucide-react` com `animate-spin`) no lugar do formulário.
   - Se `sessionReady`: exibir o formulário atual (campos de nova senha, confirmar senha, botão).

5. **Botão "Alterar senha"**: `disabled={!sessionReady || loading}`.

6. **Layout**: manter Card centralizado com logo e header inalterados. `handleSubmit` permanece idêntico.

### Não alterar

- Nenhum outro arquivo.
- Nenhuma migration, edge function ou config.
- Lógica de `AuthContext` (já trata `isPasswordRecovery`) e `ProtectedRoute` permanecem intactas — esta página é pública (fora do `ProtectedRoute`).
