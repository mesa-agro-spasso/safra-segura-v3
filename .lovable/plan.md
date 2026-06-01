# Sistema de Ajuda In-App

Implementar conteúdo de ajuda navegável em dois pontos de entrada: página dedicada `/ajuda` e drawer contextual acionado por um botão `?` no topbar, presente em todas as telas autenticadas.

## Arquivos a criar

### 1. `src/data/helpContent.ts`
Conteúdo estruturado em `HelpSection[]` com tipos `HelpBlock` (`p`, `h3`, `callout`, `table`, `list`). Todo o conteúdo das 11 seções (Acesso, Tabela de Preços, Operações, Ordens, Armazéns, Mercado, Configurações, Aprovações, Administração, Perfil, Glossário) conforme o texto fornecido. Cada seção carrega `id`, `title`, `route` e `blocks`.

### 2. `src/pages/Ajuda.tsx`
Layout de duas colunas dentro do `AppLayout` existente:
- **Sidebar esquerda** (sticky, ~220px): lista numerada com âncoras para `#${section.id}`. Item ativo destacado via `IntersectionObserver` conforme a coluna direita rola.
- **Coluna direita** (scrollable): renderiza todas as seções em sequência, cada uma com `id={section.id}` para suportar ancoragem.
- Renderizador de blocos compartilhado (`renderBlock`) reaproveitado pelo drawer:
  - `p` → `<p class="text-sm leading-relaxed text-foreground/80">`
  - `h3` → `<h3 class="text-base font-semibold mt-6 mb-2">`
  - `callout` → `<div class="border-l-2 border-primary bg-muted/40 px-4 py-2 my-3 text-sm">`
  - `table` → componente `Table` do shadcn com header em `bg-muted/50` e células `border`
  - `list` → `<ul class="list-disc pl-5 space-y-1 text-sm">`

### 3. `src/components/HelpDrawer.tsx`
- `Sheet` (shadcn) lado direito, `className="w-[480px] sm:max-w-[480px]"`.
- Trigger: `Button` ghost icon com `HelpCircle` (lucide-react) + `Tooltip "Ajuda"`.
- Ao abrir: lê `useLocation().pathname`, mapeia para `section.id` via dicionário e faz `scrollIntoView({behavior:'smooth'})` dentro do `ScrollArea` (com `setTimeout(…, 50)` para garantir mount).
- Topo do drawer: barra de pills clicáveis com todos os títulos para navegação interna rápida.
- Conteúdo: extrai a função `renderBlock` para módulo compartilhado (`src/components/help/renderBlock.tsx`) consumida tanto por `Ajuda.tsx` quanto pelo drawer (evita duplicação).
- Rodapé: link "Ver manual completo →" que navega para `/ajuda` e fecha o drawer.

### Mapa de rotas → seção (drawer)
```
/             → tabela-de-precos
/operacoes-d24 → operacoes
/ordens-d24    → ordens
/armazens-d24  → armazens
/mercado       → mercado
/configuracoes → configuracoes
/aprovacoes    → aprovacoes
/admin/usuarios → administracao
/perfil        → perfil
outras         → topo
```
(Observação: o prompt original usava `/operacoes`, `/ordens`, `/armazens`, `/administracao`. As rotas reais do projeto são `*-d24` e `/admin/usuarios` — vou usar as rotas reais.)

## Arquivos a editar

### `src/components/AppLayout.tsx`
- Adicionar a rota `{ path: '/ajuda', element: <Ajuda /> }` em `routes`.
- Importar e renderizar `<HelpDrawer />` no `header`, alinhado à direita (`ml-auto`).
- Esconder o trigger quando `useLocation().pathname === '/ajuda'` (evita ajuda-sobre-ajuda).

## Detalhes técnicos

- **Scroll spy** (`Ajuda.tsx`): `IntersectionObserver` com `rootMargin: '-40% 0px -55% 0px'` para marcar a seção visível.
- **Âncoras dentro do drawer**: usar `ref` por seção em vez de `getElementById` (drawer pode coexistir com a página `/ajuda` que teria IDs iguais).
- **Sem mudanças de lógica de negócio**: apenas conteúdo estático e UI.
- **Tokens semânticos**: `border-primary`, `bg-muted/40`, `text-foreground/80` — nada de cores hardcoded.
- **Acessibilidade**: `aria-label="Abrir ajuda"` no trigger; `SheetTitle` para o drawer.

## Fora de escopo
- Busca dentro da ajuda.
- Internacionalização (conteúdo é PT-BR fixo).
- Persistência da última seção visitada.
