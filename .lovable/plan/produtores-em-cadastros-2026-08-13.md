# Produtores em /cadastros

Mover o cadastro de produtores para uma nova aba em `/cadastros` (entre Safras e Pendências), no mesmo padrão visual das demais abas, e apagar a tela `/produtores`.

## Nova aba Produtores

- Tabela com colunas: Nome, Documento (CPF/CNPJ formatado), Responsável, Telefone, E-mail, Praças (nomes), Ativo, Ações.
- Busca por texto (nome, documento, responsável, e-mail, código Sankhya), toggle "Mostrar inativos", botão "Novo produtor", edição em modal, switch ativo/inativo na linha. Sem exclusão.
- Formulário: `full_name` (obrigatório), `tax_id`, `responsible_name`, `phone`, `email`, `farm_address`, `sankhya_code`, `location_ids`, `notes`, `active`.
- `credit_rating` não aparece, não é lido nem gravado.

## Documento (tax_id)

- Máscara dinâmica na digitação: até 11 dígitos formata como CPF, de 12 a 14 como CNPJ.
- Validação de dígito verificador no cliente antes de enviar: CPF quando 11 dígitos, CNPJ quando 14; qualquer outra quantidade é barrada com mensagem clara. Campo vazio é permitido.
- Envia só os dígitos ao banco; exibe formatado na tabela.

## Praças (location_ids)

- Multi-select fechado, carregado de `trading_locations` (só ativas), mostrando `name` e gravando `id`. Nunca texto livre.
- Busca por nome insensível a maiúsculas, acentos e pontuação (normalização NFD + remoção de diacríticos e não-alfanuméricos).
- Praças selecionadas aparecem como chips removíveis; ao editar, ids que não existirem mais são exibidos como "desconhecido" e podem ser removidos.

## Remoções

- `src/pages/Producers.tsx`, a rota `/produtores` em `AppLayout.tsx`, o item de menu em `AppSidebar.tsx` e a flag `FEATURES.PRODUCERS`.
- `ProducerFormDialog.tsx` (+ seu teste), `ProducerOperationsList.tsx`, `ProducerDetailsDialog.tsx`, `StarRating.tsx` — verificado: só a tela antiga os usa.
- `useDeleteProducer` sai de `useProducers.ts`. `useProducers` **fica**: é usado por `OperacoesD24.tsx`. `useProducerOperations` / `useProducerOperationCounts` também saem se ninguém mais os usar (confirmação na hora da edição).

## Detalhes técnicos

- Novo componente `src/components/cadastros/ProducersTab.tsx` (o `EntityTab` genérico pressupõe id textual definido pelo usuário; `producers.id` é uuid gerado, então a aba é própria).
- Novo hook `src/hooks/useProducerRegistry.ts` (ou extensão de `useProducers.ts`) com list/create/update, registrando em `activity_log` como as outras abas.
- `validators.ts` ganha `maskCPF`, `isValidCPF`, `formatTaxId`, `maskTaxId` (espelham `public.is_valid_cpf` / `is_valid_cnpj`) e um helper de normalização de busca.
- `Producer` em `src/types/index.ts` atualizado: `location_ids`, `sankhya_code`, `active`; remove `warehouse_ids` e o uso de `credit_rating` na interface.
- `Cadastros.tsx` ganha a aba `producers` na lista de abas válidas (deep-link `?tab=producers`), mantendo a ordem Empresas · Corretoras · Praças · Safras · Produtores · Pendências. Acesso admin permanece o da rota.
