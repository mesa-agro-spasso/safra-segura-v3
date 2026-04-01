

# Mesa Integrada de Hedge — Plano de Implementação

## Estado Atual

- Supabase conectado com 7 tabelas já criadas (warehouses, market_data, pricing_snapshots, operations, hedge_orders, mtm_snapshots, users)
- 4 warehouses com dados reais (Matupá, Confresa, Alta Floresta, Sede Madcap)
- market_data com UNIQUE constraint em `ticker` (pronto para upsert)
- Nenhuma RLS policy habilitada
- Nenhuma Edge Function existente
- Frontend é placeholder
- Secret `SAFRA_API_KEY` já configurado
- Funções DB existentes: `handle_new_user`, `has_role`, `update_updated_at`

## Ajustes Incorporados

- **market_data upsert**: `onConflict: 'ticker'`, uma linha por ticker, sempre sobrescrita
- **Freshness**: usar `updated_at` (não `created_at`) para calcular "X horas atrás" e alertas de 24h
- **`date`**: preenchido com data atual a cada atualização
- **`updated_at`**: não enviado pelo frontend (trigger automático)
- **RLS**: policies simples — authenticated tem acesso total — dívida técnica documentada

## Etapa 1 — Migration SQL: RLS Policies

Habilitar RLS em todas as 7 tabelas. Policy única por tabela: `authenticated` tem full access (SELECT, INSERT, UPDATE, DELETE).

```sql
-- Para cada tabela: ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated full access" ON ... FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Tabelas: `warehouses`, `market_data`, `pricing_snapshots`, `operations`, `hedge_orders`, `mtm_snapshots`, `users`

Dívida técnica: RLS será refinada por role quando RBAC for implementado.

## Etapa 2 — Edge Function: `api-proxy`

Arquivo: `supabase/functions/api-proxy/index.ts`

- Recebe JSON com `{ endpoint: string, body: object }`
- Endpoints permitidos: `/pricing/table`, `/orders/build`, `/orders/validate`, `/mtm/run`
- Valida que endpoint está na whitelist
- Faz POST para `https://safra-segura-api.onrender.com{endpoint}`
- Header: `X-API-Key` do secret `SAFRA_API_KEY`
- Retorna resposta da API sem modificação
- CORS headers via `@supabase/supabase-js/cors`
- Zero cálculo

## Etapa 3 — Design System (Dark Mode)

Atualizar `index.css` com paleta dark mode profissional:
- Background: slate escuro (~222 47% 6%)
- Cards: slate levemente mais claro
- Primary: verde profissional (~142 70% 45%)
- Classe `dark` no `<html>` em `index.html`

## Etapa 4 — Auth + Layout

**AuthContext** (`src/contexts/AuthContext.tsx`):
- `onAuthStateChange` + `getSession`
- Estado: user, session, loading

**ProtectedRoute** (`src/components/ProtectedRoute.tsx`):
- Redireciona para `/login` se não autenticado

**Login** (`src/pages/Login.tsx`):
- Email/senha via `supabase.auth.signInWithPassword`
- Redireciona para `/` após login

**AppLayout** (`src/components/AppLayout.tsx` + `AppSidebar.tsx`):
- Sidebar fixa com 5 links: Tabela de Preços, Ordens, MTM, Mercado, Configurações
- Header com nome do usuário + logout
- Usa shadcn Sidebar components

## Etapa 5 — Types + API Client + Hooks

**`src/types/index.ts`**: interfaces para Warehouse, MarketData, PricingSnapshot, HedgeOrder, Operation, MtmSnapshot, PricingCombination

**`src/lib/api.ts`**: função `callApi(endpoint, body)` que faz `supabase.functions.invoke('api-proxy', { body: { endpoint, body } })`

**Hooks React Query**:
- `useWarehouses` — lista warehouses ativos
- `useMarketData` — lista market_data, calcula freshness com `updated_at`
- `usePricingSnapshots` — lista snapshots recentes
- `useHedgeOrders` — lista/cria ordens
- `useOperations` — lista operações
- `useMtmSnapshots` — lista MTM

**Mutations**:
- `useUpsertMarketData` — upsert com `onConflict: 'ticker'`, não envia `updated_at`, preenche `date` com hoje
- `useSavePricingSnapshots` — insere batch de snapshots
- `useCreateHedgeOrder` — insere ordem
- `useCreateOperation` — insere operação
- `useSaveMtmSnapshot` — insere MTM

## Etapa 6 — Páginas

### Tabela de Preços (`/`)
- Ao abrir: busca últimos pricing_snapshots + market_data
- Exibe "Atualizado em HH:MM de DD/MM/YYYY"
- Verifica freshness de cada ticker usando `updated_at`: exibe "Última atualização: X horas atrás"
- Se qualquer ticker >24h: banner amarelo com "Ignorar" e "Atualizar Mercado" (redireciona para /mercado)
- Milho B3 (CCMF27/CCMK27) com alerta independente
- Botão "Gerar Tabela": busca market_data + warehouses (type=ARMAZEM, active=true), monta combinations, chama api-proxy → `/pricing/table`, salva em pricing_snapshots
- Tabela: linhas=praças, colunas=datas×commodity, célula=origination_price_brl
- Tooltip: purchased basis, breakeven, custos, seguros (ATM, 5% OTM, 10% OTM)
- Click célula: abre painel lateral de criação de ordem

### Ordens (`/ordens`)
- Criar ordem: selecionar praça, snapshot, volume, operation_id → api-proxy → `/orders/build` → exibe alertas + messages copiáveis → salva em hedge_orders
- Lista existente com filtro commodity/status
- Formulário manual para ordens já executadas (salva direto no Supabase)

### MTM (`/mtm`)
- Lista hedge_orders ativas
- Input manual de preço físico por praça
- Botão "Calcular MTM": busca market_data, chama api-proxy → `/mtm/run`, exibe decomposição, salva em mtm_snapshots

### Mercado (`/mercado`)
- Card por ticker (ZSQ26, ZSX26, CCMF27, CCMK27, USD/BRL)
- Valor, timestamp, "X horas atrás" (calculado com `updated_at`)
- Botão "Atualizar Automático": chama API para soja CBOT + câmbio, upsert em market_data com `onConflict: 'ticker'`
- Milho B3: campo manual sempre visível e destacado
- Edição manual para qualquer ticker

### Configurações (`/configuracoes`)
- Lista warehouses com botão editar (nome, cidade, estado, basis_config, custos)
- Botão "Novo Armazém"
- Salva no Supabase

## Regras Transversais

- Cold start >5s: exibir "Aguardando servidor acordar..."
- Loading states em todas as chamadas
- Erros de API com mensagem descritiva
- Zero cálculo financeiro no frontend

## Arquivos a Criar

```text
supabase/functions/api-proxy/index.ts
src/contexts/AuthContext.tsx
src/components/ProtectedRoute.tsx
src/components/AppLayout.tsx
src/components/AppSidebar.tsx
src/types/index.ts
src/lib/api.ts
src/hooks/useAuth.ts
src/hooks/useWarehouses.ts
src/hooks/useMarketData.ts
src/hooks/usePricingSnapshots.ts
src/hooks/useHedgeOrders.ts
src/hooks/useOperations.ts
src/hooks/useMtmSnapshots.ts
src/pages/Login.tsx
src/pages/PricingTable.tsx
src/pages/Orders.tsx
src/pages/MTM.tsx
src/pages/Market.tsx
src/pages/Settings.tsx
src/App.tsx (update routes)
src/index.css (dark mode)
index.html (class="dark")
```

## Ordem de Execução

1. Migration SQL (RLS em todas as tabelas)
2. Edge Function `api-proxy`
3. Design system dark mode + Auth + Layout
4. Types + API client + Hooks
5. Páginas (Tabela de Preços → Mercado → Ordens → MTM → Configurações)

