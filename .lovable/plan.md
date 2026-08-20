# Simulação livre com relatório DRE

Um card de simulação único, aberto de dois lugares (Cockpit e Tabela de Preços), que monta o payload de `POST /pricing/table`, renderiza o resultado como DRE em cascata e oferece cinco desfechos. Nenhum cálculo no frontend: todo número exibido vem de um campo da resposta.

## Onde abre

- **Cockpit**: novo card `simulation` no `CockpitShell` (entra em `CARD_TITLES` e no menu "Adicionar card"), com botão "Simulação livre" que abre o diálogo.
- **Tabela de Preços**: botão "Simular" no cabeçalho, ao lado de Exportar/Gerar Tabela, abrindo o mesmo diálogo.

## Formulário

Dois modos de partida:

- **A partir de uma combinação**: seletor de combinação existente; preenche o formulário com os parâmetros dela (mesma leitura de camadas que `buildCockpitPayload` faz hoje, incluindo a camada `warehouse` quando há praça).
- **Do zero**: formulário vazio. Praça não é obrigatória para calcular.

Campos editáveis (espelham o que a API aceita por linha): `pricing_method`, `ticker`, `futures_price`, `benchmark`, datas (`trade_date`, `sale_date`, `payment_date`, `grain_reception_date`, `exp_date`), `target_basis` (LONG_BASIS) ou `origination_price_net_brl` (TARGET_PRICE), `is_spot`, `exchange_rate_override`, `rounding_increment`, `additional_discount_brl`, o quarteto de seguro (via `InsuranceFields`) e a camada `manual_override` de custos (`interest_rate`, `interest_rate_period`, `storage_cost`, `storage_cost_type`, `reception_cost`, `brokerage_per_contract`, `desk_cost_pct`, `shrinkage_rate_monthly`). No nível da requisição: `trade_date` e `spot_usd_brl`.

Todos os campos numéricos usam o `NumericInput` existente (sem alterar o componente).

"Calcular" envia por `callApi('/pricing/table', ...)`. Linhas descartadas pela API aparecem com o motivo, reusando `DiscardedCombinationsList`.

## Resultado: visão DRE

Cascata montada só com campos tipados da resposta:

```text
Futuros (futures_price_brl)            [CBOT: futures_price_usd × exchange_rate]
+ Basis (target_basis_brl)  ->  Preço bruto (gross_price_brl)
- Armazenagem      costs.storage_brl
- Quebra técnica   costs.shrinkage_brl
- Recepção         costs.reception_brl
- Custo financeiro costs.financial_brl
- Corretagem       costs.brokerage_brl
- Seguro           costs.insurance_brl
- Desk             costs.desk_cost_brl
- Desconto adicional  additional_discount_brl  ->  price_before_floor_brl
± Ajuste de arredondamento  floor_adjustment_brl  (mostra rounding_increment_used)
= Preço final (origination_price_brl)
```

Linhas ausentes na resposta não são exibidas (nada de zero inventado). Nenhuma subtração no frontend.

## Os cinco desfechos

1. **Simular apenas** — fechar com resultado não salvo pede confirmação ("A simulação será perdida. Deseja continuar?"). Nada é gravado.
2. **Salvar rascunho** — insere em `simulation_drafts` (`created_by`, `label` opcional pedido ao usuário, `request_json` = payload exato enviado, `response_json` = resposta). Lista de rascunhos no próprio card (label, data, autor) com abrir (re-render a partir de `response_json`, sem recalcular), "Recalcular" (reenvia `request_json`) e excluir. Ao carregar a lista, primeiro apaga rascunhos com mais de 3 dias (hard delete), depois lista. Não exige praça.
3. **Gerar PDF** — exporta o DRE usando o mesmo mecanismo do export atual (iframe com HTML + `html2canvas`, logo `/logo-spasso.png`), com cabeçalho de data/parâmetros e a cascata como peça central. Também entra como ação "Gerar PDF" em cada linha da Tabela de Preços, renderizando o mesmo DRE a partir do `outputs_json` da linha. Não exige praça.
4. **Montar operação** — exige praça. Insere UMA linha em `pricing_snapshots` pelo fluxo de insert existente, com o mesmo formato que o publish do Cockpit monta (`inputs_json` com a requisição completa e `source: 'simulation'`, `outputs_json` com a resposta completa, colunas planas, `created_by`), com `created_at` real. Alerta de sucesso: "Snapshot salvo no histórico. O registro de operações ainda não está disponível na plataforma." Comportamento esperado: a linha pode aparecer na Tabela de Preços até a próxima publicação e depois some naturalmente, permanecendo no histórico.
5. **Adicionar à tabela** — exige praça. Duas escritas: (a) upsert de uma NOVA combinação em `pricing_combinations` pelo fluxo existente (`useUpsertPricingCombination`), virando combinação normal; (b) insert de uma linha em `pricing_snapshots` como no desfecho 4, porém com `created_at` EXATAMENTE igual ao `created_at` do lote exibido hoje, para a linha entrar no lote publicado atual em vez de fundar um lote de uma linha só.

Montar operação e Adicionar à tabela ficam desabilitados enquanto não houver praça selecionada.

## Detalhes técnicos

- `src/components/simulation/SimulationDialog.tsx` — diálogo com formulário, DRE, lista de rascunhos e barra de ações.
- `src/lib/simulationPayload.ts` — monta a linha do payload a partir do estado do formulário (só cópia de campos; sem aritmética) e monta a linha de snapshot reaproveitando o formato de `buildCockpitSnapshots`, com `created_at` opcional.
- `src/components/simulation/DreView.tsx` — cascata reutilizável, alimentada por um objeto de resposta (`outputs_json` serve direto), usada pelo diálogo e pelo PDF da Tabela de Preços.
- `src/lib/dreExport.ts` — geração do PDF/imagem via iframe + `html2canvas`, mesmo caminho de `ExportPricingModal`.
- `src/hooks/useSimulationDrafts.ts` — listar (com expurgo de 3 dias antes do select), inserir e excluir em `simulation_drafts` (tabela e políticas já existem: select/insert/delete para autenticados).
- `usePricingSnapshots`: nova mutation de insert de linha única que aceita `created_at` explícito; a mutation de publish atual não muda.

## Fora de escopo

Fluxo de publicação, seleção de lote da Tabela de Preços, preço físico, Pendências, qualquer cálculo, internos do `NumericInput` e o `api-proxy`.
