# Plano — Atualizar `src/pages/ArmazensD24.tsx` para D24

Apenas um arquivo afetado: `src/pages/ArmazensD24.tsx`. Sem novos hooks, Edge Functions, ou alterações na aba Configuração.

## Mudanças

### 1. Constantes (topo do arquivo)
- `ACTIVE_STATUSES`: incluir `ACTIVE` e `PARTIALLY_CLOSED`.
- `STATUS_BADGE`: adicionar entradas `ACTIVE`, `PARTIALLY_CLOSED`, `CLOSED`, `CANCELLED`.
- `STATUS_ORDER`: adicionar `ACTIVE: 3`, `PARTIALLY_CLOSED: 4`, `CLOSED: 98`, `CANCELLED: 99`.

### 2. `useMemo` de `rows` (cálculo por armazém)
Após o cálculo de `breakevenMedio`, adicionar:
- `mtmPerSackMedio` — média ponderada por volume de `snap.mtm_per_sack_brl`.
- `fisicoAlvoMedio` — média ponderada de `(physical - mtmPerSack + 2.0) * (1 + executionSpread)`.
- Substituir o `mix` antigo pela nova versão D24: `{ rascunho, active, partial, outros }`.
- Retornar `mtmPerSackMedio` e `fisicoAlvoMedio` no objeto.

### 3. Aba Posição — Cards de resumo consolidado
Adicionar antes do `<Card>` da tabela um grid de 4 cards (Armazéns Ativos, Volume Total, MTM Total, MTM por Saca) usando IIFE com totais derivados de `rows`.

### 4. Tabela da aba Posição
- Adicionar duas colunas após "Break-even médio": `MTM/sc` e `Físico Alvo`.
- Adicionar células correspondentes em cada linha, com cor verde/vermelho para `mtmPerSackMedio`.
- Atualizar `colSpan` da linha vazia de 8 para 10.

### 5. Badges de status mix
Substituir os badges antigos (`rascunho`, `em_aprovacao`, `hedge`, `outros`) pelos novos (`rascunho`, `active`, `partial`, `outros`) seguindo o spec (verde para Ativa, laranja outline para Parcial).

## Restrições mantidas
- Apenas `src/pages/ArmazensD24.tsx`.
- Aba Configuração (`ConfigCard` e tudo abaixo) não é tocada.
- Sheet de detalhe não é tocado.
- Nenhum hook ou import novo necessário (usa Card/CardContent já importados).
