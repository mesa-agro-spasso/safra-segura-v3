

# Tarefa 1 — Corrigir dropdown storage_cost_type + atualizar registro

## Correção no formulário (Settings.tsx, linhas 268-271)

Substituir as opções do Select de "Tipo armazenagem":

**De:**
```
<SelectItem value="per_sack">Por saca</SelectItem>
<SelectItem value="percentage">Percentual</SelectItem>
```

**Para:**
```
<SelectItem value="fixed">Fixo (R$/saca)</SelectItem>
<SelectItem value="monthly">Mensal (R$/mês)</SelectItem>
```

O placeholder "Herdar do armazém" já salva `null` corretamente (linha 268: `v || null`).

## Correção do registro com erro

Usar `supabase--insert` para executar:
```sql
UPDATE pricing_combinations 
SET storage_cost_type = NULL 
WHERE id = '05d549ea-be43-491b-85d8-462b63358b1e';
```

## Tarefa 2 — Salvar regras de domínio na memória

Criar `mem://features/pricing-combinations-contract` com todas as regras de campos restritos informadas pelo usuário (commodity, benchmark, storage_cost_type, campos de custo null vs 0, target_basis, is_spot, grain_reception_date). Atualizar o index.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Settings.tsx` | Substituir 2 SelectItems do storage_cost_type |
| `pricing_combinations` (DB) | UPDATE registro com id específico para `storage_cost_type = NULL` |
| `mem://features/pricing-combinations-contract` | Novo — regras de domínio dos campos |
| `mem://index.md` | Adicionar referência ao novo arquivo de memória |

