# Seguro no cockpit + opção selecionável sem cotação do dia

## Onde o dado se perdeu (confirmado)

A combinação 050 / ZSQ27 está correta no banco (opção, cobertura 0,5, carrego `operation_end`) e a cotação de hoje existe (1,0255 USD/bushel, 07/08/2026).

Os três snapshots de hoje dessa linha (11:24, 11:25 e 11:26) têm `inputs_json.source = 'cockpit'`. Ou seja: **o preço não foi gerado pelo modal da Tabela de Preços — foi gerado pelo cockpit.**

O modal (`GeneratePricingModal.tsx`) monta os campos de seguro corretamente. O cockpit não: `src/lib/cockpitPayload.ts` monta o payload a partir da mesma combinação, mas **não lê nenhum campo de seguro** — nem no payload, nem na gravação do snapshot. Por isso não houve descarte, o backend precificou sem seguro (`insurance_brl: 0`) e as quatro colunas do snapshot ficaram nulas.

A cadeia do modal não está quebrada; a do cockpit nunca foi construída.

## 1. Seguro no cockpit

`src/lib/cockpitPayload.ts` passa a espelhar exatamente o que o modal já faz:

- `buildCockpitPayload` recebe também o mapa de cotações mais recentes por opção (`useLatestOptionQuotes`).
- Para cada combinação com `insurance_option_id`, acrescenta ao nível raiz da linha:
  - `insurance_premium_usd_bushel` (CBOT) ou `insurance_premium_brl_sack` (B3) — prêmio cru, sem conversão
  - `insurance_coverage_pct`
  - `insurance_quote_trade_date`
  - `insurance_carry_until` (só quando cadastrado)
- Combinação com seguro e **nenhuma** cotação registrada: linha entra em `skipped` com o motivo "Seguro sem cotação — cadastre o prêmio em Mercado > Opções." Cotação existente porém de outro pregão **vai normalmente** — quem julga é o backend.
- A cotação usada, a cobertura e o carrego ficam guardados por índice do payload, ao lado de `comboIds`.

`buildCockpitSnapshots` passa a gravar as quatro colunas (`insurance_quote_id`, `insurance_coverage_pct`, `insurance_cost_brl`, `insurance_carry_until`), juntas ou todas nulas, lendo `costs.insurance_brl` como veio. Linha que teve seguro mas voltou sem `costs.insurance_brl` **não é gravada** e é devolvida numa lista de falhas — mesma regra já aplicada no modal.

`src/pages/Cockpit.tsx`: passa as cotações para o builder, exibe as linhas puladas por falta de cotação junto dos outros "pulados" e mostra um aviso persistente com as linhas não gravadas por falta do custo de seguro.

Se o cockpit exibir custos por linha, a linha de Seguro aparece lendo `costs.insurance_brl` como vem — sem nenhuma aritmética.

## 2. Opção sem cotação de hoje passa a ser selecionável

`src/pages/Settings.tsx`, seção Seguro da combinação: remover o `disabled` do item da lista. O texto "sem cotação hoje — cadastre em Mercado > Opções" continua no item, agora só informando.

A validação do trio (opção + cobertura + carrego) continua igual. Quem barra na geração é o backend, com `INSURANCE_QUOTE_UNAVAILABLE`, que a tela já trata.

## Fora de escopo

Nada além desses dois pontos: sem mudança de schema, sem mexer no modal da Tabela de Preços, na aba Mercado ou em qualquer cálculo.
