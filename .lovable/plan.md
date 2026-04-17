

# Logo, Login e PWA Setup

## Assets já confirmados em `public/`
Todos os ícones listados (16 → 512), `logo-safra-segura.png`, `icon-48x48.png`, `favicon.ico` e variantes transparent já existem. Nada a copiar.

## Mudança 1 — `src/components/AppSidebar.tsx`
- Remover `import logo from '@/assets/safra-segura-logo.png'`
- Adicionar dois imports relativos a `public/`:
  - `import logo from '/logo-safra-segura.png'`
  - `import iconCollapsed from '/icon-48x48.png'`
- No bloco da logo (linhas 41-47): renderizar condicionalmente
  - Colapsado: `<img src={iconCollapsed} className="w-8 h-8 object-contain" />`
  - Expandido: `<img src={logo} className="w-36 object-contain" />`
- Container `<div>` mantém apenas `flex items-center justify-center` + padding. Sem `bg-*`. (Já não há fundo colorido hoje — confirmado.)

## Mudança 2 — `src/pages/Login.tsx` (não existe `Auth.tsx`)
Linhas 60-63 do `CardHeader`:
- Remover `<CardTitle>SAFRA SEGURA</CardTitle>`
- Inserir `<img src="/logo-safra-segura.png" alt="Safra Segura" className="w-48 mx-auto mb-2" />`
- Manter `<p className="text-sm text-muted-foreground">Mesa Integrada de Hedge</p>`

## Mudança 3 — `index.html`
Substituir o bloco atual de favicon por todos os links de ícone (favicon.ico, 16, 32, apple-touch 57→180), mais 4 metas (`theme-color #0d2117`, `apple-mobile-web-app-capable yes`, `status-bar-style black-translucent`, `app-title Safra Segura`).
Adicionar também `<link rel="manifest" href="/manifest.json">`.

## Mudança 4 — criar `public/manifest.json`
Conteúdo exato do prompt: name, short_name, description, start_url `/`, display `standalone`, background/theme `#0d2117`, orientation `portrait-primary`, e array de 8 ícones (48, 72, 96, 144, 192 any, 192 maskable transparent, 512 any, 512 maskable transparent).

## Notas
- Sem `vite-plugin-pwa` / service worker — apenas manifest + meta tags. Conforme guideline interna do Lovable, isso dá instalabilidade ("Add to Home Screen") sem os riscos de SW dentro do iframe de preview.
- Nenhum outro arquivo é tocado (lógica auth, rotas, hooks, financial, approvals — tudo intacto).

## Fora de escopo
Service worker, offline cache, splash screens iOS customizadas, mudanças de tema/cor da app.

