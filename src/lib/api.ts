import { supabase } from '@/integrations/supabase/client';

export async function callApi<T = unknown>(
  endpoint: string,
  body?: Record<string, unknown>,
  options?: { method?: string; query?: Record<string, string> }
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { endpoint, body, method: options?.method ?? 'POST', query: options?.query },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao chamar API');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}
