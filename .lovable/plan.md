## Objetivo

Adicionar uma nova subaba **Histórico** em Mercado, com 3 abas internas: **Bolsa**, **Físico** e **Terceiros** (esta última só placeholder por enquanto).

## Estrutura de navegação

```text
Mercado
├── Físico        (já existe)
├── Bolsa         (já existe)
└── Histórico     (nova)
    ├── Bolsa     (implementada)
    ├── Físico    (implementada)
    └── Terceiros (placeholder "Em breve")
```

URL via query param: `?tab=historico&sub=bolsa|fisico|terceiros`.

## Histórico → Bolsa

Fonte: tabela `market_data_history` (já populada — soja/milho CBOT por ticker, e USD/BRL).

Layout:
- Seletor de **commodity** (Soja CBOT / Milho CBOT) no topo.
- Seletor de **ticker** (dropdown) com os tickers disponíveis daquela commodity (ex.: ZSK26, ZSN26… para soja; ZCK26, ZCN26… para milho).
- Filtro de período: últimos 30d / 90d / 1 ano / tudo.
- **Gráfico** de linha (recharts via `ChartContainer`) com `reference_date` × `price`.
- **Tabela** abaixo com colunas: Data, Preço, Moeda, Unidade, Vencimento, Fonte. Ordenada por data desc, paginada client-side (ou scroll com max-height).

Sem cálculos no frontend — só leitura e renderização.

## Histórico → Físico

Fonte: tabela `physical_prices` (todos os registros, não só o mais recente como em Físico principal).

Layout:
- Filtros opcionais no topo: **Commodity** (Soja/Milho/Todos) e **Praça/Armazém** (todos os ativos + "Todos"), ambos com default "Todos".
- **Tabela única** com colunas: Data ref., Praça (display_name), Commodity, Preço (R$/sc), Cadastrado em, Notas. Ordenada por `reference_date` desc.

Sem gráfico nesta primeira versão (preços físicos têm pouca densidade temporal por enquanto).

## Histórico → Terceiros

Apenas card com mensagem "Em breve". Sem lógica.

## Detalhes técnicos

Arquivos a criar:
- `src/pages/market/MarketHistorico.tsx` — wrapper com sub-Tabs (sub-tab vem de `?sub=`).
- `src/pages/market/historico/HistoricoBolsa.tsx`
- `src/pages/market/historico/HistoricoFisico.tsx`
- `src/pages/market/historico/HistoricoTerceiros.tsx`
- `src/hooks/useMarketHistory.ts` — `useMarketHistoryTickers(commodity)` e `useMarketHistory(ticker, sinceDays)`. Usa `supabase.from('market_data_history')`.
- `src/hooks/usePhysicalPriceHistoryAll.ts` — query de todos os `physical_prices` com filtros opcionais (warehouse_id, commodity).

Arquivos a editar:
- `src/pages/Market.tsx` — adicionar terceira `TabsTrigger` "Histórico" + `TabsContent`. Manter compatibilidade com `?tab=fisico|bolsa`.

Padrões mantidos:
- Cores via tokens do design system, sem cores hardcoded.
- Componentes shadcn (`Tabs`, `Card`, `Table`, `Select`, `ChartContainer`).
- Sem cálculos financeiros no frontend (regra do projeto).
- Cliente `supabase` do `@/integrations/supabase/client` (respeita ambiente staging/production automaticamente).

## Fora de escopo
- Aba Terceiros funcional.
- Edição/exclusão de histórico.
- Comparação entre tickers no mesmo gráfico.
- Export CSV (pode ser adicionado depois se útil).
