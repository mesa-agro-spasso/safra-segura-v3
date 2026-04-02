

# Fix: "API retornou 0 snapshots" + Ticker dropdown

## Problema 1 — API retorna `results`, não `snapshots`

O teste direto da API confirmou: a resposta usa `{ results: [...] }`, mas o frontend procura `result.snapshots`. Por isso sempre mostra "API retornou 0 snapshots".

Além disso, os campos retornados pela API diferem do que o `saveSnapshots` espera para inserir em `pricing_snapshots`. Mapeamento necessário:

| API response field | pricing_snapshots column |
|---|---|
| `target_basis_brl` | `target_basis_brl` ✓ |
| `origination_price_brl` | `origination_price_brl` ✓ |
| `futures_price_brl` | `futures_price_brl` ✓ |
| `trade_date_used` | `trade_date` |
| `costs` (object) | parte de `outputs_json` |
| `insurance` (object) | `insurance_json` |
| `purchased_basis_brl`, `gross_price_brl`, `breakeven_basis_brl` | `outputs_json` |
| `exchange_rate` | não retornado — precisa injetar do payload |
| `inputs_json` | não retornado — montar do payload original |

### Correção em `GeneratePricingModal.tsx`:

1. Ler `result.results` em vez de `result.snapshots`
2. Para cada item retornado, mapear para o schema de `pricing_snapshots`:
   - `trade_date` = `trade_date_used`
   - `exchange_rate` = do payload original (spotRate)
   - `inputs_json` = objeto com campos de entrada (futures_price, exchange_rate, target_basis, etc.)
   - `outputs_json` = `{ costs, purchased_basis_brl, gross_price_brl, breakeven_basis_brl }`
   - `insurance_json` = `insurance`
   - `additional_discount_brl` = do resultado
   - Demais campos diretos: warehouse_id, ticker, commodity, benchmark, payment_date, sale_date, grain_reception_date, target_basis_brl, origination_price_brl, futures_price_brl

## Problema 2 — Ticker como input de texto

Atualmente o campo Ticker é um `<Input>` livre. Trocar por `<Select>` populado com os tickers de `market_data`, filtrados pela commodity selecionada:
- `soybean` → tickers onde `commodity = 'SOJA'`
- `corn` → tickers onde `commodity = 'MILHO_CBOT'`

Usar `useMarketData()` no `CombinationsTab` para buscar os tickers disponíveis.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/GeneratePricingModal.tsx` | Ler `results` em vez de `snapshots`, mapear campos para schema do DB |
| `src/pages/Settings.tsx` | Importar `useMarketData`, trocar Input do ticker por Select filtrado por commodity |

