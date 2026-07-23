
## Objetivo

Padronizar o vocabulário de unidades em `market_data`: `price` sempre canônico, `price_unit` em snake_case, e novos campos `raw_price` / `raw_unit` guardando o que o provedor entregou. Ajustar rótulos de exibição do MILHO_CBOT para o novo canônico.

## Estado alvo

| commodity | price | price_unit | raw_price | raw_unit |
|---|---|---|---|---|
| SOJA | `price_usd_bushel` | `usd_per_bushel` | `price_usd_cents_bushel` | `cents_per_bushel` |
| MILHO_CBOT | `price_usd_bushel` | `usd_per_bushel` | `price_usd_cents_bushel` | `cents_per_bushel` |
| MILHO (B3, manual) | valor digitado | `brl_per_sack` | valor digitado | `brl_per_sack` |
| FX (USD/BRL) | `spot_usd_brl` | `brl_per_usd` | `null` | `null` |

Invariante: `raw_price` e `raw_unit` são **sempre** ambos preenchidos ou ambos `null`.

## Mudanças

### 1. `src/hooks/useMarketData.ts` — `useUpsertMarketData`
Acrescentar `raw_price?: number | null` e `raw_unit?: string | null` na assinatura e propagar no `.upsert`.

### 2. `src/pages/market/MarketBolsa.tsx` — persistência

- `persistFX`: `price_unit: 'brl_per_usd'`, `raw_price: null`, `raw_unit: null`.
- `persistSoybean`: `price_unit: 'usd_per_bushel'`, `raw_price: s.price_usd_cents_bushel`, `raw_unit: 'cents_per_bushel'`.
- `persistCornCBOT` (**mudança de semântica**): incluir `price_usd_bushel: number` no tipo `CornCBOTQuote` (backend já entrega) e passar a gravar `price: c.price_usd_bushel`, `price_unit: 'usd_per_bushel'`, `raw_price: c.price_usd_cents_bushel`, `raw_unit: 'cents_per_bushel'`.
- `persistCornB3` (insert de tickers novos vindos da API, sem preço): `price_unit: 'brl_per_sack'`, `raw_price: null`, `raw_unit: null`. Par raw_* fica nulo até o usuário digitar.
- `handleB3Save` (usuário digita preço B3): `price_unit: 'brl_per_sack'`, `raw_price: price`, `raw_unit: 'brl_per_sack'`.
- `handleManualSave` (edição manual de USD/BRL, SOJA, MILHO_CBOT): mantido como está — sobrescreve `price`, não toca `raw_*`. Adicionar comentário curto explicando.

### 3. Rótulos de unidade — MILHO_CBOT muda de ~465 para ~4,65

Cada ponto que hoje exibe rótulo fixo de unidade da coluna de preço do MILHO_CBOT:

| Arquivo | Linha | Atual | Novo |
|---|---|---|---|
| `src/pages/market/MarketBolsa.tsx` | 543 | `Preço (¢/bu)` | `Preço (USD/bu)` |

Outros pontos varridos, sem mudança necessária:
- `MarketBolsa.tsx:495` — Soja já é `Preço (USD/bu)`.
- `HistoricoBolsa.tsx:162` — coluna "Unidade" renderiza `r.price_unit` do banco (dinâmico); o novo valor `usd_per_bushel` aparece automaticamente. Sem hardcode a trocar.
- `helpContent.ts:151` — texto genérico de docs já em `USD/bu`.
- `OperacoesD24.tsx`, `OrdensD24.tsx`, `ArmazensD24.tsx` — usam `USD/bushel` / `USD/bu` para futuros CBOT (já corretos, não tocam MILHO_CBOT com rótulo de cents).

Se durante a implementação surgir outro literal `cents` / `¢/bu` / `US¢` ligado a MILHO_CBOT, trocar por `USD/bu` na mesma passada.

### 4. Fora de escopo (confirmado pelo usuário)
- `GeneratePricingModal.tsx` e payloads de pricing.
- Conversão de cents no backend (já validada).

## Consumidores auditados de `market_data.price` / `price_unit`

**`price`:**
- `MarketBolsa.tsx:95,127,190` — mapas de exibição / FX.
- `MarketBolsa.tsx:351,353` — filtros SOJA / MILHO_CBOT (`!= null`).
- `MarketBolsa.tsx:467,471,508,515,553,557,621,626` — render em tabela (MILHO_CBOT passa a exibir ~4,65; rótulo do cabeçalho ajustado no item 3).
- `GeneratePricingModal.tsx:40,68,92,183` — FX + envio ao backend (fora do escopo por instrução).

**`price_unit`:**
- `HistoricoBolsa.tsx:162` — exibe dinamicamente, aceita qualquer valor.
- `blockTradeExecution.test.ts:15,33` — fixtures `null`.

Nenhum consumidor faz string-match em `'cents/bushel'` ou `'BRL/sack'`.

## Verificação
1. "Atualizar Dados" → conferir no Supabase que SOJA, MILHO_CBOT e USD/BRL saem com `price_unit` novo e `raw_*` conforme tabela.
2. Salvar preço B3 manual → `price_unit='brl_per_sack'`, `raw_price=price`, `raw_unit='brl_per_sack'`. Ticker B3 recém-inserido pela API (sem preço) → `raw_price` e `raw_unit` ambos `null`.
3. Cabeçalho da tabela MILHO_CBOT lê `Preço (USD/bu)` e valores aparecem em ~4,65.
4. `tsgo` limpo.
