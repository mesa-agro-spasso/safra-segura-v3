# Tela de Cadastros (/cadastros)

Nova área administrativa com quatro abas para entidades de referência que hoje só existem no banco: Empresas, Corretoras, Praças e Safras.

## Verificação prévia (banco)

- As quatro tabelas existem, têm leitura liberada para usuários autenticados e escrita restrita a admin (`is_admin(auth.uid())`), com permissões de tabela corretas — o CRUD funciona sem migration.
- Os tipos gerados já contêm `companies`, `brokers`, `trading_locations` e `harvests` em `src/integrations/supabase/types.ts`.
- Triggers de normalização já rodam no banco (id em maiúsculas, CNPJ/CEP sem formatação, e-mail em minúsculas, campos vazios viram nulo) — a UI não precisa normalizar, só validar.

## Acesso

- Rota `/cadastros` registrada em `AppLayout` envolvida por `AdminRoute` (mesmo padrão de `/admin/usuarios`).
- Item de menu na sidebar exibido apenas quando `isAdmin()` for verdadeiro.

## Estrutura da tela

Página única com abas shadcn na ordem Empresas · Corretoras · Praças · Safras. Cada aba tem:

- Campo de busca por texto (filtra id, nome/razão social e demais campos textuais relevantes, no cliente).
- Alternância para mostrar/ocultar inativos.
- Tabela dos registros, com badge de status e switch de ativo/inativo direto na linha.
- Botão "Novo" e ação "Editar" por linha, ambos abrindo um modal de formulário.
- Sem exclusão em nenhuma aba.

## Formulários

- **Empresas**: id, razão social, nome fantasia, CNPJ, inscrição estadual, código Sankhya, atividade (Trading / Armazenagem), endereço completo (logradouro, número, complemento, bairro, cidade, UF, CEP), ativo.
- **Corretoras**: id, razão social, nome fantasia, CNPJ, código de cliente, contato (nome, e-mail, telefone), corretagem por contrato CBOT e B3, observações, ativo.
- **Praças**: id, nome, cidade, UF, observações, ativo.
- **Safras**: id, nome, commodity (Soja / Milho), início, fim, observações, ativo.

Regras aplicadas no formulário:

- `id` obrigatório e imutável: editável apenas na criação, somente A–Z e 0–9, 3–12 caracteres em Empresas/Corretoras e 3–16 em Praças/Safras. Em edição aparece bloqueado.
- CNPJ com máscara na digitação e validação de dígito verificador antes de enviar; exibido formatado na tabela.
- CEP com 8 dígitos; UF com duas letras maiúsculas.
- Safras: fim não pode ser anterior ao início; ambas opcionais; sobreposição entre safras é permitida.
- Campos de corretagem marcados com nota discreta de que ainda não têm efeito no sistema.
- Erros do Postgres (checks, unicidade, CNPJ inválido) são traduzidos para mensagem legível em toast, com o detalhe do banco como texto de apoio.

## Detalhes técnicos

- `src/hooks/useReferenceData.ts`: hooks de leitura e mutação por tabela via react-query, usando `Tables<'companies'>`, `TablesInsert<...>` e `TablesUpdate<...>` dos tipos gerados — sem interfaces manuais em `src/types/index.ts`.
- `src/lib/pgError.ts`: mapeia códigos/mensagens do Postgres (23505, 23514, 23503, violações de CNPJ) para texto em português.
- `src/lib/validators.ts` (ou extensão de `src/lib/masks.ts`): validação de CNPJ por dígito verificador, CEP e UF, espelhando `is_valid_cnpj` do banco.
- `src/pages/Cadastros.tsx`: shell com Tabs; cada aba em `src/components/cadastros/<Entidade>Tab.tsx` compartilhando uma tabela e um modal genéricos para evitar quatro cópias do mesmo código.
- Reuso de `DateInput` nas datas de safra e de `logActivity` nas gravações, seguindo o padrão das telas administrativas existentes.
- Nenhum cálculo; nenhuma alteração em telas existentes além do item de menu e do registro de rota.
