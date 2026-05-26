## Objetivo
Adicionar suporte ao método de precificação `TARGET_PRICE` na aba **Configurações → Combinações**, mantendo `LONG_BASIS` como default e sem alterar o restante do app.

## Arquivos alterados
- `src/types/index.ts`
- `src/pages/Settings.tsx` (apenas `CombinationsTab`)

Nenhum outro arquivo será tocado (em especial: `GeneratePricingModal.tsx`, hooks e demais abas ficam intactos).

## 1. `src/types/index.ts` — interface `PricingCombination`
- Adicionar `pricing_method: 'LONG_BASIS' | 'TARGET_PRICE'`
- Adicionar `origination_price_net_brl: number | null`
- Tornar `target_basis: number | null`

## 2. `src/pages/Settings.tsx` — `CombinationsTab`

### 2.1 Imports e hooks
- Importar `useMarketData`, `usePricingParameters`, `callApi`.
- Dentro de `CombinationsTab`, consumir `useMarketData()` e `usePricingParameters()`.

### 2.2 Estado
- `emptyCombination` ganha `pricing_method: 'LONG_BASIS'`, `target_basis: 0`, `origination_price_net_brl: null`.
- Novos `useState`: `calculating: boolean` e `calcResult` (com `target_basis_brl`, `breakeven_basis_brl`, `purchased_basis_brl`, `origination_price_brl`).

### 2.3 `handleCalculate`
Só roda quando `pricing_method === 'TARGET_PRICE'`. Monta 1 combinação para `POST /pricing/table` via `callApi`, resolvendo:
- `exp_date`: do form ou de `market_data`.
- `payment_date`: próxima terça se `is_spot`; senão `editing.payment_date`.
- `grain_reception_date`: fallback para `payment_date`.
- `exchange_rate`: `ndf_estimated ?? spot` para soja; `spot` para milho/cbot; ausente para milho/b3.
- Herança de custos do armazém (incluindo `brokerage_per_contract_b3` vs `_cbot` conforme benchmark).
- `sigma` por `pricing_parameters` (`soybean_cbot` / `corn_b3`), com defaults `0.35` / `0.17`.
- `additional_discount_brl: 0` fixo.

Mostra `toast.error` para validações faltantes; popula `calcResult` no sucesso.

### 2.4 Reset de `calcResult`
Em: troca de método, troca de campos relevantes, `onOpenChange` do Dialog, botão "Nova Combinação", e clique no `Edit2` de uma linha existente.

### 2.5 `handleSave`
- Valida por método:
  - `LONG_BASIS`: `target_basis` obrigatório.
  - `TARGET_PRICE`: `origination_price_net_brl` obrigatório; `additional_discount_brl` deve ser `0`.
- Normaliza payload zerando o campo do método oposto antes do upsert (mantém constraint do banco coerente).

### 2.6 Formulário
- **Novo primeiro campo**: `Select` "Método de Precificação" (LONG_BASIS / TARGET_PRICE). Ao trocar: limpa o campo do método oposto, força `additional_discount_brl = 0` se TARGET_PRICE, reseta `calcResult`.
- **Renderização condicional**:
  - LONG_BASIS: mantém `Target Basis` + `Desconto adicional` (comportamento atual).
  - TARGET_PRICE: input numérico "Preço de Originação Net (R$/sc)" com hint.
- **Bloco "Pré-cálculo do basis"** visível apenas em TARGET_PRICE, com botão "Calcular" e exibição de `origination_price_brl`, `target_basis_brl`, `breakeven_basis_brl`, `purchased_basis_brl` (4 casas).

### 2.7 Tabela de listagem
- Substituir coluna `Basis` por duas colunas: `Método` e `Input`.
  - `Método`: badge "Long Basis" ou "Target Price".
  - `Input`: `R$ origination_price_net_brl` para TARGET_PRICE, senão `target_basis`.
- Ajustar `colSpan` da linha vazia conforme novo total de colunas.

## Fora de escopo
- `GeneratePricingModal.tsx`, demais abas, hooks, edge functions e backend Python.

## Validação manual após deploy
1. Lista renderiza com coluna **Método** = "Long Basis" para combinações existentes.
2. "Nova Combinação" abre com dropdown default LONG_BASIS — fluxo idêntico ao atual.
3. Trocar para TARGET_PRICE: some `Target Basis`/`Desconto`, aparece `Preço de Originação Net` + bloco de cálculo.
4. "Calcular" com ticker válido retorna basis; "Salvar" grava `pricing_method='TARGET_PRICE'`, `target_basis=null`, `additional_discount_brl=0`.
5. Editar combinação TARGET_PRICE existente carrega corretamente.
6. Trocar método dentro do form limpa campo anterior e reseta resultado.
7. Validações de erro: salvar TARGET_PRICE sem preço, calcular sem ticker, salvar LONG_BASIS sem basis — todos exibem toast.
