# Onda 1 — Reduzir superfície ao fluxo de Geração de Preços

Escopo: apenas navegação, rotas e um placeholder. **Nenhuma lógica de negócio (D24, hedge, ordens, seguro, pricing) é alterada.** Todos os arquivos das telas ocultas permanecem no repositório para as próximas ondas.

## Estado atual das flags (`.env` / `.env.example`)

| Flag | Valor hoje | Ação |
|---|---|---|
| `VITE_FEATURE_AUTHORIZATION_TIERS` (Alçadas) | `false` | Já oculta — nada a fazer |
| `VITE_FEATURE_MARKET_PHYSICAL` | `true` | Manter `true` (aba visível, com placeholder) |
| `VITE_FEATURE_MARKET_HISTORICAL` | `false` | Já oculta |
| `VITE_FEATURE_PRODUCERS` | `false` | Já oculta |
| `VITE_FEATURE_FINANCIAL_CALENDAR` | `false` | Já oculta |

Observação: a decisão (1) mencionou `VITE_FEATURE_ALCADAS`, mas o flag existente é `VITE_FEATURE_AUTHORIZATION_TIERS`. Vou respeitar o flag existente (sem criar variável nova) e ele já está `false`, então Alçadas fica escondida sem tocar em nada.

## Mudanças concretas

### 1. `src/components/AppSidebar.tsx` — remover itens da navegação

Remover do array `items` (linhas ~39-48) os entries de:
- **Operações** (`/operacoes-d24`)
- **Ordens** (`/ordens-d24`)
- **Armazéns** (`/armazens-d24`, o painel de posição)

Manter tudo o resto: Tabela de Preços, Financeiro (flagged), Mercado, Produtores (flagged), Configurações, Aprovações, Administração (admin), Ajuda.

Também remover os imports dos ícones que não são mais usados: `ClipboardList`, `FileText`, `Building2` (verificar antes de remover, para não deixar import morto).

### 2. `src/components/AppLayout.tsx` — remover rotas

Remover do array `routes` (linhas 23-36) as três rotas correspondentes:
- `{ path: '/ordens-d24', element: <OrdensD24 /> }`
- `{ path: '/operacoes-d24', element: <OperacoesD24 /> }`
- `{ path: '/armazens-d24', element: <ArmazensD24 /> }`

Remover também os `import` das páginas `OrdensD24`, `OperacoesD24`, `ArmazensD24` (linhas 10, 12, 13).

Efeito: acessar `/operacoes-d24`, `/ordens-d24` ou `/armazens-d24` direto na URL cai no `NotFound` do `KeepAliveOutlet`. **A rota `/aprovacoes` continua ativa** (decisão 2).

### 3. `src/pages/market/MarketFisico.tsx` — substituir por placeholder

Substituir o componente inteiro por um card simples "Em breve", no mesmo padrão visual de `HistoricoTerceiros.tsx`. Nada de tabela, nada de dialogs, nada de hooks — a página fica inerte.

Motivo: `MARKET_PHYSICAL=true` é preservado (a aba "Físico" segue visível no seletor de sub-abas de Mercado), mas o conteúdo real fica pausado. Os hooks/dialogs/API de preços físicos continuam existindo no repositório para a próxima onda.

Resultado final na página `/mercado`: sub-abas **Físico** (placeholder) + **Bolsa** (funcional). Histórico permanece oculto pelo flag.

## O que NÃO muda

- Nenhum arquivo em `src/pages/OperacoesD24.tsx`, `src/pages/OrdensD24.tsx`, `src/pages/ArmazensD24.tsx`, `src/pages/Approvals.tsx`, nem os hooks/serviços D24 (`useHedgeOrders`, `useOperations`, `useUpdateOperationProducer`, `src/services/d24Api.ts`, `src/lib/blockTradeExecution.ts`).
- Nenhum arquivo em `src/components/market/PhysicalPrice*`, `usePhysicalPrices`, `usePhysicalPriceHistoryAll` — ficam órfãos por ora, prontos para religar.
- `Settings.tsx` inteiro (inclusive `AlcadasTab`) — a aba Alçadas já é ocultada pelo flag existente.
- Nenhuma migration, nenhuma RLS, nenhum edge function.

## Pontos de atenção

1. **Deep-links quebrados.** Qualquer bookmark do usuário para `/operacoes-d24`, `/ordens-d24` ou `/armazens-d24` passará a mostrar 404. Aceitável nesta onda; se preferir, dá para trocar por um redirect para `/` — precisa sua decisão.
2. **`activityLog`.** Continua funcionando normalmente na Tabela de Preços; nada muda.
3. **Ícones removidos.** Se algum outro arquivo importa `Building2`/`ClipboardList`/`FileText` do sidebar, mantenho os imports — verifico na hora de aplicar.
4. **Modo staging.** O toggle Produção/Teste no rodapé da sidebar não é alterado; permanece funcionando.

## Crítica sincera

**Pontos fortes.** Mudança cirúrgica, três arquivos tocados, zero risco em lógica de pricing/D24. Reversível em um commit. Não cria débito novo (sem flags novas, sem "sistema de módulos" — reaproveita o padrão existente de flags + array de rotas).

**Pontos fracos.** (a) Deixa código órfão no bundle (as páginas D24 continuam sendo tree-shaken? Como não são mais importadas em `AppLayout`, sim — cai do bundle final). (b) Não há teste automatizado que garanta que a Tabela de Preços continua íntegra depois da poda; a verificação vai ser manual (build + smoke test na `/`). (c) A decisão de manter Aprovações inteira significa que o usuário ainda vê a aba "aprovar operações" mesmo com Operações escondida — pequena inconsistência de UX aceita explicitamente pela decisão 2.

**Ponto de atenção principal.** Se em algum lugar de Configurações (Combinações) ou da Tabela de Preços houver `<Link to="/operacoes-d24">` ou similar, o link vai levar ao 404. Antes de aplicar, vou grep por essas URLs e reportar. Se aparecerem, remove-se junto.
