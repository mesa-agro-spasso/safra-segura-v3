

# Duas correções cirúrgicas — PricingTable.tsx + Market.tsx

## Arquivo 1: `src/pages/PricingTable.tsx`

### Edição — após linha 147 (fechamento do IIFE do semáforo)

Inserir o bloco IIFE da segunda linha de status (tabela gerada) logo após `})()}` na linha 147, antes do `</div>` na linha 148. Usa `lastUpdated` já existente (linha 83).

## Arquivo 2: `src/pages/Market.tsx`

### Edição 1 — novo estado `confirmingB3` + handler

Adicionar `const [confirmingB3, setConfirmingB3] = useState(false);` junto aos outros estados B3 (após linha ~67). Adicionar `handleConfirmB3Update` como função async no componente.

### Edição 2 — substituir CardHeader do card Milho B3 (linhas 437-439)

Substituir o `<CardHeader>` simples pelo layout flex com título à esquerda e botão condicional à direita.

## O que NÃO muda

Nenhum outro trecho de nenhum dos dois arquivos.

