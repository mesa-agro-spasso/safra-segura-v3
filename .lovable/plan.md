## Reestruturação da aba Mercado

Transformar `/mercado` em container com **subabas Bolsa / Físico**, tendo **Físico como padrão**.

```text
Mercado
├── Físico    (NOVO — padrão)
└── Bolsa     (conteúdo atual de Market.tsx, sem alterações)
```

### 1. Estrutura

- `src/pages/Market.tsx` vira wrapper com `<Tabs>` (default = Físico).
- Conteúdo atual movido para `src/pages/market/MarketBolsa.tsx` (sem mudanças funcionais).
- Nova página: `src/pages/market/MarketFisico.tsx`.

### 2. Aba Físico — tela principal

Tabela com **uma linha por (armazém ativo × commodity)** mostrando o preço físico mais recente:

| Armazém | Commodity | Último preço (R$/sc) | Data ref. | Atualizado há | Badge |
|---|---|---|---|---|---|

- Armazéns com `active = true` e `type = 'ARMAZEM'` (`useActiveArmazens`).
- Commodities: `soybean` e `corn` (CHECK constraint existente).
- Badge freshness padrão Bolsa (`getHoursAgo`): verde ≤ 24h, amarelo ≤ 72h, vermelho > 72h, cinza "sem registro".
- Linha clicável → abre modal de detalhe.

### 3. Cabeçalho — botões de cadastro

- **"Cadastrar preço"** — modal: armazém, commodity, data (default hoje), preço R$/sc, notas. Upsert único.
- **"Cadastrar em massa"** — modal com grid editável de **todos os armazéns ativos × {soja, milho}**, data ajustável no topo (default hoje).
  - **Pré-preenchido com o último preço conhecido** de cada célula (facilita pequenas atualizações).
  - Salvar dispara upsert em lote para todas as células alteradas/preenchidas.

### 4. Modal de detalhe (clique na linha)

- Cabeçalho: armazém + commodity.
- **Gráfico de linha** (recharts) — `reference_date` × `price_brl_per_sack`, ordenado.
- **Tabela histórica**: data, preço, autor, notas.
- **Edição/exclusão de registros antigos disponível para usuários da mesa** (`useAuthorization` — login mesa). Outros usuários veem somente leitura.

### 5. Persistência

`public.physical_prices` já tem o necessário:
- `UNIQUE (warehouse_id, commodity, reference_date)` ✅
- `CHECK commodity IN ('soybean','corn')` ✅
- `CHECK price_brl_per_sack > 0` ✅

Sem migração de schema. Upsert:
```ts
supabase.from('physical_prices').upsert(payload, {
  onConflict: 'warehouse_id,commodity,reference_date'
})
```
Múltiplos registros no mesmo dia → sobrescreve, mantendo histórico em datas distintas.

### 6. Hooks novos — `src/hooks/usePhysicalPrices.ts`

- `useLatestPhysicalPrices()` — `DISTINCT ON (warehouse_id, commodity)` mais recente.
- `usePhysicalPriceHistory(warehouse_id, commodity)` — série completa para modal/gráfico.
- `useUpsertPhysicalPrice()` — mutation única.
- `useUpsertPhysicalPricesBulk()` — mutation em lote.
- `useDeletePhysicalPrice()` — exclusão pontual (gated por mesa).

### 7. Roteamento

Rota `/mercado` inalterada. Subaba sincronizada via `?tab=fisico|bolsa` (default `fisico`).