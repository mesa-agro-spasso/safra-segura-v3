# Câmbio: frontend para de escolher, API resolve

## Arquivos alterados
- `src/components/GeneratePricingModal.tsx` (payload, validações, persistência)
- `src/components/DiscardedCombinationsList.tsx` (três motivos novos)

Nada mais: sem schema, sem Edge Function, sem tela de Mercado, sem formulários.

## 1. Payload de `POST /pricing/table`

Nível da requisição, um por geração:

```text
{ trade_date, spot_usd_brl, combinations: [...] }
```

`spot_usd_brl` = `price` do registro `USD/BRL` de `market_data` (o mesmo valor já usado hoje como `spotRate` no modal, que reflete o `fx_override` gravado pela mesa na tela de Mercado).

Por linha:
- Remover `exchange_rate` do `baseCombo` — deixa de ser enviado em qualquer linha, CBOT ou B3. Some também toda a lógica atual de escolher entre `ndf_estimated` e spot (linhas ~221-233).
- Novo `exchange_rate_override`, opcional: enviado **apenas** para linhas CBOT (soja CBOT e milho CBOT) quando `market_data[ticker].ndf_override` estiver preenchido. Omitido quando nulo.
- Milho B3: nunca envia `exchange_rate` nem `exchange_rate_override` (retorna 422).

## 2. Validações do modal

- `spot_usd_brl` passa a ser obrigatório para **qualquer** geração que contenha linha CBOT (hoje só bloqueia quando há soja). Sem USD/BRL disponível → botão desabilitado e mensagem já existente.
- Remover o bloqueio "NDF indisponível para milho CBOT" (`cornCbotMissingNdf`): `ndf_estimated` deixa de ser insumo de precificação, logo sua ausência não pode mais impedir a geração.
- Manter o bloqueio de dados de mercado desatualizados (>24h) para milho CBOT — é sobre o preço do futuro, não sobre o câmbio.
- Manter os avisos de B3 sem preço.

## 3. Persistência do snapshot

`exchange_rate` do snapshot passa a vir da resposta da API (`r.exchange_rate`), não mais do payload enviado. Em `inputs_json`, trocar `exchange_rate` por `exchange_rate_override` (o que de fato foi enviado). A coluna Câmbio da tabela e os detalhes seguem lendo `snap.exchange_rate` — sem alteração de código lá, mas passam a mostrar a taxa resolvida pela API.

## 4. Descartes novos

Em `reasonText`, três casos, mantendo o fallback para `detail`:

- `FX_MATURITY_NOT_AFTER_TRADE_DATE` → "Data de venda não é posterior à data de negociação."
- `FX_RATE_NOT_POSITIVE` → "Câmbio resultante inválido. Verifique os parâmetros de câmbio."
- `FX_PARAMETERS_UNAVAILABLE` → "Parâmetros de câmbio indisponíveis. Tente novamente."

## Ponto a confirmar na primeira geração
O nome do campo de câmbio resolvido na resposta da API é assumido como `exchange_rate` no objeto de resultado. Se vier com outro nome, a coluna Câmbio aparecerá vazia e o ajuste é de uma linha.

## Validação manual (Eduardo)
1. Gerar tabela: preços de soja devem CAIR (R$0,40 a R$3,10/sc).
2. Milho B3 idêntico ao anterior.
3. ZSF27 da praça 050 cai ~R$3,10/sc.
4. Coluna Câmbio mostra a taxa da API, não o `ndf_estimated` do ticker.
5. Snapshot salvo com `exchange_rate` = taxa resolvida.
