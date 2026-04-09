

# Correções na aba "Criar Ordem" — Orders.tsx

## 3 edições no arquivo `src/pages/Orders.tsx`

### Correção 1 — sessionStorage (linhas 64-73)

Substituir os 5 estados (`selectedWarehouse`, `commodityType`, `selectedSnapshot`, `volume`, `linkedOperationId`) por versões que leem de `sessionStorage` no init e gravam a cada alteração via wrappers `set*Raw` + `set*`.

No reset após sucesso (linhas 236-240), adicionar 5 chamadas `sessionStorage.removeItem(...)`.

### Correção 2 — reordenar campos (linhas 331-363)

Mover o bloco "Volume + Vinculada à operação" (linhas 346-362) para **antes** do bloco "Preço de Referência" (linhas 331-344). Ordem final:

1. Praça | Commodity
2. Volume | Vinculada à operação
3. Preço de Referência (span 2)
4. ID da Operação (span 2)

Atualizar placeholder do Select de Preço de Referência: `'Preencha volume primeiro'` → `'Informe o volume primeiro'`.

### Correção 3 — card Resultado (linhas 466-494)

Substituir o card inteiro por versão que:
- Título: "Resultado da Validação"
- Se `alerts` vazio ou inexistente: mostra `✓ Ordem válida — nenhum alerta` em verde
- Se há alerts: mostra cada um com ícone e cor por level
- Labels traduzidos: "Mensagem de Ordem", "Mensagem de Confirmação"

### O que NÃO muda

Abas "Ordens Existentes" e "Registro Manual", `handleBuildOrder`, `handleManualSave`, editor de pernas.

