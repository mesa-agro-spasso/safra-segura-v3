# Plano: Perfil, Tema, Roles na Sidebar e Reset de Senha

Sem migrations. Sem edge functions. Coluna `user_profiles.theme` já existe (default `'dark'`). `public.users.roles` é `text[]`, `public.users.full_name` é `NOT NULL`.

## Mudança 1 — `src/pages/Login.tsx`
- Adicionar estado `view: 'login' | 'forgot'` na aba "Entrar".
- Abaixo do botão **Entrar**, link sutil "Esqueci minha senha" (button ghost) que troca para `view='forgot'`.
- Em `forgot`: input de email + botão "Enviar link de recuperação" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/redefinir-senha })`.
- Toast: "Link de recuperação enviado para seu email." e volta para `view='login'`.
- Link "Voltar" para cancelar.

## Mudança 2 — nova `src/pages/ResetPassword.tsx`
- Rota pública `/redefinir-senha`.
- Form: "Nova senha" + "Confirmar nova senha".
- Validação: mínimo 6 caracteres, senhas iguais.
- Submit: `supabase.auth.updateUser({ password })`.
- Toast de sucesso → `setTimeout(() => navigate('/'), 2000)`.
- Layout idêntico ao Login (Card centralizado).

## Mudança 3 — nova `src/pages/Profile.tsx`
Rota `/perfil`. Três `Card`s:

### Informações pessoais
- **Nome completo**: input editável. Ao salvar:
  ```ts
  await supabase.from('user_profiles').update({ full_name }).eq('id', user.id);
  await supabase.from('users').update({ full_name }).eq('id', user.id);
  await refreshProfile();
  ```
- **Email**: read-only (`user.email`).
- **Funções**: badges renderizadas a partir de `public.users.roles` (mapeamento PT: `mesa`→"Mesa", `comercial_n1`→"Comercial N1", `comercial_n2`→"Comercial N2", `admin`→"Admin", fallback = string crua capitalizada).

### Preferências
- Toggle (Switch) **Tema Escuro / Claro**.
- Lê valor inicial de `profile.theme`.
- Ao alternar:
  ```ts
  document.documentElement.classList.toggle('dark', theme === 'dark');
  await supabase.from('user_profiles').update({ theme }).eq('id', user.id);
  await refreshProfile();
  ```

### Segurança
- Inputs: "Senha atual" (apenas UX, não validada), "Nova senha", "Confirmar nova senha".
- Validação: mínimo 6, iguais.
- Submit: `supabase.auth.updateUser({ password: novaSenha })`. Limpa os campos após sucesso.

Carregamento de roles: `useQuery(['current-user-roles', user.id], () => supabase.from('users').select('roles').eq('id', user.id).maybeSingle())`.

## Mudança 4 — `src/components/AppSidebar.tsx`
- No `SidebarFooter`: substituir o `<p>` do nome por um `<Link to="/perfil">` clicável (`hover:text-sidebar-foreground`).
- Abaixo do nome, em texto pequeno (`text-[10px] text-sidebar-foreground/40`), exibir roles formatadas separadas por " · ".
- Buscar roles via `useQuery(['sidebar-user-roles', user?.id], ...)` em `public.users`. Esconder linha de roles quando `collapsed`.

## Mudança 5 — `src/App.tsx`
- Importar `Profile` e `ResetPassword`.
- `<Route path="/redefinir-senha" element={<ResetPassword />} />` **fora** do `ProtectedRoute` (público, ao lado de `/login`).
- `<Route path="/perfil" element={<Profile />} />` dentro do grupo protegido (junto com as outras).

## Mudança 6 — `src/contexts/AuthContext.tsx`
- Em `fetchProfile`, após receber o profile, aplicar tema:
  ```ts
  if (p?.theme === 'light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
  ```
- Adicionar campo `theme: 'dark' | 'light'` na interface `UserProfile` em `src/types/index.ts` (necessário porque a coluna existe mas o type não a expõe).

## Tipos (`src/types/index.ts`)
- Acrescentar `theme: 'dark' | 'light'` em `UserProfile`. Nada mais.

## Notas
- `user.email` vem do auth user, sempre presente.
- `refreshProfile` já existe no AuthContext e será reutilizado após cada update.
- Sem alteração em RLS — operações são `update` em linhas próprias do usuário (políticas existentes já permitem isso para `user_profiles` e `users`; se houver falha de permissão em `users.full_name`, reportar e pedir migration depois — fora deste escopo).
