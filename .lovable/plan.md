

# Redesign do PNG mobile — layout clean com fontes grandes

## Problema
O PNG exportado usa fontes pequenas (labels 18px, valores 22px) e layout denso que fica difícil de ler no celular. Os cards ficam grudados sem separação visual clara.

## Mudanças no `exportMobilePng` (src/components/ExportPricingModal.tsx)

### Layout redesenhado
- **Header**: título 44px bold, data 22px — centralizado com mais padding
- **Commodity header**: ícone 40px, label 36px bold, ticker 20px — com border-radius completo e mais padding (28px 36px)
- **Cards por praça**: cada row da tabela vira um card com border-radius 16px, sombra leve (`box-shadow: 0 2px 8px rgba(0,0,0,0.06)`), margin-bottom 20px, separação visual clara
- **Campos dentro do card**:
  - Label: 22px, cor #666, peso 500
  - Valor: 28px, cor #111, peso 700
  - Padding por campo: 18px 32px
  - Separador entre campos: 1px solid #f0f0f0
- **Praça como título do card**: primeira linha do card com fundo sutil (#f8f9fa), fonte 26px bold, destaca a localidade
- **Preço de originação destacado**: última linha com fundo verde claro (#f0fdf4) e valor em verde (#16a34a) para chamar atenção ao preço final
- **Espaçamento geral**: padding do body 48px 40px, gap entre cards 24px

### O que NÃO muda
- Lógica do iframe + html2canvas (width 1080, scale 1)
- downloadBlob helper
- Agrupamento por commodity
- Colunas selecionáveis pelo usuário
- Nenhum outro arquivo alterado

### Resultado esperado
PNG com visual de "stories do Instagram" — limpo, fontes grandes, fácil de ler no celular mesmo com zoom mínimo.

