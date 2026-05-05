# Lote 2A — Block Trade (estrutura visual)

Implementação puramente visual — sem chamadas de API, sem handlers funcionais. Apenas estrutura, layout e estado local de UI.

## 1. Fix de tipos

### `src/types/index.ts`
Adicionar dois campos em `OperationWithDetails`:
- `display_code: string | null`
- `exchange: string | null`

### `src/hooks/useOperations.ts`
Em `useOperationsWithDetails`, incluir `display_code` e `exchange` no `select`:
```
.select('*, display_code, exchange, warehouses(display_name), pricing_snapshots(...)')
```

## 2. `src/pages/ArmazensD24.tsx`

### 2.1 Imports adicionais
- `useEffect` em `react`
- `AlertTriangle` em `lucide-react`
- `Dialog, DialogContent, DialogHeader, DialogTitle` de `@/components/ui/dialog`
- `Input` de `@/components/ui/input`
- `Label` de `@/components/ui/label`
(`useNavigate` já existe.)

### 2.2 Estado local (dentro do componente `ArmazensD24`)
- `btWarehouse, btCommodity, btExchange, btVolume, btStrategy`
- `btProposals` (null), `btWarnings` ([]), `btLoading` (false), `btExecutionOpen` (false)

### 2.3 Effects
- Derivação automática de `btExchange` a partir de `btCommodity` (`soybean → cbot`, `corn → b3`).
- Reset de `btProposals` e `btWarnings` quando `btWarehouse` ou `btCommodity` mudam.

### 2.4 Helper local `BtStatusDot`
Componente que recebe `date` + `label`, calcula horas decorridas e retorna um pequeno indicador colorido (verde <12h, amarelo <24h, vermelho ≥24h) com timestamp formatado em pt-BR.

### 2.5 `btLatestMtmDate` (useMemo)
Para o `btWarehouse` selecionado, achar a `calculated_at` mais recente em `latestByOpId` entre as operações daquele armazém.

### 2.6 Substituir o conteúdo do `<TabsContent value="block_trade">` (linhas ~500–512)

Layout em grid 2 colunas (md):

**Painel esquerdo — "Configurar Batch"** (Card):
- Linha de status MTM (BtStatusDot) acima do grid quando `btLatestMtmDate` existe
- Select Armazém (lista `warehouses`)
- Select Commodity (Soja CBOT / Milho B3) — desabilitado sem armazém
- Campo read-only "Benchmark (derivado)" mostrando `btExchange.toUpperCase()` quando preenchido
- Input numérico Volume (sacas) — desabilitado sem commodity
- Select Estratégia (Proporcional / MAX_PROFIT / MAX_LOSS) com texto explicativo abaixo conforme seleção
- Link "Ver MTM das operações →" → `navigate('/operacoes-mtm')`
- Botão "Calcular Proposta" — desabilitado se algum campo vazio (sem onClick funcional ainda — TODO Lote 2B)

**Painel direito — "Proposta de Alocação"** (Card):
- Estado vazio quando `!btProposals`: ícone `Calculator` + texto orientativo
- Bloco de warnings (com `AlertTriangle`) quando `btWarnings.length > 0`
- Quando `btProposals` existir: placeholder textual + botão "Ajustar e Executar" → abre modal

### 2.7 Modal placeholder `BlockTradeExecutionModal`
Definido no mesmo arquivo, antes do `export default`. Recebe `open` e `onClose`. Conteúdo: ícone + texto "Modal de execução — implementação completa no Lote 2C" + botão Fechar. Renderizado no fim do JSX raiz de `ArmazensD24`.

## Critérios de aceitação
1. Aba "Block Trade" abre sem erros de console.
2. Selecionar armazém habilita commodity.
3. Selecionar commodity preenche benchmark (read-only).
4. Botão "Calcular Proposta" desabilitado enquanto faltarem campos.
5. Link "Ver MTM das operações →" navega para `/operacoes-mtm`.
6. `BtStatusDot` aparece com cor correta quando há MTM no armazém.
7. Clicar "Ajustar e Executar" abre modal placeholder; fechar funciona.
8. Abas Posição e Configuração continuam funcionando.

Nada além dos 3 arquivos listados será modificado.
