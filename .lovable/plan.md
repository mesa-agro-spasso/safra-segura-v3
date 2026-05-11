## Aba Produtores — cadastro completo + vínculo com operações

### 1. Schema (migration)

**Expandir `producers`** (já tem `id`, `name`, `notes`, `created_at`):
- Renomear `name` → `full_name` e tornar **nullable** (todos os campos são opcionais)
- `responsible_name` text nullable
- `tax_id` text nullable (CPF/CNPJ, só máscara visual)
- `phone` text nullable
- `email` text nullable
- `farm_address` text nullable
- `warehouse_ids` text[] nullable DEFAULT '{}' ← praças vinculadas (IDs de `warehouses.id`)
- `credit_rating` smallint nullable, CHECK (credit_rating BETWEEN 1 AND 3)
- `updated_at` timestamptz + trigger `update_updated_at_column`
- Índice GIN em `warehouse_ids` para filtros

Todos os campos do produtor são informativos e opcionais — sem NOT NULL além do `id`.

**`operations.producer_id`** já existe — adicionar FK `REFERENCES producers(id) ON DELETE SET NULL` + índice.

Replicar no schema `staging`.

### 2. Hooks (`src/hooks/`)
- `useProducers.ts` — list/get/create/update/delete + `useProducerOperations(producerId)` (operações com `display_code`, status, volume, datas, warehouse).
- `useUpdateOperationProducer.ts` — vincula/desvincula `producer_id` em operação existente.

### 3. Página `src/pages/Producers.tsx` (substitui placeholder)

Header com botão **"Novo produtor"** → `ProducerFormDialog`.

Tabela colunas: Nome | Responsável | CPF/CNPJ | Telefone | Email | Endereço | Praças (badges) | Nota (estrelas) | Operações (contagem) | Ações.

- Ordenação clicável em todas as colunas (ASC/DESC). Nulos vão para o final.
- Filtros por coluna (popover na header):
  - Texto contains (case-insensitive): Nome, Responsável, CPF/CNPJ, Telefone, Email, Endereço
  - Multi-select Praças (lista `useActiveArmazens`, filtra se `warehouse_ids` contém algum selecionado)
  - Nota: checkboxes 1/2/3/sem nota
- Linha clicável → `Collapsible` com lista de operações vinculadas. Click numa operação → `navigate('/operacoes?op=<id>')`.
- Células vazias mostradas como "—" para diferenciar de string vazia.

### 4. Componentes (`src/components/producers/`)
- **`ProducerFormDialog.tsx`** — todos os campos opcionais: Nome, Responsável, CPF/CNPJ (máscara), Telefone (máscara BR), Email, Endereço, Praças (multi-checkbox dos armazéns ativos), Nota (3 estrelas + "sem nota"), Notas. Sem validação obrigatória além de tipos básicos (email format se preenchido).
- **`ProducerOperationsList.tsx`** — collapsible com operações + click handler.
- **`StarRating.tsx`** — 1–3 estrelas, modos readonly/editável, suporta valor nulo.

### 5. Vinculação tardia em Operações
- `OperacoesD24.tsx`: nova coluna **"Produtor"** na tabela:
  - Vinculado: nome do produtor (ou "—" se sem nome) com link para `/produtores`
  - Não vinculado: botão "Vincular" → popover Combobox de produtores + atalho "+ Novo produtor"
- Form de criação de operação: campo opcional Produtor (Combobox + criar inline).

### 6. Deep-link `?op=<id>` em `/operacoes`
- `OperacoesD24.tsx` lê `searchParams.get('op')`, abre `Sheet` com detalhes da operação, limpa o param ao fechar.

---

### Arquivos novos
```text
supabase/migrations/<ts>_producers_expand.sql
src/hooks/useProducers.ts
src/hooks/useUpdateOperationProducer.ts
src/components/producers/ProducerFormDialog.tsx
src/components/producers/ProducerOperationsList.tsx
src/components/producers/StarRating.tsx
src/lib/masks.ts
```

### Arquivos editados
```text
src/pages/Producers.tsx           (substitui placeholder)
src/pages/OperacoesD24.tsx        (coluna Produtor + deep-link ?op=)
src/types/index.ts                (Producer com todos campos nullable)
```

### Notas
- Sem cálculos financeiros, só CRUD/UI.
- Todos os campos do produtor são **opcionais/informativos** — nada bloqueia o cadastro.
- Ordenação/filtragem client-side (volume baixo).
- Máscara CPF/CNPJ apenas visual (sem validação de dígito).
- RLS: `ALL` para `authenticated` (consistente com o projeto).
- `producer_id` em `operations` continua opcional para vinculação tardia.
