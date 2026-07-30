## Achados da investigação

**Item 2 — bloqueado (confirmado).** Duas telas LEEM `insurance_json`:
- `src/pages/PricingTable.tsx` (~455): diálogo de detalhamento monta bloco de seguro teórico ATM / OTM 5% / OTM 10%.
- `src/components/InsuranceLayerModal.tsx` (116 e 246): pré-preenche o prêmio e classifica `premium_source` como `theoretical` vs `manual`.

`insurance_json: r.insurance ?? {}` permanece exatamente como está.

**Item 3 — Armadilha 2 (confirmada).** `supabasePublic` não serve só ao log: é usado em `AuthContext.tsx` linha 40 (`fetchProfile`) e linha 166 (leitura de `forced_env`), além de `activityLog.ts` (24 e 27). Por isso ele será mantido como **alias do client único**, sem tocar nas chamadas.

---

## Item 1 — `sigma` sai do payload

`src/components/GeneratePricingModal.tsx`
- Remover `sigmaMap` (145-146) e o campo `sigma` do `baseCombo` (267-269).
- `usePricingParameters()` alimenta **apenas** o sigma neste arquivo → remover hook e import.

`src/pages/Settings.tsx` (preview TARGET_PRICE, mesmo endpoint `/pricing/table`)
- Remover `sigmaMap` (469-470) e o campo `sigma` do payload (498-500).
- `pricingParameters` continua em uso pela aba Parâmetros → leitura preservada.

Coluna `sigma`, tipo `PricingParameter`, card "Volatilidade Implícita" e `useUpdatePricingParameter` ficam intactos.

## Item 2 — sem alteração (reportado acima)

## Item 3 — remoção do switch de ambiente

- **Excluir** `src/lib/envState.ts` e `src/contexts/MesaEnvContext.tsx`.
- `src/integrations/supabase/client.ts`: eliminar o Proxy de schema, `getCurrentEnv`, `getMesaEnv`, `setMesaEnv`, `isStagingEnv` e o tipo `MesaEnv`. Fica um `createClient` único exportado como `supabase`, com `supabasePublic` como alias.
- `src/App.tsx`: remover `MesaEnvProvider`.
- `src/components/AppLayout.tsx`: remover `useMesaEnv` e o banner amarelo.
- `src/components/AppSidebar.tsx`: remover `useMesaEnv`, o badge "TESTE" e o bloco "Ambiente: Teste" do rodapé.
- `src/pages/AdminUsers.tsx`: remover `useMesaEnv`; aba "Registros" sempre visível.
- `src/pages/PendingApproval.tsx`: remover o botão "Sair do modo Teste" e os imports `getMesaEnv`/`setMesaEnv`.
- `src/lib/activityLog.ts`: remover `getCurrentEnv` e a opção `isStaging`; gravar `is_staging: false` fixo.
- `src/contexts/AuthContext.tsx`: remover `setCurrentEnv`/`resolveEnvFromProfile` e a leitura extra de `forced_env` que existia só para carimbar o log. `fetchProfile` e o tema seguem intactos.
- `src/components/admin/ActivityLogTab.tsx`: inalterado (o filtro histórico de `is_staging` continua útil).
- `profile.forced_env` deixa de ter efeito no frontend; **nenhuma coluna removida do banco**.

## Item 4 — warm-up no login (via api-proxy)

Novo `src/lib/warmup.ts`:
- `warmUpApi()` com guarda de módulo (`let warmed = false`) → uma vez por sessão de página.
- Usa `callApi('/market/quotes', undefined, { method: 'GET', query: { quantity: '1' } })` — endpoint já na allowlist do api-proxy. Sem `await`, `.catch(() => {})`, resposta descartada. Nenhuma URL de backend exposta no frontend.
- Comentário no arquivo registrando que, quando o Eduardo liberar `GET /health` na allowlist do api-proxy, basta trocar o endpoint.

`src/pages/Login.tsx`: chamar `warmUpApi()` após `signIn` resolver e antes de `navigate('/')`, sem `await` — redirecionamento não é atrasado.

## Detalhes técnicos

- Sem alteração de schema, de Edge Function ou do payload de `/pricing/table` além da remoção do `sigma`.
- Zero cálculo financeiro adicionado no frontend.
- Ao final: typecheck e suíte de testes.

## Validação manual (Eduardo)

1. Gerar tabela — preços idênticos aos de antes.
2. Aplicar seguro manual em uma linha — deve continuar funcionando (`insurance_snapshots`).
3. Confirmar que banner/badge de ambiente sumiram da interface.
4. Login com servidor dormindo → primeira geração de tabela mais rápida.
