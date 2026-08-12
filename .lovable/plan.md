# Aba de Pendências em /cadastros

Nova aba "Pendências" na tela `/cadastros`, depois de "Safras", que lê a view `public.v_registry_pending` e mostra registros com campos recomendados ainda vazios.

## Verificação prévia

- A view `public.v_registry_pending` já existe e está nos tipos gerados (`Tables<'v_registry_pending'>`).
- A view devolve uma linha por campo faltante; o agrupamento será feito no cliente.
- Será verificado se `/configuracoes` já aceita o query param `tab` para abrir diretamente na aba "Armazéns"; se não, adicionar leitura mínima desse parâmetro em `Settings.tsx` para o link de ação funcionar.

## O que será construído

### 1. Roteamento e aba

- `src/pages/Cadastros.tsx`: passa a ler o query param `tab` (ex: `/cadastros?tab=companies`) e usa esse valor como `defaultValue` das abas, caindo no primeiro quando ausente.
- Adicionar "Pendências" como último trigger da lista de abas, com contador dinâmico de registros pendentes (não de linhas da view).
- O conteúdo da nova aba usa um componente dedicado `PendingTab`.

### 2. Componente `PendingTab`

- Caminho: `src/components/cadastros/PendingTab.tsx`.
- Lê a view com `supabase.from('v_registry_pending').select('*')` via react-query (query key `['registry', 'pending']`).
- Agrupa as linhas por `(entity, record_id)`, acumulando todos os `missing_field` de cada registro.
- Renderiza uma tabela com as colunas:
  - **Entidade** — traduzida: `companies` → Empresa, `brokers` → Corretora, `warehouses` → Armazém, e fallback para o nome da entidade.
  - **Nome** — campo `label`.
  - **Campos pendentes** — badges com os rótulos em português; campos desconhecidos caem no nome original.
  - **Ação** — botão que leva ao formulário de edição.

### 3. Mapeamento de campos

- Criar mapa `MISSING_FIELD_LABELS` com as chaves conhecidas:
  - `cnpj` → CNPJ
  - `state_registration` → Inscrição estadual
  - `sankhya_code` → Código Sankhya
  - `address` → Endereço
  - `client_code` → Código de cliente
  - `location_id` → Praça
  - `trading_company_id` → Comercializadora
  - `storage_company_id` → Empresa de armazenagem
  - `capacity_kg` → Capacidade
- Campos ausentes no mapa são exibidos com o nome técnico original, sem quebrar a renderização.

### 4. Ações de navegação

- Empresa, Corretora e Praça: navegam para `/cadastros?tab=<tabela>` (onde `<tabela>` é `companies`, `brokers` ou `trading_locations`).
- Armazém: navega para `/configuracoes?tab=warehouses`.
- A tela `/cadastros` interpreta o query param para abrir a aba correta; o modal de edição ainda precisará ser aberto pelo usuário, mas a aba já estará selecionada.

### 5. Contador e estado vazio

- O rótulo da aba exibe o número de registros agrupados, ex: `Pendências (6)`.
- Quando não houver pendências, mostrar mensagem explicando que todos os cadastros estão completos e que os campos listados são apenas recomendados.

## Escopo negativo

- Somente leitura na aba; nenhuma gravação ou edição inline.
- Não alterar a view `v_registry_pending` no banco.
- Não modificar as quatro abas existentes de `/cadastros` (Empresas, Corretoras, Praças, Safras), exceto para adicionar leitura do query param `tab`.
- Não alterar `/configuracoes`, exceto se necessário para ler `?tab=warehouses` e abrir na aba correta.
- Nenhum cálculo financeiro.

## Critérios de aceite

- A aba lista 6 registros (agrupados), não 18 linhas da view.
- Cada registro mostra todos os campos faltantes agrupados como badges.
- O contador da aba mostra 6.
- Os botões de ação navegam para `/cadastros?tab=...` ou `/configuracoes?tab=warehouses`.
- Campos desconhecidos futuros não quebram a renderização.
