# Cabeçalhos fixos nas tabelas do cockpit

## Diagnóstico confirmado

1. **Quem rola verticalmente**
   - **Parâmetros**: o `div` externo com `overflow-auto max-h-[560px]` é o elemento que deveria rolar.
   - **Tabela de preços**: o `div` externo com `overflow-auto max-h-[420px]` é o elemento que deveria rolar.
   - **Preços físicos**: o `div` externo com `overflow-auto max-h-[320px]` é o elemento que deveria rolar.
   - Porém, o componente shadcn `Table` injeta outro `div.relative.w-full.overflow-auto` imediatamente ao redor de todo `<table>`. Esse wrapper interno vira o ancestral de overflow mais próximo do cabeçalho, mas não tem altura limitada e não é quem efetivamente rola na vertical. O `sticky` fica preso ao contexto errado e acompanha a tabela para fora da área visível.
   - **Mercado**: as tabelas usam somente esse wrapper automático; não existe hoje um scroll container vertical limitado por seção.

2. **Ancestrais que criam clipping, scroll ou novo contexto**
   - Entre cada `<th>` e o scroll pretendido existe o wrapper automático do `Table` com `overflow-auto` — causa principal confirmada.
   - Acima do scroll pretendido, `CardContent` tem `overflow-hidden` e o `Card` do cockpit também tem `overflow-hidden`.
   - O card sortable recebe `transform` inline do `@dnd-kit` durante movimentação e `will-change: transform` pode ser introduzido pelo navegador/biblioteca nesse estado; isso fica fora do scroll container da tabela e não deve ser o referencial do sticky em repouso.
   - Não há `contain` nem `filter` nesses componentes.

3. **Card/CardContent**
   - O componente shadcn `Card` puro não adiciona overflow.
   - O cockpit adiciona explicitamente `overflow-hidden` tanto ao `Card` quanto ao `CardContent` em `CockpitShell.tsx`, para recorte do conteúdo nos cantos. Eles contribuem clipping, mas ficam acima dos scroll containers próprios; não é necessário removê-los se houver apenas um scroll owner dentro do conteúdo.

4. **Camadas atuais**
   - **Parâmetros**: cabeçalhos comuns `z-30`, cabeçalhos Praça/Commodity `z-40`, células congeladas do corpo `z-20`.
   - **Tabela de preços**: `thead` em `z-30`, cabeçalhos Praça/Commodity em `z-40`, células congeladas do corpo em `z-20`.
   - **Preços físicos**: `thead` em `z-10`; corpo sem z-index.
   - **Mercado**: cabeçalhos e corpo sem sticky/z-index.
   - A hierarquia de Parâmetros já é adequada; será uniformizada nos demais cards para impedir texto ou linhas sobre o cabeçalho.

5. **Onde o sticky está aplicado**
   - **Parâmetros**: em cada `<th>`.
   - **Tabela de preços** e **Preços físicos**: no `<thead>`.
   - **Mercado**: não há sticky.
   - Para comportamento consistente, o cockpit passará a aplicar `sticky top-0` em cada `<th>`, não no `<thead>`.

## Escopo encontrado

Há quatro cards com tabelas: **Tabela de preços**, **Mercado (bolsa)**, **Preços físicos** e **Parâmetros das combinações**. Eles compartilham o componente genérico `Table`, mas não compartilham um componente de scroll próprio do cockpit. Alterar o overflow padrão do `Table` globalmente afetaria outras telas, portanto a correção será reutilizável e opt-in no cockpit.

## Implementação proposta

1. Estender o componente `Table` com uma opção **opt-in** para desativar o overflow do wrapper automático. O padrão permanece idêntico ao atual, de modo que nenhuma tela fora do cockpit muda de comportamento.
2. Criar um wrapper de tabela do cockpit que seja o **único** dono dos dois eixos de scroll; dentro dele, o wrapper automático do `Table` ficará sem overflow.
3. Migrar para esse wrapper as tabelas do cockpit que hoje possuem scroll vertical próprio:
   - **Parâmetros das combinações** (560px), **Tabela de preços** (420px) e **Preços físicos** (320px), preservando exatamente esses limites;
   - aplicar fundo opaco, `sticky top-0` e z-index em cada cabeçalho;
   - manter Praça/Commodity com `sticky left-*`, corpo em `z-20` e células de canto em `z-40`.
4. **Card de Mercado**: as tabelas não possuem hoje scroll vertical próprio nem altura máxima, portanto não apresentam o defeito. Ficará **intocado** — nenhum limite de altura novo será criado — e isso será declarado no relatório final.
5. Não alterar filtros, colunas, larguras, rótulos, formatação, valores ou lógica de dados.

## Verificação

- Em **Parâmetros das combinações**, rolar até o fim e horizontalmente: cabeçalho permanece visível; Praça e Commodity permanecem à esquerda; células do canto ficam acima do cabeçalho e do corpo.
- Repetir em **Tabela de preços** e conferir também **Preços físicos/Mercado**.
- Inspecionar estilos computados para confirmar um único ancestral de scroll entre `<th>` e a área rolável.
- Conferir visualmente ausência de transparência, texto vazando e linhas do corpo sobre o cabeçalho, sem mudança em nenhum valor exibido.