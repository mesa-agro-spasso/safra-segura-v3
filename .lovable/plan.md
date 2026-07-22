## Objetivo
Adicionar botão "Publicar" na Tabela de Preços que envia as linhas visíveis (respeitando o filtro de commodity) para o Worker Cloudflare, autenticado com o secret `PUBLISH_KEY`.

## Arquitetura — por que precisa de Edge Function

`PUBLISH_KEY` é um secret runtime (Supabase Edge Function Secret). O frontend não tem — e não deve ter — acesso a ele: qualquer valor embutido no bundle Vite vira público. Portanto o fluxo é:

```text
PricingTable → PublishModal → supabase.functions.invoke('publish-pricing-table')
                                          ↓
                              Edge Function lê PUBLISH_KEY
                                          ↓
                              POST worker Cloudflare /publish
```

## Mudanças

### 1. Nova Edge Function `supabase/functions/publish-pricing-table/index.ts`
- Recebe `{ columns, rows }` do frontend.
- Lê `Deno.env.get('PUBLISH_KEY')`.
- Faz `POST https://spasso-public-table-api.mesaagro.workers.dev/publish` com header `X-Publish-Key` e o body repassado.
- Devolve status/erro do worker ao frontend.
- CORS liberado (padrão do projeto). Não requer JWT verificado — mas exige usuário autenticado no client (invoke já anexa o token).

### 2. Novo `src/components/PublishPricingModal.tsx`
Espelha o layout do `ExportPricingModal` mas isolado:
- Props: `open`, `onOpenChange`, `rows`, `warehouseMap`, `insuranceMap`, `activeCommodity`.
- Reusa `ALL_COLUMNS` do modal de export (extrair para `src/lib/pricingColumns.ts` para não duplicar).
- Default de colunas: Praça, Commodity, Recepção, Pagamento, Venda, Preço Originação.
- Mostra resumo "N linhas serão publicadas" (contagem já filtrada por commodity, vinda de `rows`).
- Botão "Publicar" → monta payload:
  - `columns`: `[{ key, label }]` só das selecionadas.
  - `rows`: cada linha um objeto `{ [key]: valorFormatado }`. Datas em `DD/MM/AAAA`, preços em `R$ 0,00` (mesma formatação do CSV/PNG).
  - Garante presença de `commodity` e `praca` sempre que essas colunas estiverem selecionadas (o worker usa para filtros).
- Chama `supabase.functions.invoke('publish-pricing-table', { body })`.
- Toast de sucesso com link clicável para `https://spasso-public-table.pages.dev`.
- Toast de erro com mensagem retornada.

### 3. `src/pages/PricingTable.tsx`
- Adicionar botão "Publicar" ao lado de "Exportar" (mesmo estilo, ícone `Upload` ou `Globe`).
- Estado `publishOpen` e render do `<PublishPricingModal>` recebendo `activeCommodity` e as mesmas `rows` já filtradas passadas hoje ao export.

### 4. `src/lib/pricingColumns.ts` (novo, pequeno refactor)
Extrair `ALL_COLUMNS`, `FORMATTED_DEFAULT_KEYS`, helpers de formatação (data, preço, praça) hoje dentro do `ExportPricingModal` para uso compartilhado. `ExportPricingModal` passa a importar do novo módulo — comportamento inalterado.

## Fora de escopo
- Modal de exportação existente (só passa a importar helpers do novo módulo, sem mudança de UI/comportamento).
- Geração de preços, snapshots, schema.
- Hardcode do `PUBLISH_KEY` no frontend.

## Passos de implementação
1. Criar `src/lib/pricingColumns.ts` e migrar `ExportPricingModal` para importar de lá.
2. Criar `supabase/functions/publish-pricing-table/index.ts` e deployar.
3. Criar `src/components/PublishPricingModal.tsx`.
4. Adicionar botão + estado no `PricingTable.tsx`.
5. Testar: publicar com filtro "Soja" ativo, conferir toast e site público.