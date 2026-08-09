# Quatro ajustes independentes

## 1. Allowlist do api-proxy

Remover `'/pricing/insurance-layer'` de `ALLOWED_POST_ENDPOINTS` em `supabase/functions/api-proxy/index.ts`. O endpoint não existe mais no backend. Nenhuma outra entrada muda. O deploy sai deste arquivo — nada é editado pelo Dashboard.

## 2. Card do dólar compacto na aba Futuros

Hoje `FxQuoteCard` com `compact` ainda renderiza o card inteiro (título, borda, padding) e mais o texto explicativo passado por `footnote`.

Na aba Futuros o modo compacto passa a ser uma faixa fina, sem `Card`: cotação, badge de frescor e botão "Atualizar câmbio" numa linha só, alinhados à direita o botão. Sem título, sem nota explicativa (a chamada em `MarketFuturos.tsx` deixa de passar `footnote`).

A aba Dólar não muda: continua o card completo, com edição manual e nota.

## 3. Busca — `insurance_json` (relatório, sem alteração)

Resultado da varredura no frontend e nas funções:

- `src/types/index.ts:60` — campo opcional `insurance_json?` na interface `PricingSnapshot`, marcado como legado. Só tipo, não escreve nada.
- `supabase/schema/20260730_snapshot.sql:296` — a definição da coluna no snapshot de schema.

Nenhum lugar do frontend **lê** o valor e nenhum **escreve** a coluna: nenhum insert de `pricing_snapshots` inclui `insurance_json` (o insert do cockpit e o do modal de geração não a mencionam). A gravação hoje só funciona porque a coluna tem `DEFAULT '{}'`.

Conclusão: dropar a coluna é seguro pelo lado do frontend. Depois do drop, o campo em `types/index.ts` deve sair junto — não faz parte desta tarefa.

## 4. Rótulos do modal de custos

Em `src/pages/PricingTable.tsx` (linhas 468–471), trocar só o texto:

- `Purchased basis` → `Basis comprado`
- `Breakeven basis` → `Basis de equilíbrio`
- `Purchased basis (USD)` → `Basis comprado (USD)`
- `Breakeven basis (USD)` → `Basis de equilíbrio (USD)`

Nenhum valor, chave de leitura ou formatação muda.
