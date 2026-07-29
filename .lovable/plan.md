## Objetivo

Permitir que a mesa configure a regra de pagamento à vista pela tela, sem SQL. Só leitura/gravação da linha `id = 'default'` de `spot_settings`.

## O que aparece na tela

Novo card "Pagamento à vista" na aba **Parâmetros** de `/configuracoes`, abaixo de "Incremento de Arredondamento":

- **Modo** (select):
  - `weekday` — paga no próximo dia da semana escolhido
  - `next_day` — paga no dia seguinte à negociação
  - `same_day` — paga no mesmo dia da negociação
- **Dia da semana** (select, 7 nomes em português, valor ISO 1–7)
- **Pular semana corrente** (switch) com a explicação do exemplo segunda→terça da semana seguinte
- Nota fixa: se a data cair em fim de semana ou feriado, a API avança para o próximo dia útil — automático, não configurável.
- Linha "Última alteração: DD/MM/AAAA HH:mm" lida de `updated_at`.

Nos modos `next_day` e `same_day`, o select de dia e o switch ficam **desabilitados** (visíveis, valor preservado no estado local; voltar para `weekday` traz a escolha de volta).

Botão **Salvar** habilitado só quando algo mudou, com `AlertDialog` de confirmação mostrando "atual → novo" em texto (modo, dia, pular semana) e o aviso de que isso muda o preço que vai ao produtor.

## Arquivos

**`src/hooks/useSpotSettings.ts`** (novo)
- `useSpotSettings()` — `select * from spot_settings where id = 'default'` (single).
- `useUpdateSpotSettings()` — apenas `UPDATE ... eq('id','default')` com `{ mode, weekday, skip_current_week }`. Sem `updated_at` (trigger no banco), sem insert/delete. Registra `logActivity('spot_settings.update', ...)` seguindo o padrão dos outros hooks. Invalida `['spot_settings']`.

**`src/types/index.ts`**
- `SpotSettings`: `id`, `mode: 'weekday' | 'next_day' | 'same_day'`, `weekday: number`, `skip_current_week: boolean`, `updated_at: string`.

**`src/pages/Settings.tsx`**
- Novo componente `SpotPaymentCard` com o conteúdo acima.
- Renderizado dentro de `ParametersTab`, após `<RoundingIncrementCard />`.

## Notas técnicas

- RLS já permite SELECT e UPDATE para `authenticated`; nenhuma migration é necessária.
- Formatação da data de `updated_at` é só exibição (`toLocaleString('pt-BR')`), não é cálculo de regra.
- Nenhuma função de cálculo de data de pagamento é introduzida; a tela não prevê nem valida datas.

## Fora do escopo

Combinações, armazéns, schema, Edge Functions, tabela de preços e geração de preços — nada disso é tocado.

## Validação manual

1. Trocar o dia para quinta, salvar, conferir `weekday = 4` e `updated_at` novo no Supabase.
2. Trocar o modo para `same_day`: dia e "pular semana" ficam desabilitados, dia continua visível.
3. Voltar para `weekday`: quinta segue selecionada.
4. Restaurar: modo `weekday`, terça, pular semana ligado.
