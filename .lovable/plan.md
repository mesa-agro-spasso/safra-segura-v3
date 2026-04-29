## Editor de Plano de Hedge (modo DRAFT) em OperacoesD24.tsx

Adicionar capacidade de editar, validar e salvar o plano de hedge diretamente na seção "Plano de Hedge" do Sheet de detalhe — apenas para operações com status `DRAFT`/`RASCUNHO`. Operações em outros status mantêm a visualização somente leitura atual.

### Arquivo único modificado
- `src/pages/OperacoesD24.tsx`

### Mudanças

**1. Imports (topo do arquivo, ~linhas 13–17 e 44)**
- Adicionar `validateExecution` e `type ValidateExecutionResponse` ao import de `@/services/d24Api`.
- Adicionar `Trash2`, `Plus`, `CheckCircle2`, `AlertCircle` ao import de `lucide-react`.

**2. Tipo local (escopo de módulo, antes do componente principal)**
- `type EditableLeg = { ... }` com todos os campos como string (exceto `instrument_type`, `direction`, `option_type`, `is_counterparty_insurance`).
- Factory `emptyLeg(): EditableLeg`.

**3. IIFE do Sheet (linha ~857), após cálculo de `planLegs`/`orderMsg`/`confirmMsg`**
- `isDraft = opD24.status === 'DRAFT' || opD24.status === 'RASCUNHO'`.
- `useState` para `editLegs` inicializado a partir de `planLegs` (todos numéricos convertidos para string).
- `useState` para `planValidation` (`{ legResults, newOrderMsg, newConfirmMsg } | null`).
- `useState` para `savingPlan: boolean`.
- Função `handleValidatePlan`: monta `OperationIn`, itera as legs chamando `validateExecution` (loading→done/error por leg), depois chama `buildHedgePlan` para regenerar `order_message`/`confirmation_message`. CONTRACT_SIZE: 450 (B3) ou 5000 (CBOT).
- Função `handleSavePlan`: atualiza `operations.hedge_plan` via `supabase.from('operations' as any).update({...}).eq('id', ...)` com `{ plan, order_message, confirmation_message }`, invalida queries `operations_with_details` e `operations`, fecha validação.

**4. Renderização da seção (linhas 1006–1036)**
- Bloco `!isDraft`: mantém a renderização atual (somente leitura).
- Bloco `isDraft`: novo editor.
  - Para cada leg em `editLegs`:
    - Header: `Select` instrumento (futures/ndf/option), `Select` direção (buy/sell), botão lixeira.
    - Campo Ticker comum.
    - Campos condicionais por `instrument_type`:
      - futures: contratos, preço estimado.
      - ndf: volume USD, taxa NDF, maturidade.
      - option: tipo (call/put), contratos, strike, prêmio, vencimento.
    - Campo Notas comum.
    - Resultado da validação por leg (loading / errorMsg / structural_errors + business_alerts coloridos por nível ERROR/WARNING/INFO / sucesso).
  - Botão "Adicionar Perna" → `setEditLegs(prev => [...prev, emptyLeg()])`.
  - Pré-visualização das mensagens regeneradas (`newOrderMsg`/`newConfirmMsg`) com botão de copiar usando o `copyToClipboard` já existente.
  - Botões finais: "Validar Plano" (desabilitado durante loading) e "Salvar Plano" (desabilitado se não validou ou se houver erros estruturais/business ERROR).

### Restrições respeitadas
- Sem novos hooks, serviços ou Edge Functions.
- Casts `as any` permitidos para campos D24.
- `supabase.from('operations' as any).update(...)` para preservar contexto de auth.
- Apenas `src/pages/OperacoesD24.tsx` é tocado.
- Reusa `queryClient`, `selectedOperation`, `user`, `copyToClipboard`, `toast` e `Section`/`Row` já em escopo.
