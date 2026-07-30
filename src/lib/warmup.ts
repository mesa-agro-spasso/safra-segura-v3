// Warm-up do backend (Render free tier dorme após inatividade).
// Dispara UMA chamada por sessão de página, logo após o login, para que o
// servidor já esteja acordado quando a mesa gerar a primeira tabela.
//
// Silencioso por decisão: sem spinner, sem toast, sem erro visível.
// A resposta é descartada — só interessa o efeito colateral de acordar a API.
//
// NOTA: o ideal seria GET /health, mais leve. Ele ainda não está na allowlist
// do api-proxy (ALLOWED_GET_ENDPOINTS). Quando o endpoint for liberado no
// Supabase, trocar '/market/quotes' por '/health' aqui.
import { callApi } from '@/lib/api';

let warmed = false;

export function warmUpApi(): void {
  if (warmed) return;
  warmed = true;
  void callApi('/market/quotes', undefined, {
    method: 'GET',
    query: { quantity: '1' },
  }).catch(() => {
    // engolido de propósito: se não acordar, o comportamento é o de hoje
  });
}
