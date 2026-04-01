import { supabase } from '@/integrations/supabase/client';

export async function callApi<T = unknown>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('api-proxy', {
    body: { endpoint, body },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao chamar API');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}
