# Reativar aba "Físico" em Mercado

## O que muda

A aba **Físico** (e potencialmente **Histórico**) já está totalmente implementada — só está oculta por feature flag. Toda a infra existe:

- Páginas: `src/pages/market/MarketFisico.tsx`, `MarketHistorico.tsx` e subpáginas em `historico/`
- Componentes: `PhysicalPriceFormDialog`, `PhysicalPriceBulkDialog`, `PhysicalPriceHistoryDialog`
- Hooks: `usePhysicalPrices`, `usePhysicalPriceHistoryAll`
- Tabelas no Supabase: `physical_prices` e `warehouses` (verificado, existem)
- Tabs em `src/pages/Market.tsx` já consultam `FEATURES.MARKET_PHYSICAL`

A única mudança necessária é flipar a flag em `.env`:

```
VITE_FEATURE_MARKET_PHYSICAL=true
```

(decisão pendente: ativar também `VITE_FEATURE_MARKET_HISTORICAL`?)

Como `import.meta.env.*` é inlined em build-time pelo Vite, o dev server reinicia e o preview já mostra as abas.

## Arquivos tocados

- `.env` — uma linha (duas se incluir histórico)
- `.env.example` — espelhar para documentação

Nenhuma alteração de código TS, hooks, schema ou RLS.

## Implicações e riscos

**Onde pode quebrar:**

1. **RLS de `physical_prices` / `warehouses`** — se as policies não permitirem `select`/`insert` para o role autenticado padrão, a aba abre mas mostra vazio ou dá erro silencioso. Precisa validar logado como usuário comum (não só admin).
2. **`useActiveArmazens`** — `MarketFisico` lista armazéns ativos. Se não houver nenhum cadastrado, a tabela fica vazia (não quebra, mas parece bug).
3. **Sem registros em `physical_prices`** — o `MarketFisico` exibe "-" e badge "sem registro"; o `BulkDialog` pré-preenche vazio. Tudo OK, só visual.
4. **`MarketBolsa` continua sendo default** quando nenhuma tab está na URL; isso muda — `fisico` passa a ser a primeira da lista e vira o default. Quem tinha bookmark em `/mercado` sem `?tab=` cai em Físico em vez de Bolsa. Se isso for ruim, ajustar a ordem em `Market.tsx` para manter `bolsa` como default.
5. **Bundle size** — os componentes já são importados (não há code-splitting por flag aqui), então o JS final não cresce; é só desbloqueio de UI.
6. **Histórico (se ativado junto)** — `HistoricoFisico`/`HistoricoTerceiros` dependem de tabelas que valem a pena verificar antes (ex.: `physical_price_history`, dados de terceiros). Se faltar dado, abre vazio.

## Validação manual após o flip

1. Reload do preview, ir em **/mercado** → ver as abas Físico / Bolsa (e Histórico se aplicável).
2. Logar como usuário não-admin → confirmar que a aba abre sem erro de RLS.
3. Abrir "Cadastrar preço" e "Cadastrar em massa" → salvar um preço e ver aparecer na tabela.
4. Conferir que **Bolsa** continua funcionando exatamente como antes.

## Crítica sincera

**Pontos fortes**
- Mudança mínima (1 linha), 100% reversível.
- Código já existia, foi exercitado antes, tem hooks e componentes maduros.
- Zero risco para Bolsa, Operações, Pricing — escopo isolado.

**Pontos fracos**
- Não temos teste automatizado cobrindo Físico; validação é manual.
- Muda o default de `/mercado` (Físico vira primeira tab). Se o time está acostumado a cair em Bolsa, vai estranhar.
- O memory do projeto diz "B3 corn manual, alerts 24h" — refere-se a `market_data`, não a `physical_prices`. Vale confirmar que não há regra de negócio adicional sobre físico que ficou em backlog.

**Pontos de atenção**
- Confirmar RLS de `physical_prices` permite leitura/escrita para os usuários esperados antes de anunciar a feature.
- Decidir explicitamente se Histórico entra junto ou fica para depois (recomendo deixar para depois — menos superfície de teste).
- Se houver dados de teste/staging vs produção, garantir que o `.env` certo está sendo modificado (parece haver só um `.env` no repo, mas a flag é build-time, então o deploy precisa rebuildar com a flag ligada).
