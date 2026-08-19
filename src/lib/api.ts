import { supabase } from '@/integrations/supabase/client';

/** Erro de API com o status HTTP original e a mensagem (em português) vinda do backend. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    const candidate = o.detail ?? o.error ?? o.message;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as Record<string, unknown> | string;
      if (typeof first === 'string') return first;
      if (first && typeof first.msg === 'string') return first.msg;
    }
  }
  return fallback;
}

export async function callApi<T = unknown>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: { method?: string; query?: Record<string, string> }
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { endpoint, body, method: options?.method ?? 'POST', query: options?.query },
  });

  if (error) {
    // A Edge Function repassa o status da API; recupera corpo e status quando disponíveis.
    const res = (error as { context?: Response }).context;
    if (res && typeof res.status === 'number') {
      let payload: unknown = null;
      try {
        payload = await res.clone().json();
      } catch {
        try { payload = await res.clone().text(); } catch { payload = null; }
      }
      throw new ApiError(extractMessage(payload, error.message || 'Erro ao chamar API'), res.status);
    }
    throw new ApiError(error.message || 'Erro ao chamar API', 0);
  }

  if (data && typeof data === 'object' && '__api_proxy_error' in (data as Record<string, unknown>)) {
    const envelope = data as Record<string, unknown>;
    const status = typeof envelope.status === 'number' ? envelope.status : 0;
    throw new ApiError(
      extractMessage(envelope.payload, 'Erro ao chamar API'),
      status,
    );
  }

  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    const d = data as Record<string, unknown>;
    if (d.error) throw new ApiError(extractMessage(d, 'Erro ao chamar API'), 0);
  }

  return data as T;
}
