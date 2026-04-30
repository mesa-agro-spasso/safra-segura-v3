## Logo colorida no tema claro

Hoje o app usa `/logo-safra-segura.png` (versão para fundo escuro) tanto no tema escuro quanto no claro. No tema claro, vamos passar a exibir a logo colorida que você anexou, mantendo as mesmas proporções da atual.

### Passos

1. **Adicionar o asset**
   - Copiar `user-uploads://Safra-Segura-Graos.pdf-2.png` para `public/logo-safra-segura-light.png`.

2. **Detecção de tema**
   - O tema claro corresponde à ausência da classe `dark` em `<html>` (definida em `src/contexts/AuthContext.tsx`).
   - Em `AppSidebar.tsx` e `Login.tsx`, observar essa classe via um pequeno hook local com `MutationObserver` em `document.documentElement` (sem novos arquivos: definido inline no próprio componente). Estado inicial baseado em `document.documentElement.classList.contains('dark')`.

3. **Trocar o `src` da logo conforme o tema**
   - Em `src/components/AppSidebar.tsx` (linhas 9 e 67-71): quando expandido, usar `logoLight` (nova) se tema claro, senão `logo` atual. Quando colapsado, manter o ícone atual (`iconCollapsed`) — ele já funciona em ambos os temas.
     - Mesmas classes (`w-36 object-contain`) — proporções preservadas.
   - Em `src/pages/Login.tsx` (linha 83): mesma lógica para o `<img>` da tela de login. Mesmas classes (`w-48 mx-auto mb-2`).

4. **Restrições**
   - Apenas 3 arquivos tocados: `public/logo-safra-segura-light.png` (novo), `src/components/AppSidebar.tsx`, `src/pages/Login.tsx`.
   - Sem novas dependências, sem ThemeProvider global, sem alterar `index.css`.
   - Proporções e tamanhos da logo permanecem idênticos.
