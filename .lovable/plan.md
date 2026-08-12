# Vínculo de safra nas combinações de precificação

A coluna `harvest_id` já existe em `pricing_combinations` e está populada. Falta expor a safra na aba Combinações de Configurações.

## O que muda (src/pages/Settings.tsx, CombinationsTab)

### 1. Select de Safra no formulário
- Novo campo "Safra" na seção Identidade, junto de Armazém, Commodity, Benchmark e Ticker.
- Lista apenas safras ativas cuja commodity é igual à commodity da combinação (`soybean` / `corn`), exibindo o nome.
- Opcional: opção "Nenhuma" grava vazio (null).
- Trocar a commodity limpa a safra, no mesmo `onValueChange` que já limpa o ticker.
- Nada é pré-selecionado a partir de datas: a safra é sempre escolha do usuário.

### 2. Coluna Safra na tabela
Nova coluna mostrando o nome da safra, ou "-" quando não houver.

### 3. Persistência
- `harvest_id: null` entra na combinação em branco.
- `harvest_id` entra no payload de gravação.
- A duplicação já copia todos os campos por spread; a safra vem junto sem alteração adicional.

## Detalhes técnicos
- Fonte de dados: hook existente `useReferenceRows('harvests')`; filtros de ativa e de commodity feitos em memória.
- `PricingCombination` em `src/types/index.ts` ganha `harvest_id: string | null`.
- Select usa valor sentinela interno para "Nenhuma", gravando `null`.
- Mapa id→nome para renderizar a coluna da tabela.

## Fora de escopo
- WarehousesTab, ParametersTab, AlcadasTab.
- Qualquer lógica de precificação, basis, herança de custos ou pré-cálculo TARGET_PRICE.
- `harvest_id` NÃO vai no payload de `/pricing/table`.
- Nenhuma alteração de dados no banco.
