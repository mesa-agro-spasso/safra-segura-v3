# Migração para "staging por schema" + limpeza do projeto staging

## Resultado final

- **Um único projeto Supabase** (o de produção, `ngwhatepvofvwgzbudth`).
- **Dois schemas no mesmo banco**: `public` (real) e `staging` (testes).
- **Mesma autenticação**: você loga uma vez; o ambiente é só uma chave que troca o schema das queries.
- **Migrations sincronizadas**: toda alteração de estrutura roda nos dois schemas via uma função helper, então staging nunca mais fica desatualizado.
- **Mesma URL, mesma key, mesma sessão**. Sem reload, sem dois clientes, sem auth tokens duplicados.

## Como você vai usar

- Toggle no rodapé da sidebar: `Ambiente: Produção / Staging`. Clicar troca instantaneamente — sem reload, sem logout. Banner amarelo no topo quando estiver em staging.
- Dados de staging começam vazios, exceto warehouses/pricing_parameters/approval_policies que são copiados do prod no momento da migração (você pode mexer à vontade depois).
- Edge functions e a API Python no Render continuam funcionando igual — só o schema de leitura/escrita do frontend muda.

## O que eu faço

### 1. Migração de banco (uma migration única no projeto de prod)
- Cria schema `staging`.
- Para cada uma das 16 tabelas em `public`, cria gêmea em `staging` com `LIKE ... INCLUDING ALL` (estrutura, defaults, índices, constraints).
- Recria as foreign keys dentro de `staging` (apontando staging→staging).
- Aplica as mesmas RLS policies em todas as tabelas de `staging`.
- Recria as funções e triggers (`set_operation_display_code`, `advance_operation_after_order`, `handle_new_user_profile`, etc.) em versões `staging.*` que escrevem no schema certo.
- Seed de dados de referência: copia `warehouses`, `pricing_parameters`, `approval_policies` de `public` para `staging`.
- Seed de `staging.user_profiles`: copia o seu profile admin de `public.user_profiles` para você já entrar como admin no staging.

### 2. Frontend (cliente único, schema dinâmico)
- `src/integrations/supabase/client.ts`: volta a ser um único cliente, mas exporta `getSupabase()` que retorna a instância configurada com `db: { schema: 'staging' | 'public' }` lendo `localStorage.mesa_env` em tempo real (sem reload).
- Substituo o `import { supabase }` por uma versão que reage à troca de ambiente em runtime (via React context + re-render de queries).
- Toggle no `AppSidebar` (rodapé): muda o env, invalida o React Query cache, sem reload.
- Banner amarelo de staging no `AppLayout` (topo).
- Apago o toggle e o banner do `Login.tsx`.
- Apago `client-staging.ts` e toda a lógica de `mesa_env` espalhada.

### 3. Limpeza
- Apago a edge function `provision-staging-users` (do código e do deploy Supabase).
- Removo `isStagingEnv()`, `STAGING_URL`, `STAGING_KEY` do código.
- Removo a remoção dos auth tokens duplicados no Login.

## O que VOCÊ precisa fazer (passos manuais)

Coisas que eu não consigo executar via tools:

1. **Expor o schema `staging` na API do Supabase** (obrigatório, senão o PostgREST não enxerga as tabelas):
   - Dashboard → projeto de produção → **Settings → API**
   - Campo **"Exposed schemas"** → adicionar `staging` (deixar `public, staging`)
   - Salvar. Leva ~10s pra propagar.

2. **Deletar o projeto staging inteiro** (`bocsovenbertyepsiobp`):
   - https://supabase.com/dashboard/project/bocsovenbertyepsiobp/settings/general
   - Rolar até **Danger Zone → Delete project**

3. **Remover o secret `STAGING_SUPABASE_SERVICE_ROLE_KEY`** (opcional, fica órfão):
   - Dashboard do projeto prod → Settings → Functions → Secrets → deletar.

4. **Apagar o arquivo SQL antigo** que te enviei (`/mnt/documents/staging-schema-fix.sql`) — não serve mais.

## Detalhes técnicos

**Por que schema e não `is_test` flag**: schema isola 100% — você pode dropar tudo em staging com `TRUNCATE`, rodar migrations destrutivas, sem risco em prod. É a abordagem que o próprio Supabase recomenda quando branching não está disponível.

**Por que não preciso de reload na troca**: o cliente Supabase aceita `client.schema('staging')` em chamadas pontuais, e como vamos refatorar pra usar um wrapper, o `useQuery` re-fetcha quando a key muda (vou incluir o env na queryKey).

**Auth compartilhada**: `auth.users` mora no schema `auth`, é único no projeto. Os dois ambientes compartilham os mesmos usuários logáveis. Cada ambiente tem seu próprio `user_profiles` (autorização/admin), então você pode ter status diferente em cada um se quiser.

**Edge functions**: `api-proxy` chama Render (não toca o banco), então funciona igual nos dois ambientes. Se no futuro algum edge function precisar escrever direto no banco, ele recebe o env via header `x-mesa-env` e usa `.schema(env)`.

**Migrations futuras**: toda nova migration vai ter um helper `apply_to_both_schemas('CREATE TABLE...')` ou ser escrita explicitamente nos dois schemas. Documento isso no README.

## Riscos

- Se você esquecer de adicionar `staging` aos schemas expostos no dashboard (passo 1), nada vai funcionar em modo staging — vou colocar uma mensagem de erro clara no toggle.
- Migrations futuras precisam lembrar de aplicar nos dois schemas. Vou documentar.