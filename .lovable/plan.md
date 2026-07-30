## Objetivo

Tirar da interface todo resquício do seguro teórico (Black-76 ATM / OTM 5% / OTM 10%) e do sigma que o alimentava. O fluxo de seguro manual segue intacto.

## Resultado das buscas pedidas (feitas, sem alterar nada)

**`r.insurance` / `insurance_json`** — a única leitura da resposta da API é a própria escrita em `GeneratePricingModal.tsx:354`. Fora dela, `insurance_json` só aparece em `PricingTable.tsx` (bloco de detalhamento) e `InsuranceLayerModal.tsx` (linhas 20, 116, 246), todos previstos nesta tarefa. As demais ocorrências de "insurance" no `src/` são `is_counterparty_insurance` (ordens D24) e os tipos gerados do Supabase — sem relação. Nenhuma outra tela consome o campo.

**`target_profit_brl_per_sack`** — lido apenas em `src/pages/OperacoesD24.tsx:1030-1031`. Essa página **não está roteada** (nem em `App.tsx`, nem na sidebar) desde a Wave 1. Ou seja: hoje o campo não é lido por nenhuma tela viva. **Reportado, não removido** — decisão do Eduardo.

**`sigma` fora do card** — usado em `OperacoesD24.tsx:1149-1181` (Black-76 do MTM), também na página não roteada. Depois de remover o card, sigma deixa de ter consumidor vivo, mas a coluna e o tipo permanecem.

## Ordem de execução (leituras antes da escrita)

### 1. `src/pages/PricingTable.tsx` — leitura no diálogo de detalhamento
- Remover as consts `insurance`, `insuranceLevels`, `hasInsurance` (~455-461) e toda a seção "Seguro" com ATM / OTM 5% / OTM 10% (~545-566).
- Na seção "Seguro aplicado" (manual, permanece), remover `sourceLabel` e a linha `Fonte` — com todo prêmio manual, o rótulo perde função.

### 2. `src/components/InsuranceLayerModal.tsx` — leituras
- Linha ~116: remover `atmPremium` e iniciar `premiumStr: ''` para linhas sem snapshot. Linhas com snapshot existente seguem pré-preenchidas por `insurance_snapshots`.
- Linhas ~246-255: remover a segunda leitura e gravar `premium_source: 'manual'` fixo.
- Remover `insurance_json` da interface de props (linha 20).

### 3. `src/components/GeneratePricingModal.tsx` — escrita (por último)
- Remover `insurance_json: r.insurance ?? {}` (linha 354) e o campo `insurance` do tipo da resposta, se declarado localmente.

### 4. Card "Volatilidade Implícita (sigma)" em Configurações → Parâmetros
- Remover o card inteiro (`src/pages/Settings.tsx` ~1240-1276), incluindo o handler `saveSigma` e a validação 0-2.
- `useUpdatePricingParameter` **fica**: serve também ao arredondamento, ticker counts, lucro alvo e spread. Ajuste necessário: `sigma` passa de obrigatório a opcional na assinatura e só entra no `update` quando informado — hoje todas as chamadas passam `sigma: p.sigma` só para satisfazer o tipo; essas passagens saem.
- `src/data/helpContent.ts:96`: remover a linha do glossário que descreve o sigma como insumo do Black-76.
- Sem migração: coluna `sigma` e o campo no tipo `PricingParameter` permanecem.

## Escopo negativo
- Nenhuma alteração de schema, Edge Function, cálculo do seguro manual, detalhamento de custos, painel de basis ou diálogo de descartes.
- `OperacoesD24.tsx` / `ArmazensD24.tsx` não são tocados nesta tarefa.
- Zero cálculo financeiro no frontend.

## Verificação
- Typecheck + suíte de testes.
- Busca por `insurance_json` no `src/` deve sobrar apenas nos tipos gerados do Supabase.

## Validação manual (Eduardo)
1. Detalhamento de uma linha: nenhum bloco de seguro teórico.
2. Seguro manual aplica normalmente, com prêmio em branco.
3. Novo registro em `insurance_snapshots` com `premium_source = 'manual'`.
4. Novo snapshot de tabela sem `insurance_json` preenchido.
5. Aba Parâmetros sem o card de sigma; arredondamento, ticker counts e lucro alvo continuam salvando.
