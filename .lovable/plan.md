## Estado atual (verificado)

- `src/pages/PricingTable.tsx` (linhas 496-497) já lê `outputs_json.purchased_basis_brl` e `outputs_json.breakeven_basis_brl` — campos do **topo**, não de `engine_result`. Não há nenhuma leitura de `engine_result` nesta tela (a única no app está em `OperacoesD24.tsx`, fora do escopo).
- Faltam os campos USD: `purchased_basis_usd` / `breakeven_basis_usd` não aparecem em lugar nenhum da tabela de preços.
- `GeneratePricingModal.tsx` grava `outputs_json: { ...r }`, ou seja, a resposta inteira de `/pricing/table` — os campos do topo chegam ao snapshot sem transformação.

## O que muda

Arquivo único: `src/pages/PricingTable.tsx`, seção "Preços e Basis" do diálogo de detalhe.

1. Extrair um helper local de leitura, sem cálculo:
   - lê a chave direto de `outputs`, retorna `null` se ausente ou não numérica;
   - `null` → renderiza traço (`-`), nunca zero, nunca fallback para `engine_result`.
2. Manter as duas linhas BRL como estão (já corretas), passando pelo helper para uniformizar.
3. Adicionar duas linhas USD **condicionais**, renderizadas apenas quando o campo existe no topo:
   - "Purchased basis (USD)" → `purchased_basis_usd`
   - "Breakeven basis (USD)" → `breakeven_basis_usd`
   - Ausentes no milho B3 → a linha simplesmente não é montada (nem traço, nem zero), seguindo o padrão já usado nas linhas de custo.
4. Reforço de comentário curto no topo do bloco: `engine_result` é auditoria, não fonte de exibição.

Nada muda no tooltip da linha (ele mostra breakdown de custos e basis alvo, não purchased/breakeven).

## Fora do escopo (não tocado)

`ExportPricingModal.tsx`, `OperacoesD24.tsx`, `Settings.tsx`, schema, Edge Functions e o fluxo de geração da tabela.

## Regras respeitadas

- Zero cálculo no frontend: só leitura e formatação (`toFixed`).
- Snapshot antigo sem os campos → traço no BRL, linha ausente no USD; jamais número da engine.

## Validação manual (Eduardo)

1. Gerar tabela nova e conferir na calculadora: `purchased_basis` = preço publicado − futuro.
2. Abrir snapshot antigo: basis com traço, sem número errado.
3. Linha de milho B3: nenhuma linha USD na tela.
