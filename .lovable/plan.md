# Lote 2B — Block Trade: Conexão com a API

Único arquivo modificado: `src/pages/ArmazensD24.tsx`. Sem persistência (nenhum INSERT). Modal de execução continua placeholder.

## Mudanças

### 1. Imports (topo do arquivo)
Adicionar:
- `useQuery` de `@tanstack/react-query`
- `supabase` de `@/integrations/supabase/client`
- `useAuth` de `@/contexts/AuthContext`
- `toast` de `sonner` (verificar se já existe)
- `type { AllocateBatchResponse, ClosingAllocationProposalOut }` de `@/types/d24`

### 2. Estado tipado e mutável (linhas 209, 211)
- `btProposals` passa a ser `useState<AllocateBatchResponse | null>(null)`
- `btLoading` passa a ter setter: `const [btLoading, setBtLoading] = useState(false)`

### 3. Hook de auth no componente
Adicionar `const { user } = useAuth();` junto aos demais hooks no topo de `ArmazensD24`.

### 4. Query `btD24Orders`
Inserir após o `useMemo` de `btLatestMtmDate` (~linha 254): busca `orders` para todas as operações ACTIVE/PARTIALLY_CLOSED do warehouse+commodity selecionados, ordenadas por `executed_at` ASC. `enabled` somente quando ambos selecionados.

### 5. Handler `handleBtAllocate`
Inserir logo após a query acima. Fluxo:
1. Validar `btWarehouse`, `btCommodity`, `btExchange`, `btVolume`, `btStrategy`; volume > 0.
2. Filtrar operações elegíveis (ACTIVE/PARTIALLY_CLOSED do warehouse+commodity). Se vazio → `toast.error("Nenhuma operação ativa…")`.
3. `setBtLoading(true)`, `setBtProposals(null)`, `setBtWarnings([])`.
4. Montar `operationSummaries` mapeando cada op → `{ operation_id, display_code, volume_sacks, mtm_total_brl, existing_orders[] }`. As orders vêm de `btD24Orders` filtradas por `operation_id`, e cada uma é normalizada para `OrderIn` (campos opcionais com `?? undefined`, `is_closing ?? false`, `is_counterparty_insurance ?? false`).
5. `supabase.functions.invoke('api-proxy', { body: { endpoint: '/closing-batches/allocate', body: { warehouse_id, commodity, exchange, target_volume_sacks, strategy, operations: operationSummaries } } })`.
6. Em erro → `toast.error('Erro ao calcular proposta: ' + msg)`. Em sucesso → setar `btWarnings` (se houver) e `btProposals`.
7. `finally` → `setBtLoading(false)`.

### 6. Conectar botão "Calcular Proposta" (linha ~667)
Trocar o `onClick` placeholder por `onClick={handleBtAllocate}`. (O botão já tem `disabled` correto e mostra spinner via `btLoading`.)

### 7. Renderizar tabela de propostas (bloco `{btProposals && (...)}` ~linha 710)
Substituir o placeholder atual por:
- **Cabeçalho de resumo**: `{proposals.length} operação(ões) · estratégia {strategy_used}` à esquerda, `Total: {total_volume_allocated_sacks} sc` à direita.
- **Tabela** com colunas: Operação (`display_code`), Disponível (sc), A fechar (sc, até 4 casas), MTM usado (`fmtBrl` ou `—` se null/undefined).
- **Banner amarelo** por proposal cujo `allocation_reason` contenha "Warning", listando `⚠ {display_code}: {reason}`.
- **Botão "Ajustar e Executar"** com `onClick={() => setBtExecutionOpen(true)}` (modal já existe e continua placeholder).

## Regras observadas
- Zero cálculo financeiro no front: alocação 100% via API.
- Sem catch silencioso: todos os erros viram `toast.error` explícito.
- Nenhum outro arquivo é modificado.
- Nenhum INSERT é feito; modal de execução permanece placeholder.

## Validação manual (após aplicar)
Executar o checklist dos 8 itens da tarefa: spinner no clique, render correto da tabela, total no cabeçalho, ausência de warnings em PROPORTIONAL, banner em MAX_PROFIT/LOSS sem MTM, `toast.error` em volume excedido e em ausência de ops ativas, abertura do modal placeholder.
