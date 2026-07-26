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
