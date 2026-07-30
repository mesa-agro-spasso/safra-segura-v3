// Warm-up do backend (Render free tier dorme após inatividade).
// Dispara UMA chamada por sessão de página, logo após o login, para que o
// servidor já esteja acordado quando a mesa gerar a primeira tabela.
//
// Silencioso por decisão: sem spinner, sem toast, sem erro visível.
// A resposta é descartada — só interessa o efeito colateral de acordar a API.
import { callApi } from '@/lib/api';

let warmed = false;

export function warmUpApi(): void {
  if (warmed) return;
  warmed = true;
  void callApi('/health', undefined, { method: 'GET' }).catch(() => {
    // engolido de propósito: se não acordar, o comportamento é o de hoje
  });
}
