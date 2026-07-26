## Objetivo
Adicionar Sentry (captura de erros) no frontend, com escopo mínimo.

## Arquivos alterados (3)

### 1. `package.json` — nova dependência
Instalar `@sentry/react` (v8+). Nenhum outro pacote.

### 2. `src/main.tsx` — inicialização antes do render
```tsx
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: "https://817e6a3dcf8e1ffa01516dc4f6ff0e78@o4511801876348928.ingest.us.sentry.io/4511802078265344",
  environment: "production",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
});

createRoot(document.getElementById("root")!).render(<App />);
```
Sem `integrations`, sem browserTracing, sem replay.

### 3. `src/pages/DebugSentry.tsx` — novo arquivo (temporário)
```tsx
// TEMPORARY: Sentry validation route. Remove in the next commit.
const DebugSentry = () => {
  throw new Error("Sentry integration test");
};

export default DebugSentry;
```

### 4. `src/App.tsx` — registrar a rota
Adicionar o import e uma linha de rota antes da rota catch-all `/*`, seguindo o padrão das rotas públicas existentes:

```tsx
import DebugSentry from "./pages/DebugSentry"; // TEMPORARY

...
<Route path="/acesso-desativado" element={<AccountDisabled />} />
{/* TEMPORARY: Sentry validation route — remove in the next commit */}
<Route path="/debug-sentry" element={<DebugSentry />} />
<Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
```
Fica fora do `ProtectedRoute` para poder ser testada sem login, e não é referenciada em nenhum menu.

## Fora do escopo (não será tocado)
Edge Functions, SQL/migrations, Supabase, componentes/telas/rotas existentes, lógica de negócio, outros pacotes.

## Nota técnica
O erro lançado no render propaga como exceção não tratada do React e é capturado pelo handler global do Sentry (não é necessário `ErrorBoundary` para a validação).
