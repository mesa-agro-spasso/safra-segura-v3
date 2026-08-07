# Seguro na combinação e custo do seguro na tabela de preços

Ligar o cadastro de opções (Mercado > Opções) à precificação: escolher a opção na combinação, mandar o prêmio cru para a API e mostrar o custo que ela devolve.

## 1. Seção "Seguro" no formulário da combinação

Nova seção colapsável, fechada por padrão, em Configurações > Combinações (depois de Datas, antes/junto de Custos). Três campos que andam juntos:

- **Opção**: lista das opções ativas do par (commodity + benchmark da combinação). Opção sem cotação registrada para hoje aparece na lista mas **desabilitada**, com o texto "sem cotação hoje — cadastre em Mercado > Opções".
- **Cobertura**: digitada em percentual (ex.: 25), gravada e enviada como decimal (0,25). Aceita valores acima de 0 até 100%.
- **Carrego do prêmio**: "Até o término da operação" (padrão) ou "Até a recepção do grão".

Regra de preenchimento: ou os três campos estão preenchidos, ou nenhum. Um botão "Remover seguro" limpa os três de uma vez. Validação bloqueia salvar com trio incompleto.

As colunas já existem em `pricing_combinations` (`insurance_option_id`, `insurance_coverage_pct`, `insurance_carry_until`) — nenhuma mudança de schema.

A tabela de combinações ganha um indicador discreto ("Seguro 25%") nas linhas que usam seguro.

## 2. Payload de POST /pricing/table

Para cada combinação com seguro, no nível raiz da linha:

- `insurance_premium_usd_bushel` (só CBOT) ou `insurance_premium_brl_sack` (só B3) — prêmio da cotação **sem nenhuma conversão**
- `insurance_coverage_pct` — decimal em (0, 1]
- `insurance_quote_trade_date` — `trade_date` da cotação usada
- `insurance_carry_until` — enviado só quando a mesa escolheu; o backend tem padrão

Combinação sem seguro não envia nenhum desses campos. Se a combinação aponta para uma opção ativa mas não há cotação alguma, a linha é pulada com aviso apontando para Mercado > Opções (mesmo padrão dos avisos atuais de combinação incompleta).

Nada é convertido, somado ou arredondado no frontend.

## 3. Descarte `INSURANCE_QUOTE_UNAVAILABLE`

Entra na lista de motivos já exibida na confirmação de descartes, com texto voltado para a ação:

"Falta a cotação de hoje para a opção de seguro. Cadastre o prêmio em Mercado > Opções e gere a tabela de novo."

## 4. Exibição do custo do seguro

- **Detalhe da linha**: nova linha "Seguro" junto de Financeiro, Armazenagem, Recepção, Corretagem e Mesa, lendo `costs.insurance_brl` como vem.
- **Tooltip de custos da tabela**: mesma linha, mesma ordem.
- **Coluna**: "Seguro (R$/sc)" adicionada à lista de colunas marcáveis da exportação (desmarcada por padrão) e exibida na tabela principal, lendo o mesmo campo. Linha sem seguro mostra o zero que a API devolveu.

Nenhuma aritmética: o número exibido é exatamente o que veio de `costs.insurance_brl`.

## Fora de escopo

- Aba Mercado (só é lida)
- Schema de `insurance_options` / `pricing_combinations`
- `insurance_snapshots` (tabela morta, nenhuma escrita)
- Cálculo ou exibição das outras linhas de custo

## Detalhes técnicos

- `src/pages/Settings.tsx`: seção colapsável no formulário de combinação, usando `useInsuranceOptions` e `useLatestOptionQuotes` (`src/hooks/useInsuranceOptions.ts`) para listar e para marcar "sem cotação hoje"; validação do trio no salvamento.
- `src/types/index.ts`: campos de seguro em `PricingCombination` (se ainda não tipados).
- `src/components/GeneratePricingModal.tsx`: monta os campos de seguro no `baseCombo`, escolhendo o campo do prêmio pelo `benchmark` da linha.
- `src/components/DiscardedCombinationsList.tsx`: novo case `INSURANCE_QUOTE_UNAVAILABLE`.
- `src/pages/PricingTable.tsx`: linha "Seguro" no tooltip e no detalhe; coluna "Seguro (R$/sc)".
- `src/components/ExportPricingModal.tsx`: entrada `insurance_brl` na lista de colunas (`defaultOn: false`).
