# Usuários em /cadastros + correção do select de unidade no cadastro

## Observação importante antes de remover a tela antiga

A tela atual de administração (rota real: `/admin/usuarios`, e não `/administracao`) tem **duas** abas:

1. **Usuários** — gestão de usuários (será reconstruída em `/cadastros`).
2. **Registros** — log de atividades (`ActivityLogTab`), que não é gestão de usuários.

Proposta: mover a aba **Registros** para `/cadastros` como uma aba adicional (última, depois de Pendências), reutilizando o componente existente sem alterações. Assim nada se perde e a rota antiga pode sair. Se preferir manter Registros em outro lugar, é só dizer.

## Tarefa 1 — Unidade no autocadastro

Em `src/pages/Login.tsx`, o select de Unidade deixa de usar `useActiveArmazens` (bloqueado por RLS para visitante anônimo) e passa a chamar a RPC `list_signup_units()` (sem argumentos, retorna `{id, display_name}`), via um hook novo e pequeno em `src/hooks/useWarehouses.ts` (`useSignupUnits`). "Sede" continua como primeira opção, significando sem armazém (`warehouse_id` vazio). O contrato de metadados do `signUp` (`full_name`, `job_title`, `phone`, `warehouse_id`) não muda.

## Tarefa 2 — Aba "Usuários" em /cadastros

Novo componente `src/components/cadastros/UsersTab.tsx`, no mesmo padrão visual das demais abas (busca por texto, tabela, modal de edição), registrado em `src/pages/Cadastros.tsx` entre Produtores e Pendências, com deep-link `?tab=users`.

**Dados:** `public.users`, filtrando `deleted_at is null` e `is_owner = false`.

**Colunas:** Nome · Email · Cargo · Unidade (`display_name` do armazém vinculado, ou "Sede" quando `warehouse_id` é nulo) · Telefone · Função (papéis, editor atual mantido) · Status (badge: Pendente amarelo, Ativo verde, Desativado cinza) · Admin (badge/ícone quando `is_admin`) · Ações.

**Ordenação:** pendentes primeiro, depois por nome. **Filtro:** alternância "Somente pendentes".

**Ações por linha:**
- Aprovar (só em `pending`) → `status='active'`, `approved_by` = admin logado, `approved_at` = agora. Com diálogo de confirmação.
- Desativar (só em `active`) → `status='disabled'`. Com diálogo de confirmação.
- Reativar (só em `disabled`) → `status='active'`.
- Editar (modal): nome completo, cargo, telefone, unidade (select "Sede" + armazéns ativos via `useActiveArmazens`), papéis (mesmo editor de hoje) e chave de admin.
- Sem exclusão em lugar nenhum; o soft delete atual não é portado.

Todas as escritas são `UPDATE` direto em `public.users`, com erros traduzidos por `pgErrorMessage` e registro em `logActivity`, como nas demais telas.

## Remoções

- `src/pages/AdminUsers.tsx` apagado (o editor de papéis é movido para o novo componente).
- Rota `/admin/usuarios` removida de `src/components/AppLayout.tsx`.
- Item de menu correspondente removido de `src/components/AppSidebar.tsx`.
- Mapeamento de ajuda `'/admin/usuarios'` em `src/components/HelpDrawer.tsx` repontado para `/cadastros`.
- `ActivityLogTab` permanece onde está e passa a ser usado por `Cadastros.tsx`.

## Fora de escopo

Banco de dados (migrations, RLS, triggers), controle de acesso por página, operações/ordens/precificação e a Edge Function `api-proxy`.
