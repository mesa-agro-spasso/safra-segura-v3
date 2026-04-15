

# Aumentar fontes do PDF + Exportação PNG mobile via html2canvas

## Arquivo: `src/components/ExportPricingModal.tsx` (rewrite completo)

### 1. Instalar dependência
```
npm install html2canvas
```

### 2. Mudanças no formato RadioGroup
- Tipo do state `format`: `'xlsx' | 'pdf'` → `'xlsx' | 'pdf' | 'mobile'`
- Adicionar terceira opção no RadioGroup: "Celular (PNG)"

### 3. Fontes maiores no PDF (função `exportPdf`)
| Elemento | Antes | Depois |
|---|---|---|
| body padding | 32px 28px | 40px 36px |
| h1 | 18px | 26px |
| .meta | 11px | 14px |
| .section-title | 15px | 20px |
| .icon | 18px | 24px |
| .section-subtitle | 12px | 15px |
| th | 11px, pad 10/16 | 14px, pad 12/18 |
| td | 13px, pad 12/16 | 16px, pad 14/18 |

### 4. Nova função `exportMobilePng`
- Dynamic import: `const html2canvas = (await import('html2canvas')).default`
- Gera HTML com layout vertical em cards (1080px width — resolução mobile padrão)
- Fontes grandes: título 36px, commodity header 28px, labels 18px, valores 22px
- Agrupado por commodity com header colorido (verde soja, dourado milho)
- Cada row da tabela vira um card vertical com campos empilhados (label à esquerda, valor à direita)
- Renderiza em iframe oculto → `html2canvas(iframeDoc.body, { width: 1080, scale: 1, backgroundColor: '#fff', useCORS: true })` → blob PNG → download

### 5. handleExport
Adiciona branch `else if (format === 'mobile')` chamando `exportMobilePng`.

## Nenhum outro arquivo é alterado.

