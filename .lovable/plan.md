# Fluxo de Encerramento em 2 Etapas — `src/pages/OperacoesD24.tsx`

Substituir o `ClosingModal` único atual por um fluxo de duas etapas: **Plano de Encerramento** (com snapshot de MTM e validação de staleness de mercado) e **Registrar Encerramento** (cria ordens com `is_closing=true` referenciando as ordens originais).

## Mudanças (apenas `src/pages/OperacoesD24.tsx`)

### 1. Estados (componente principal)
Adicionar:
- `closingPlanOp` — controla `ClosingPlanModal`
- `registerClosingOp` — controla `RegisterClosingModal`

Manter `closingOp` apenas se ainda referenciado em outro local; caso contrário, remover junto com o JSX antigo.

### 2. Query `closingSignaturesForOps`
Nova query ao lado de `signaturesForOps` (linha ~689), filtrando `flow_type='CLOSING'` e devolvendo `Set` em `closingSignedOperationIds`.

### 3. `renderOpActions` (linha ~794)
Substituir o ramo `ACTIVE | PARTIALLY_CLOSED`:
- Sem `closing_plan` → botão **Encerrar** (abre `ClosingPlanModal`).
- Com `closing_plan`:
  - **Enviar Enc. p/ Assinatura** (oculto se já assinado CLOSING)
  - **Registrar Encerramento** (abre `RegisterClosingModal`)
  - **Cancelar Plano** (limpa `closing_plan`)

### 4. Handlers novos
- `handleSendClosingForSignature` — insere `signatures` com `flow_type='CLOSING'`, invalida `closing-signatures-for-ops`.
- `handleCancelClosingPlan` — `update operations set closing_plan = null`, invalida queries de operations.

### 5. `ClosingPlanModal` (novo, após `RegisterExecutionModal`)
- Mostra MTM atual da operação (de `mtmSnapshots`) ou aviso se ausente.
- Calcula idade dos dados de mercado; banner amarelo ≥2h, vermelho ≥24h.
- Input de volume (default = `volume_sacks`, máx = volume), indica parcial vs total.
- Campo notas.
- Salva em `operations.closing_plan` JSON com snapshot do MTM, idade do mercado, requested_by/at, notes.

### 6. `RegisterClosingModal` (novo, após `ClosingPlanModal`)
- Mostra resumo do `closing_plan`.
- Lista as ordens abertas da operação (de `d24Orders` filtrando `operation_id` e `!is_closing`).
- Pré-popula legs com direção invertida; campos editáveis: contratos, preço (ou `ndf_rate` para NDF), notas.
- `CONTRACT_SIZE` = 450 (B3) / 5000 (CBOT); `volume_units = qty` (NDF) ou `qty * CONTRACT_SIZE` (futures/option).
- Insere em `orders` com `is_closing=true`, `closes_order_id=order_id`, `stonex_confirmation_text` em todas as legs.
- Após sucesso, limpa `closing_plan` na operação.

### 7. JSX — substituir `<ClosingModal ... />` (linha ~1937)
Renderizar `<ClosingPlanModal />` e `<RegisterClosingModal />` recebendo `mtmSnapshots`, `marketData`, `d24Orders`, `user?.id`. Invalidar `operations_with_details`, `operations` e (no register) `d24-orders-active` ao salvar/fechar.

Remover `ClosingModal` antigo (declaração e props `closingOp`/`setClosingOp`) — confirmado que só é usado nesse JSX (linha 1937).

## Restrições respeitadas
- Apenas `src/pages/OperacoesD24.tsx`.
- Sem novos hooks, sem Edge Functions.
- Reusa queries existentes (`d24Orders`, `mtmSnapshots`, `marketData`).
- Sem cálculo financeiro no frontend (apenas snapshot do MTM já calculado).
