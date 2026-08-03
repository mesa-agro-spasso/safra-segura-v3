# Remover publicação da Tabela de Preços em página pública

## Achado sobre `supabase/functions/publish-pricing-table/`
A pasta **existe** neste repositório (`supabase/functions/publish-pricing-table/index.ts`), com a URL do Worker `https://spasso-public-table-api.mesaagro.workers.dev/publish` e leitura do secret `PUBLISH_KEY`. Será apagada por inteiro.

## Arquivos tocados

1. `src/components/PublishPricingModal.tsx` — **apagado**. Contém todo o recurso: URL pública, chamada `supabase.functions.invoke('publish-pricing-table')`, estados de loading, toasts de sucesso/erro e os tipos de payload `{ columns, rows }` usados só aqui.

2. `src/pages/PricingTable.tsx` — remover:
   - o import do modal (linha 18);
   - o estado `publishOpen` (linha 43);
   - o botão "Publicar" do cabeçalho (com o ícone `Globe`, removido do import de ícones se não for usado em outro lugar);
   - a renderização `<PublishPricingModal ... />` (linha 587).
   Nada mais muda: geração, filtros, seguro, exportação e exibição ficam intactos.

3. `supabase/functions/publish-pricing-table/` — pasta removida por inteiro.

## Não será tocado
`supabase/functions/api-proxy/`, o cockpit (`src/pages/Cockpit.tsx`, `CockpitShell.tsx`, `MarketCard.tsx` — o "Publicar" de lá é outro recurso e não chama a Edge Function), nenhuma migration, coluna ou tabela.

## Observação
O secret `PUBLISH_KEY` continua registrado no projeto Supabase; posso removê-lo depois, quando a Edge Function deployada for desativada manualmente — como você já previu na sequência.

## Verificação
- `rg "publish-pricing-table|PUBLISH_KEY|spasso-public-table" .` retorna zero ocorrências no repositório.
- Typecheck e build sem erro.
