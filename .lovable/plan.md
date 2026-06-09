## Bug diagnosis

O modal hoje envia `payment_receipt_date: s.paymentReceiptDateStr || null`. O default por linha é `r.grain_reception_date ?? r.payment_date ?? ''`, mas existem dois caminhos pelos quais a data sai vazia / inválida e gera o 422 no backend:

- Snapshot sem `grain_reception_date` nem `payment_date` → string vazia → atualmente a validação local mostra toast e bloqueia (sem 422), mas a UX é ruim e o carrego acaba "silenciosamente" não sendo aplicado.
- Quando `payment_date`/`grain_reception_date` vêm como timestamp ISO completo, a string truthy passa pela guarda local e o backend rejeita por formato (422 sem mensagem clara).

Além disso o front mostra "Seguro aplicado / Ativo" no detalhe mesmo quando o POST falhou (display otimista vindo do cache anterior), mascarando o erro.

## Mudanças

### 1) `src/components/InsuranceLayerModal.tsx` — parar o 422

- Normalizar datas: helper `toIsoDate(v)` que aceita string/ISO/Date e devolve `YYYY-MM-DD` (ou `''`). Aplicar em `trade_date`, `grain_reception_date`, `payment_date`, `payment_receipt_date` ao inicializar e ao montar o payload.
- Default automático de `paymentReceiptDateStr` permanece `grain_reception_date ?? payment_date`, agora normalizado.
- No `handleApply`, montar item com regra do backend:
  - Se rate disponível **e** `carryEnabled` **e** `enabled` → `carry_enabled: true` e enviar **todos** os campos obrigatórios não-nulos: `interest_rate` (em %, como vem), `interest_rate_period` (`warehouse.period ?? 'monthly'`), `trade_date`, `payment_receipt_date`.
  - Se faltar `payment_receipt_date` mas o carrego está pedido: usar o default automaticamente (não exigir clique do usuário). Só bloquear com toast se realmente não houver nenhuma fonte (`grain_reception_date`, `payment_date` e input global todos vazios).
  - Se rate indisponível → forçar `carry_enabled: false` e omitir/null nos demais campos de carrego (backend não exige).
- Garantir que, mesmo com carry off, ainda enviamos `trade_date` quando existe (não atrapalha).

### 2) Persistência — `upsertRows`

- Já chama `useInsuranceSnapshots` mutation. Ajustar para gravar somente do response:
  - `carry_enabled: result.carry_enabled ?? false`
  - `carry_cost_brl: result.carry_cost_brl ?? 0`
  - `carry_interest_rate: meta.rate` (= o `interest_rate` enviado em %)
  - `carry_interest_rate_period: meta.period`
  - `payment_receipt_date: meta.carryEffective ? s.paymentReceiptDateStr : null`
- Aceite: linha gravada tem `carry_enabled=true` e `carry_cost_brl > 0` após aplicar com carrego.

### 3) Data editável no nível global

- Novo campo "Data de recebimento (fim do carrego)" no bloco global (ao lado do switch de carrego), `type="date"`.
- Estado `globalReceiptDateStr`. Ao alterar, faz fan-out para todas as linhas (mesma lógica de `applyGlobalCoverage`).
- Override por linha já existe na seção "Ajustar por linha" — mantido.
- Inicialização do default global: primeira data não-vazia entre os defaults das linhas.

### 4) Rótulos e fim do display otimista

- `src/components/InsuranceLayerModal.tsx` — no resumo por linha (já existe `Seguro / Carrego / Total / Ajustado`), exibir `Carrego` e `Total` somente quando `result.carry_enabled`; caso contrário só `Seguro` e `Ajustado`. Sem mudança de cálculo.
- `src/pages/PricingTable.tsx` — painel "Seguro aplicado":
  - Não renderizar o bloco se a aplicação falhou. Critério: `applied.enabled === true` e `applied.adjusted_price_brl != null`. Se um POST anterior falhou, o cache não muda — manter a leitura do DB como hoje, mas só mostrar quando `enabled=true`.
  - Quando `applied.carry_enabled`: acrescentar `DetailRow "Carrego" = R$ carry_cost_brl` e `DetailRow "Custo total" = R$ (insurance_cost_brl + carry_cost_brl)` — vindo do DB, sem recalcular (a soma é display, não cálculo financeiro). Manter "Custo seguro" como `insurance_cost_brl`.
  - Trocar "Ativo" por "Aplicado" para evitar ambiguidade com a aplicação otimista.

## Escopo / não-mexer

- Sem alterações em Edge Functions, endpoint `/pricing/insurance-layer`, SQL, RLS, ou no `useInsuranceSnapshots` (schema já comporta todos os campos).
- Nenhum cálculo financeiro novo no front (P07). A soma "Custo total" exibida no detalhe é apenas exibição de dois valores já calculados pelo backend.
