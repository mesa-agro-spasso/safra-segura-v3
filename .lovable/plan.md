## Limpeza de dados — Alta Floresta (produção)

Apagar **somente** os registros associados ao armazém `alta_floresta`. Confresa e Matupá permanecem intactos.

### O que será removido

Levantamento direto na base de produção (`public`):

| Tabela | Registros a remover | Critério |
|---|---|---|
| `operations` | **9** | `warehouse_id = 'alta_floresta'` |
| `orders` | **22** | `operation_id` ∈ operações acima |
| `mtm_snapshots` | **33** | `operation_id` ∈ operações acima |
| `signatures` | **14** | `operation_id` ∈ operações acima |
| `warehouse_closing_batches` | **2** | `warehouse_id = 'alta_floresta'` |
| `pricing_snapshots` | **5** | apenas os 5 snapshots referenciados pelas operações de Alta Floresta — verifiquei que **nenhum** é usado por operações de outros armazéns |

Operações que serão apagadas (todas Alta Floresta, soja):
- `ALT_SOJA_260429_001` (CANCELLED)
- `ALT_SOJA_260429_002` (CLOSED)
- `ALT_SOJA_260430_001` (CLOSED)
- `ALT_SOJA_260505_001` (ACTIVE)
- `ALT_SOJA_260506_001` / `_002` / `_003` (PARTIALLY_CLOSED)
- `ALT_SOJA_260506_004` / `_005` (DRAFT)

### Ordem da remoção (uma migration única, transacional)

1. `DELETE FROM signatures WHERE operation_id IN (... alta_floresta ops ...)`
2. `DELETE FROM mtm_snapshots WHERE operation_id IN (...)`
3. `DELETE FROM orders WHERE operation_id IN (...)`
4. `DELETE FROM warehouse_closing_batches WHERE warehouse_id = 'alta_floresta'`
5. `DELETE FROM operations WHERE warehouse_id = 'alta_floresta'`
6. `DELETE FROM pricing_snapshots WHERE id IN (... 5 snapshots exclusivos ...)`

Tudo em uma transação — se qualquer passo falhar, nada é apagado.

### O que **não** muda

- Armazém `alta_floresta` em `warehouses` (mantido — é cadastro mestre).
- `physical_prices`, `historical_basis`, `market_data` de Alta Floresta (são dados de mercado, não operações).
- Operações/ordens/snapshots de Matupá, Confresa e qualquer outro armazém.

### Confirmação

Como é uma operação destrutiva em produção, vou usar a ferramenta de migration — você precisará aprová-la antes da execução. Quer que eu prossiga com esses 5 snapshots de pricing também removidos, ou prefere mantê-los como histórico mesmo sem operação associada?
