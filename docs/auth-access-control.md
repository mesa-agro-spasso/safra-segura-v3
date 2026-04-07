# Sistema de Autenticação e Controle de Acesso

## Arquitetura

- **auth.users** → autenticação (Supabase Auth)
- **public.user_profiles** → autorização (status, permissões, admin)
- **public.users** → tabela legada de domínio, NÃO usada para auth/authz

## Fluxo

1. Usuário se cadastra → Supabase Auth cria registro em `auth.users`
2. Trigger `on_auth_user_created_profile` cria registro em `user_profiles` com `status='pending'`
3. Admin aprova via painel → `status='active'`, `approved_at=now()`, `approved_by=admin_uid`
4. Login subsequente → ProtectedRoute verifica `profile.status`

## Status

| Status | Comportamento |
|---|---|
| pending | Redireciona para `/aguardando-aprovacao` |
| active | Acesso liberado |
| disabled | Redireciona para `/acesso-desativado` |

## RLS (user_profiles)

- **Users read own profile**: `id = auth.uid()`
- **Admin reads all profiles**: `public.is_admin(auth.uid())`
- **Admin updates profiles**: `public.is_admin(auth.uid())`
- **INSERT**: apenas via trigger (SECURITY DEFINER)
- **DELETE**: proibido (sem policy)

## Promover novo admin

```sql
UPDATE public.user_profiles
SET status='active', is_admin=true, access_level='full',
    approved_at=now(), approved_by='<admin-uuid>'
WHERE email='<email>';
```

## Notas

- Admin é o único com acesso total (por enquanto)
- Usuários comuns só acessam após aprovação
- Permissões detalhadas por módulo serão implementadas no futuro, sem refatoração estrutural
- `access_level` é genérico ('limited' | 'full') — perfis específicos serão definidos depois
