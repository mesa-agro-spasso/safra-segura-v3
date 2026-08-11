# Corrigir a aba Armazéns em Configurações

A aba está quebrada porque o formulário ainda exige e envia a coluna `abbr`, que não existe mais no banco. Além disso, quatro campos novos do armazém não aparecem em lugar nenhum.

## O que muda

### 1. Remover a abreviação (bug crítico)
Em `src/pages/Settings.tsx`, dentro do `WarehousesTab`:
- tirar `abbr` do objeto de armazém em branco e do envio ao salvar;
- remover a validação de 2 a 5 letras e o estado de erro correspondente;
- remover o campo "Abreviação" do formulário e a coluna "Abreviação" da tabela;
- remover a mensagem de erro específica de abreviação duplicada (o erro genérico continua).

### 2. Quatro campos novos no formulário
- **Praça** — lista as praças ativas pelo nome. Opcional, com opção "Nenhuma" para limpar.
- **Comercializadora** — lista apenas empresas com atividade TRADING, pelo nome legal. Opcional, com opção de limpar.
- **Empresa de armazenagem** — lista apenas empresas com atividade STORAGE, pelo nome legal. Opcional, com opção de limpar.
- **Capacidade (kg)** — número em quilos, sem conversão. Vazio é aceito; zero ou negativo é bloqueado antes de enviar, com mensagem.

As duas listas de empresa nunca se misturam: são papéis distintos.

### 3. Estado (UF)
O campo passa a converter para maiúscula enquanto se digita e a exigir exatamente duas letras antes de salvar (vazio continua permitido).

### 4. Tabela de armazéns
Passa a mostrar: Nome, Cidade, Estado, Tipo, **Praça**, **Comercializadora**, **Capacidade (kg)**, Status. Praça e comercializadora aparecem pelo nome legível, resolvido a partir das listas carregadas; capacidade com separador de milhar.

## Detalhes técnicos
- Fontes de dados: hook existente `useReferenceRows` (`trading_locations` e `companies`), já usado na tela de Cadastros. Filtro de ativos nas praças e filtro por `activity` nas empresas feito em memória.
- Selects usam um valor sentinela interno para "nenhum", gravando `null` no banco.
- `capacity_kg` enviado como número ou `null`; nunca `0`.
- Nada de cálculo: capacidade é exibida exatamente como armazenada.
- `src/types/index.ts`: remover `abbr` da interface `Warehouse` e acrescentar os quatro campos novos como opcionais/nulos.
- Efeito colateral necessário: `src/pages/ArmazensD24.tsx` lê `warehouse.abbr` em dois pontos (badge e legenda). Com o campo fora do tipo, essas duas leituras passam a usar o `id` do armazém — é a mudança mínima para não deixar a tela quebrada; nenhuma outra alteração ali.

## Fora de escopo
CombinationsTab, ParametersTab, AlcadasTab, `basis_config`, campos de custo e a exclusão por soft delete continuam intocados.
