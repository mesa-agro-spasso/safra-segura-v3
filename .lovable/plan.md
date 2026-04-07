

# Sistema de Autenticação e Controle de Acesso — Plano Final

## Análise de dependências

- Trigger `on_auth_user_created` → `handle_new_user()` insere em `public.users`. Nenhum código frontend referencia `public.users`. Apenas 1 registro existe. **Seguro substituir.**
- `public.users` permanece intacta como dado legado, mas sem trigger alimentando.

## Migration 1 — Estrutural (schema + triggers + RLS)

```sql
-- 1. Garantir update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2. Tabela
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','disabled')),
  access_level text NOT NULL DEFAULT 'limited'
    CHECK (access_level IN ('limited','full')),
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id)
);

-- 3. Trigger updated_at
DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Substituir trigger legado (alimentava apenas public.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 6. Security definer helpers
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM user_profiles WHERE id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT status FROM user_profiles WHERE id = _user_id;
$$;

-- 7. RLS — separadas para clareza e auditabilidade
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Limpar policies existentes
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin updates profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated full access" ON public.user_profiles;

-- SELECT: usuário lê apenas o próprio
CREATE POLICY "Users read own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- SELECT: admin lê todos
CREATE POLICY "Admin reads all profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- UPDATE: apenas admin
CREATE POLICY "Admin updates profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Sem INSERT policy (trigger cuida)
-- Sem DELETE policy (proibido)
```

## Seed do primeiro admin (SQL operacional separado, via insert tool)

```sql
INSERT INTO public.user_profiles (id, email, full_name, status, is_admin, access_level, approved_at)
VALUES (
  'd9f90adf-1278-409c-9dec-c00792678331',
  'mesaagro@grupospasso.com.br',
  'Mesa Agro',
  'active', true, 'full', now()
)
ON CONFLICT (id) DO UPDATE
SET status='active', is_admin=true, access_level='full', approved_at=now();
```

Documentação: para promover novos admins no futuro:
```sql
UPDATE public.user_profiles
SET status='active', is_admin=true, access_level='full',
    approved_at=now(), approved_by='<admin-uuid>'
WHERE email='<email>';
```

## Frontend — Arquivos

### `src/types/index.ts` — Adicionar UserProfile
Interface tipada com `status: 'pending' | 'active' | 'disabled'`, etc.

### `src/contexts/AuthContext.tsx` — Reescrever
- Expor: `user, session, profile, loading, signIn, signUp, signOut, refreshProfile`
- Buscar profile após auth state change
- **Sem profile encontrado**: `profile = null`, tratado como pending no ProtectedRoute
- Nunca loop, nunca crash

### `src/hooks/useAuthorization.ts` — Novo
```typescript
export function useAuthorization() {
  const { profile } = useAuth();
  return {
    isAdmin: () => profile?.is_admin === true && profile?.status === 'active',
    isActive: () => profile?.status === 'active',
    hasAccessLevel: (level: string) => profile?.access_level === level,
    canAccess: () => profile?.status === 'active',
  };
}
```
Toda permissão centralizada aqui. Nenhuma página faz checagem direta.

### `src/components/ProtectedRoute.tsx` — Atualizar
- Sem sessão → `/login`
- Sessão + (profile null ou pending) → `/aguardando-aprovacao`
- Sessão + disabled → `/acesso-desativado`
- Sessão + active → children

### `src/components/AdminRoute.tsx` — Novo
- `useAuthorization().isAdmin()` → senão redireciona `/`

### `src/pages/Login.tsx` — Reescrever
- Tabs Login / Cadastro
- Cadastro: nome, email, senha, confirmar senha
- Após cadastro: toast + redireciona `/aguardando-aprovacao`
- Login existente: após auth, ProtectedRoute cuida do redirecionamento por status

### `src/pages/PendingApproval.tsx` — Novo
- "Cadastro em análise" + botão atualizar (refreshProfile) + botão sair
- `full_name` exibido com fallback para email

### `src/pages/AccountDisabled.tsx` — Novo
- "Acesso desativado" + orientação + botão sair

### `src/pages/AdminUsers.tsx` — Novo
- Tabela: nome (fallback email), email, status, access_level, is_admin, created_at, approved_at
- **Zero credenciais exibidas**
- Busca, filtro por status
- Ações: Aprovar (status='active' + approved_at + approved_by), Desativar, Reativar, Toggle admin, Alterar access_level

### `src/components/AppSidebar.tsx` — Atualizar
- Item "Administração" visível apenas via `useAuthorization().isAdmin()`
- `full_name` com fallback para email no footer

### `src/App.tsx` — Atualizar rotas
- `/login`, `/aguardando-aprovacao`, `/acesso-desativado` — públicas
- `/admin/usuarios` — AdminRoute + AppLayout
- Rotas existentes — ProtectedRoute + AppLayout

## Segurança — Regras aplicadas

| Regra | Implementação |
|---|---|
| Client NÃO insere em user_profiles | Sem INSERT policy; trigger SECURITY DEFINER |
| Client NÃO deleta user_profiles | Sem DELETE policy |
| Gestão exclusiva do admin | UPDATE policy requer is_admin |
| Sem credenciais expostas | Zero campos de senha; sem logs de payload |
| auth.users = autenticação | Supabase Auth exclusivo |
| user_profiles = autorização | Fonte de verdade para status/permissões |
| public.users NÃO usado para auth | Tabela legada intacta, sem referências |

## Memória do projeto

Criar arquivo `docs/auth-access-control.md` na raiz do projeto (documentação técnica simples) com:
- Arquitetura auth.users ↔ user_profiles
- Regras de RLS
- Fluxo de aprovação
- Instrução para promoção de admin
- Nota: permissões granulares por módulo serão futuras

Atualizar `mem://index.md` com referência.

## Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Tabela, triggers, funcs, RLS |
| Seed SQL (insert tool) | Promover admin existente |
| `src/types/index.ts` | +UserProfile |
| `src/contexts/AuthContext.tsx` | Reescrita |
| `src/hooks/useAuthorization.ts` | Novo |
| `src/components/ProtectedRoute.tsx` | Atualizar |
| `src/components/AdminRoute.tsx` | Novo |
| `src/pages/Login.tsx` | Reescrita com cadastro |
| `src/pages/PendingApproval.tsx` | Novo |
| `src/pages/AccountDisabled.tsx` | Novo |
| `src/pages/AdminUsers.tsx` | Novo |
| `src/components/AppSidebar.tsx` | Menu admin + fallback nome |
| `src/App.tsx` | Novas rotas |
| `docs/auth-access-control.md` | Documentação técnica |
| `mem://` | Atualizar index + criar referência |

