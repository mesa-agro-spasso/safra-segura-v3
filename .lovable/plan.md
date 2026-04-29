## Migrar `handleCalculate` para `/mtm/run-d24`

Único arquivo tocado: `src/pages/OperacoesD24.tsx`.

### Mudança

Substituir o corpo da função `handleCalculate` (linhas 913–1047) — que monta um `HedgeOrder` legado e chama `/mtm/run` — por uma versão que:

1. Mantém os guards iniciais (`marketData`, `activeOpsForMtm`).
2. Para cada operação ativa, monta um payload **D24 nativo** com três blocos:
   - `operation`: id, commodity, exchange, volume_sacks, origination_price_brl, datas.
   - `orders`: lista mapeada de `d24Orders` (campos: instrument_type, direction, currency, contracts, volume_units, is_closing, ticker, price, ndf_rate, ndf_maturity, option_type, strike, premium, expiration_date, is_counterparty_insurance).
   - `snapshot`: `futures_price_current`, `physical_price_current`, `spot_rate_current`, `option_premium_current`.
3. Mantém o cálculo de `optionPremiumCurrent` via `/pricing/option-premium` (preserva conversão `F_brl` por commodity, `BUSHELS_PER_SACK`, sigma de `pricingParameters`).
4. Chama `callApi('/mtm/run-d24', { positions })` em vez de `/mtm/run`.
5. Persiste resultados via `saveMtm.mutateAsync` exatamente como hoje (mesma forma de `r.market_snapshot`, mesmos campos do snapshot do banco).

### Removido

- Construção do objeto `hedgeOrder` legado (broker, broker_account, futures_price_currency, pricing_snapshot, status, order_message, etc.).
- Construção das `legs` no formato legado (`leg_type`, `unit_label`).
- O guard de debug temporário `totalLegs === 0` (não se aplica mais — o backend D24 lida com orders vazias).

### Preservado

- Guards `marketData` / `activeOpsForMtm`.
- `setCalculating` start/finally.
- Lookup de `futuresPrice` via `marketData.find(m => m.ticker === ...)`.
- Chamada e fallback silencioso de `/pricing/option-premium`.
- Loop de persistência `saveMtm.mutateAsync` e toasts de sucesso/erro.

### Fora de escopo

- Nenhum outro arquivo. UI, queries, badges e tabela de resultados permanecem como estão.
- Endpoint `/mtm/run-d24` na API Python: assumido como já existente (contrato definido pelo payload acima).