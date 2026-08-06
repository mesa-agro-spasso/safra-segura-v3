# Ticker do futuro vira lista no cadastro de opção

Só o diálogo `InsuranceOptionFormDialog`. Nada de escrita em `market_data`, nada de schema, nada na seção de cotação.

## Como fica o campo

O campo "Ticker do futuro" passa a ser um **combobox com busca** (padrão shadcn: `Popover` + `Command`), listando os futuros de `market_data` do par escolhido, ordenados por vencimento, com o vencimento escrito ao lado do ticker.

- Contratos já vencidos (`exp_date` no passado) ficam fora da lista.
- Se o texto digitado não bate com nenhum item, a lista oferece a linha **"Usar «ZSN26» mesmo assim"** — é o caminho de entrada manual, sempre disponível, sem toggle e sem travar o cadastro.
- Trocar benchmark ou commodity limpa o ticker escolhido, porque o conjunto de contratos muda.

## Vencimento

Ao escolher um ticker **da lista**, o campo Vencimento é preenchido com o `exp_date` daquele contrato. Continua editável — o valor é sugestão. Quando o vencimento digitado difere do contrato, aparece uma nota discreta ("Contrato vence em dd/mm/aaaa"), sem bloquear.

Ticker digitado à mão não mexe no vencimento.

## Mapa par → futuros

Os futuros são identificados em `market_data` pela coluna `commodity`, com este mapa (confirmado nos dados atuais):

```text
soybean + cbot -> SOJA        (ZS...)
corn    + cbot -> MILHO_CBOT  (ZC...)
corn    + b3   -> MILHO       (CCM...)
```

## Detalhe técnico

- `src/hooks/useInsuranceOptions.ts`: acrescentar `MARKET_COMMODITY_BY_PAIR` e um hook `useFuturesTickers(benchmark, commodity)` que lê `market_data` (`ticker`, `exp_date`) filtrando pela commodity do mapa e por `exp_date >= hoje`, ordenado por `exp_date`. Sem escrita.
- `src/components/market/InsuranceOptionFormDialog.tsx`: substituir o `Input` de ticker pelo combobox; `onSelect` de item da lista grava ticker e preenche `expiry`; item livre grava só o ticker em maiúsculas. Validações atuais (ticker obrigatório, strike > 0, vencimento obrigatório) permanecem.
- Nenhuma outra tela é tocada.
