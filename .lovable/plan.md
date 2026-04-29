# Renderizar ordens executadas na seção "Preço de Entrada" do modal MTM

## Contexto

No modal de detalhe MTM em `src/pages/OperacoesD24.tsx` (em torno da linha 1803), a seção `Section k="entrada"` mostra apenas o placeholder estático:

> "Ver pernas executadas em 'Ordens Vinculadas' no detalhe da operação."

Os dados reais já estão disponíveis em `d24Orders` (carregado via `useQuery` na linha 567) e podem ser filtrados por `operation_id` igual a `detailResult.operation_id`, excluindo ordens de fechamento (`is_closing`).

`Badge` já está importado (linha 34).

## Mudança

**Arquivo:** `src/pages/OperacoesD24.tsx` (apenas este arquivo)
**Localização:** linhas 1803–1805, seção `<Section k="entrada" label="Preço de Entrada (Executado)">`

Substituir o `<p>` placeholder por um bloco que:

1. Filtra `d24Orders` por `operation_id === detailResult.operation_id` e `!o.is_closing`.
2. Se vazio: mostra "Nenhuma ordem vinculada.".
3. Caso contrário: renderiza um card por ordem com:
   - Badges: `instrument_type`, `direction`, `currency`.
   - Grid 2-col com campos condicionais: `ticker`, `contracts`, e por tipo:
     - **futures**: `price` formatado (USD/bu ou BRL/sc).
     - **ndf**: `ndf_rate` em BRL/USD.
     - **option**: `option_type`, `strike`, `premium`.

## Detalhes técnicos

- Usar `(d24Orders ?? []).filter(...)` para segurança contra undefined.
- Tipagem `any` nas ordens (mesmo padrão usado no restante do arquivo).
- Formatação numérica: `toFixed(4)` para preços/taxas; `toLocaleString('pt-BR', { maximumFractionDigits: 4 })` para contratos.
- Classes seguem o design system (`text-xs`, `text-muted-foreground`, `border rounded p-2`, `font-mono` para ticker).
- Nenhuma alteração em hooks, tipos, ou outros arquivos.
