## Lote 2C-2a — Block Trade: Lista, Rascunho, Assinatura

Modificar **apenas** `src/pages/ArmazensD24.tsx`. Sem mudanças em outros arquivos, sem migrations, sem INSERT em `orders`.

### Mudanças

**1. Imports (topo do arquivo)**
- Adicionar (se faltar): `useQueryClient` de `@tanstack/react-query`, `DialogFooter` de `@/components/ui/dialog`, `Textarea` de `@/components/ui/textarea`, ícones `List, Plus, Send, X, ChevronRight` de `lucide-react`.

**2. Estado novo (junto aos estados Block Trade existentes, linha ~215)**
```ts
const [btView, setBtView] = useState<'list'|'new'>('list');
const [btSelectedBatch, setBtSelectedBatch] = useState<any>(null);
const [btCancelTarget, setBtCancelTarget] = useState<any>(null);
const [btCancelReason, setBtCancelReason] = useState('');
const [btSubmitting, setBtSubmitting] = useState(false);
const queryClient = useQueryClient();
```

**3. Query `warehouse-closing-batches`** (após `handleBtAllocate`, ~linha 380)
- Select `*, warehouses(display_name)` ordenado por `created_at desc`.

**4. Handlers novos**
- `handleBtSaveDraft` — calcula `oldestMtm` a partir de `latestByOpId[op].calculated_at`, deriva `mtm_staleness_warning` (null/<4h, yellow/<24h, red/>=24h), INSERT em `warehouse_closing_batches` com `status='DRAFT'`, `created_by=user.id`, `allocation_snapshot=btProposals.proposals`. Toast, invalidate, voltar para lista, limpar form.
- `handleBtSendForSignature(batch)` — para cada `proposal` em `allocation_snapshot`, INSERT em `signatures` com `flow_type='CLOSING'`, `batch_id`, `role_used='mesa'`, `decision='APPROVE'`. Invalida queries `warehouse-closing-batches`, `signature-events`, `pending-approvals-count`.
- `handleBtCancel` — UPDATE `warehouse_closing_batches` `status='CANCELLED'` + `cancellation_reason`. Toast, invalidate, fecha dialog.
- Todos com try/catch → `toast.error`, e `setBtSubmitting`.

**5. Conteúdo da aba Block Trade (TabsContent value="block-trade")**
Substituir bloco entre linhas ~700–890 por:
- Header com toggle: badge "Block Trades" / "Novo Batch", botão "← Voltar" em modo new, botão "Novo Batch" em modo list.
- **Sub-view `list`**: Card com tabela de `btBatches` (Data / Armazém / Commodity / Volume / Estratégia / Status / Ações). Status badges (Rascunho amarelo, Executado verde, Cancelado outline). Linha clicável → `setBtSelectedBatch`. Ações em DRAFT: "Enviar p/ Assinatura" (Send), "Executar" (abre modal placeholder pré-preenchendo `btProposals` a partir do snapshot), "Cancelar" (X) → abre dialog. Empty state com ícone List quando lista vazia.
- **Sub-view `new`**: Conteúdo atual do formulário + resultado, mais dois botões finais: "Salvar Rascunho" (disabled se `btSubmitting`) e "Ajustar e Executar" (já existe).

**6. Sheet de detalhe do batch** (após o `Sheet` de warehouse, antes do Dialog de execução, ~linha 1005)
- `Sheet` controlada por `btSelectedBatch`. Mostra header com nome do armazém + status badge, dois cards com Volume Total e Operações, alerta se `cancellation_reason`, alerta amarelo se `mtm_staleness_warning`, tabela de `allocation_snapshot` (Operação / Volume total / A fechar / MTM usado).

**7. Dialog de cancelamento** (após o sheet de detalhe)
- Controlado por `btCancelTarget`. Mostra resumo do batch, `Textarea` obrigatório para `btCancelReason`. `DialogFooter` com Voltar/Confirmar (destructive). Confirmar chama `handleBtCancel`.

### Regras invioláveis respeitadas
- Zero cálculo financeiro no frontend (apenas formatação de datas/volumes).
- Sem catch silencioso (todos viram `toast.error`).
- `orders` continua intocada — nenhum INSERT/UPDATE.
- Modal de execução continua placeholder existente.

### Validação manual (checklist do usuário)
Lista padrão, navegação new↔list, salvar rascunho, badges, sheet de detalhe, enviar p/ assinatura aparecendo em /aprovacoes com badge "Block Trade", dialog de cancelamento, modal Executar abrindo.
