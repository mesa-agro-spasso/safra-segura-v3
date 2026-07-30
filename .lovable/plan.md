## Achados da busca (leituras das colunas antigas)

Confirmado por busca no `src/` e por consulta ao banco:

| Local | Leitura hoje |
|---|---|
| `src/pages/Settings.tsx` (card "Quantidade de Contratos por Mercado", ~1330-1400) | `parameters[0].cbot_ticker_count` e `parameters[0].b3_corn_ticker_count`; grava o mesmo valor nas 3 linhas em loop |
| `src/pages/market/MarketBolsa.tsx:66-67` | `cbotQty` / `b3Qty` — usados no `quantity` das chamadas CBOT (linha 117) e B3 (219) e no `slice()` de exibição (417-420) |
| `src/pages/PricingTable.tsx:35-36` | `cbotQty` / `b3Qty` — filtram quantos vencimentos entram na tabela (62-64) |
| `src/hooks/usePricingParameters.ts:28-38` | aceita e grava as duas colunas |
| `src/types/index.ts:175-176` | campos do tipo `PricingParameter` |

Nenhuma outra leitura no frontend; nenhuma nas Edge Functions.

Estado atual no banco (confirmado): `soybean_cbot.ticker_count = 8`, `corn_cbot.ticker_count = 8`, `corn_b3.ticker_count = 6`.

Observação de escopo: `PricingTable.tsx` está no escopo negativo, mas é leitura direta das colunas que serão apagadas. Migro só essas duas linhas (fonte do valor), sem tocar em nada mais da tela — se preferir deixar de fora, avise.

## O que muda

**1. `src/types/index.ts`** — adicionar `ticker_count: number` em `PricingParameter`; remover `cbot_ticker_count` e `b3_corn_ticker_count`.

**2. `src/hooks/usePricingParameters.ts`** — em `useUpdatePricingParameter`: aceitar `ticker_count?: number`, remover as duas chaves antigas. Também remover a escrita de `updated_at` (a tarefa pede para não gravá-lo). Continua sendo só `UPDATE ... eq('id', id)`.

**3. `src/pages/Settings.tsx`** — o card passa a ter três campos, um por linha, no mesmo formato do card "Incremento de Arredondamento": cada campo lê `parameters.find(p => p.id === <id>)?.ticker_count`, valida inteiro entre 1 e 24 e salva com um único `updateParameter.mutateAsync({ id: <id>, ticker_count: val })` — sem loop pelas linhas.

```text
Soja CBOT   → soybean_cbot.ticker_count
Milho CBOT  → corn_cbot.ticker_count
Milho B3    → corn_b3.ticker_count
```

Cada campo mostra "Atual: N" e tem seu próprio botão Salvar e sua própria chave em `values`.

**4. `src/pages/market/MarketBolsa.tsx`** — trocar as duas consts por três, lidas por id:
`sojaQty` (`soybean_cbot`), `cornCbotQty` (`corn_cbot`), `b3Qty` (`corn_b3`). Aplicar cada uma na sua chamada e no seu `slice()`: soja usa `sojaQty` (linhas 117 quando a busca é de soja e 417), milho CBOT usa `cornCbotQty` (117 quando milho e 419), B3 usa `b3Qty` (219 e 420).

**5. `src/pages/PricingTable.tsx`** — mesma troca nas linhas 35-36 e nos `pick('SOJA', …)`, `pick('MILHO_CBOT', …)`, `pick('MILHO', …)`.

Fallbacks passam a ser 8 / 8 / 6, coerentes com o banco.

## Fora de escopo
Sem migração, sem alterar schema, sem Edge Function, sem INSERT/DELETE, sem tocar nos outros cards de Parâmetros nem na geração da tabela de preços.

## Verificação
Typecheck + suíte de testes; busca por `cbot_ticker_count` / `b3_corn_ticker_count` no `src/` deve sobrar apenas nos tipos gerados do Supabase.

## Validação manual (Eduardo)
1. Trocar o milho B3 para 5, salvar, conferir no Supabase que só a linha `corn_b3` mudou.
2. Abrir a tela de Mercado: milho B3 com 5 vencimentos, soja e milho CBOT com 8.
3. Restaurar: soja 8, milho CBOT 8, milho B3 6.
