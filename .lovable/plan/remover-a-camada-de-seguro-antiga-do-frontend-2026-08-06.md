# Remover a camada de seguro antiga do frontend

O preço que a API devolve (`origination_price_brl`) já inclui o custo do seguro. Tudo que o frontend aplicava por cima vira desconto duplicado e sai.

## O que será removido

1. **Modal de seguro** — apaga `src/components/InsuranceLayerModal.tsx` (único lugar que chama `POST /pricing/insurance-layer`).
2. **Hook** — apaga `src/hooks/useInsuranceSnapshots.ts` (leitura e gravação em `insurance_snapshots`).
3. **Tabela de Preços** (`src/pages/PricingTable.tsx`):
   - botão "Aplicar Seguro" e o estado que abre o modal;
   - coluna "Preço c/ Seguro" (cabeçalho e célula);
   - bloco "Seguro aplicado" no painel de detalhe;
   - imports e o `insuranceMap` passado ao modal de exportação.
4. **Exportação** (`src/components/ExportPricingModal.tsx`):
   - coluna `insurance_adjusted_price_brl` em todos os formatos (CSV, PDF, PNG mobile, PNG formatada);
   - prop `insuranceMap`, tipo `InsuranceMap` e o parâmetro `im` das funções de export.

## O que fica intocado

- Tabela `insurance_snapshots` no banco (sai por SQL depois).
- Edge Function `api-proxy`.
- Campos `is_counterparty_insurance` das telas de operações/ordens — são hedge de contraparte, sem relação com esta camada.
- Campo legado `insurance_json` em `src/types/index.ts` — só tipagem de coluna do banco, não afeta preço exibido.
- Qualquer outro cálculo ou coluna da tabela de preços.

## Resultado

O preço exibido e exportado passa a ser exatamente o `origination_price_brl` da API, sem ajuste local, e nenhuma chamada a `/pricing/insurance-layer` resta no código.
