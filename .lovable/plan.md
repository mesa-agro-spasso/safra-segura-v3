# Cockpit de Precificação

Tela nova em `/cockpit`, aba própria no menu ao lado de Tabela de Preços. As duas coexistem: o cockpit é onde a mesa ajusta e publica; a Tabela de Preços continua sendo o que o comercial lê.

## Fluxo

1. Abre listando todas as combinações ativas.
2. Operadora edita parâmetros em quantas linhas quiser.
3. RECALCULAR — os preços atualizam, nada é gravado.
4. PUBLICAR — grava a tabela e depois o cadastro.

PUBLICAR fica travado enquanto existir edição não recalculada.

## Preços iniciais

A tela abre com o último lote de `pricing_snapshots` — exatamente o que a Tabela de Preços exibe. Combinação ativa que não está nesse lote aparece com aviso "sem preço no lote vigente" e um botão para recalcular. Nenhuma chamada à API na montagem.

## Valores iniciais dos campos

Por ordem: `outputs_json.resolved_inputs` do snapshot da linha, quando existe — traz valor e camada de origem por parâmetro. Sem snapshot, o valor da combinação; sem ele, o do armazém.

Campo cuja origem é `warehouse` ou `system_default` recebe uma marca discreta (texto cinza "herdado"), sem destaque de cor. O que sai do padrão — valor próprio da combinação — é o que fica visualmente evidente.

## Editáveis

Por linha: juros · armazenagem e tipo de armazenagem · recepção · corretagem · mesa (desk) · quebra · desconto adicional · basis alvo.

**Período dos juros: somente leitura**, exibido como herdado do armazém. A tabela `pricing_combinations` não tem essa coluna, então um campo editável ali seria perdido no publicar.

Não editável: praça, commodity, ticker, datas, método de precificação.

Campos estruturantes aparecem na linha fechada; os editáveis abrem em painel colapsável (`Collapsible`), agrupados em Custos (juros, armazenagem, recepção, corretagem, mesa, quebra) e Preço (basis alvo / preço líquido alvo, desconto adicional).

Campo editado nesta sessão recebe borda de destaque e um ponto marcador; enquanto não recalculou, o preço da linha fica esmaecido com a legenda "não recalculado".

## Recalcular

Chama `POST /pricing/table` com o mesmo payload em camadas do GeneratePricingModal: `trade_date` em Brasília, `spot_usd_brl` no nível da requisição, `exchange_rate_override` só em linha CBOT, camadas `combination` e `warehouse` cruas, `is_spot` sem `payment_date`, `additional_discount_brl` omitido no TARGET_PRICE. Mesmas validações de mercado (ticker ausente, B3 sem preço, contrato vencido, milho CBOT acima de 24h).

Diferença única: os valores editados na tela substituem os da camada `combination`. Não editados vão como estão do cadastro. Zero conversão null↔0.

Nada é gravado. Resultado vive no estado da tela. Descartes aparecem em bloco na tela reutilizando `DiscardedCombinationsList`; as demais linhas calculam normalmente.

## Publicar — duas escritas, nesta ordem

**Primeiro a tabela.** Insere os snapshots em `pricing_snapshots` via `useSavePricingSnapshots`, montados igual ao GeneratePricingModal, com `outputs_json: { ...r }` por spread.

**Depois o cadastro.** Atualiza os campos editados nas linhas de `pricing_combinations` via `useUpsertPricingCombination`, uma por linha editada.

Se a segunda etapa falhar, a mensagem (dialog persistente, não toast) diz as três coisas:
- a tabela foi publicada e já está valendo;
- o cadastro destas linhas não foi alterado — lista nomeando praça · commodity · ticker;
- o que fazer: publicar de novo pelo cockpit, não gerar tabela de novo.

Publicar substitui a tabela vigente por ser o lote mais recente. Nada é apagado; os lotes anteriores permanecem no histórico.

## Fora desta entrega

Simulação de dólar e futuro, camada de seguro, criar/duplicar combinação, exportar, comparação lado a lado, rascunho persistente, versionamento, edição de armazém. Recarregar a página descarta as edições.

## Detalhes técnicos

Arquivos novos:
- `src/pages/Cockpit.tsx` — página, estado das edições (`Map<comboId, Partial<overrides>>`), flag `dirty`, resultado do recálculo.
- `src/components/cockpit/CockpitRow.tsx` — linha colapsável com os campos.
- `src/lib/cockpitPayload.ts` — monta o payload de `/pricing/table` a partir de combinações + armazéns + market data + overrides, e monta os snapshots a partir da resposta. Sem aritmética financeira: só cópia de campos.

Alterados: `src/components/AppLayout.tsx` (rota `/cockpit`), `src/components/AppSidebar.tsx` (item de menu).

Hooks reutilizados sem alteração: `usePricingCombinations(true)`, `useActiveArmazens`, `useMarketData`, `usePricingSnapshots`, `useSavePricingSnapshots`, `useUpsertPricingCombination`.

Não serão tocados: `PricingTable.tsx`, `GeneratePricingModal.tsx`, `Settings.tsx`, Edge Functions, schema.

Regras da casa mantidas: zero cálculo financeiro no frontend, leitura só dos campos do topo da resposta (nunca `engine_result`), snapshot gravado por spread do objeto inteiro.
