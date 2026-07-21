## Objetivo
Melhorar a exportação da Tabela de Preços: consertar o CSV, adicionar filtro de commodity em pills WYSIWYG, e criar um novo formato "Tabela formatada" (PNG apresentável com logo Grupo Spasso).

## Escopo (apenas UI/exportação)

### 1. `src/pages/PricingTable.tsx` — filtro pills de commodity
- Adicionar acima da tabela um grupo de botões pills: **Todas | Soja | Milho**, seleção única.
- Estado novo `commodityPill: 'all' | 'soybean' | 'corn'` (default `'all'`), gerado dinamicamente a partir das commodities presentes nos snapshots (escala para novas commodities).
- A lista filtrada da tabela passa a considerar essa pill (mantendo os filtros existentes de praça/ticker como estão, em dropdown).
- Passar as **linhas já filtradas** e a commodity ativa para o `ExportPricingModal` (WYSIWYG).

### 2. `src/components/ExportPricingModal.tsx` — 3 mudanças

**a) CSV real:**
- Renomear label "Excel (.xlsx)" → "CSV (.csv)", chave `format='csv'`.
- Manter a lógica atual (separador `;`, BOM UTF-8, vírgula decimal, headers com unidade) — a extensão do arquivo já é `.csv`; apenas a label mentia.

**b) Colunas disponíveis (sem Safra):**
- Confirmar que `ALL_COLUMNS` cobre: Praça, Commodity, Recepção, Pagamento, Venda, Basis Alvo, Futuros (BRL), Câmbio, Preço Originação (mais Ticker, Preço c/ Seguro, Desconto, Trade Date, Benchmark já existentes). **Não** adicionar coluna Safra.

**c) Novo formato "Tabela formatada" (PNG):**
- Novo radio `format='formatted'` com label "Tabela formatada (PNG)".
- Recebe do `PricingTable` a commodity ativa da pill.
- Set default de colunas quando este formato está selecionado: **Praça, Commodity, Recepção, Pagamento, Venda, Preço Originação**. As demais (basis, futuros, câmbio, etc.) ficam desmarcáveis mas OFF por padrão.
- Renderiza HTML dedicado em iframe off-screen e converte com `html2canvas` (já usado no formato "mobile"):
  - Topo: `<img src="/logo-spasso.png">` à esquerda, título centralizado, data à direita.
  - Título: `PREÇOS ORIGINAÇÃO — {COMMODITY}` quando a pill é Soja/Milho; `PREÇOS ORIGINAÇÃO` quando a pill é "Todas". Sem sufixo "SAFRA …".
  - Cabeçalho colorido (verde primary do app), linhas zebradas, tipografia limpa. Largura ~1200px.
  - Nome do arquivo: `precos_originacao_{commodity|todas}_{YYYYMMDD}.png`.

**d) WYSIWYG:**
- O modal já recebe `rows` — como o `PricingTable` passará as linhas já filtradas pela pill, todos os formatos (CSV, PDF, Mobile, Formatada) exportam apenas o que está na tela. Nenhum toggle novo no modal.

### 3. Assets
- Reutilizar `/logo-spasso.png` já servido em `public/` (mesmo que a sidebar usa). Sem novos assets.

## Fora de escopo
- Sem campo UF, sem coluna Safra, sem novas colunas.
- Sem toggle "por commodity" no modal (a pill resolve).
- Sem alteração em geração de preço, snapshots, RLS ou schema.
- Sem mexer nos formatos PDF/Mobile existentes além de eles respeitarem o filtro (herdado do `rows` já filtrado).

## Riscos
- `html2canvas` já é dependência (usado em "Celular"), sem custo novo.
- CSVs antigos com extensão `.csv` (a atual já é `.csv`, só a label mentia): usuários não perdem nada.

## Verificação
- Manual: gerar preços, filtrar por Soja → CSV/PDF/PNG/Formatada saem só com soja; alternar para Todas → todos aparecem; conferir logo, título e colunas default no PNG formatado.