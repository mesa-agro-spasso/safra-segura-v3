import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const WORKER_URL = 'https://spasso-public-table-api.mesaagro.workers.dev/publish';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const publishKey = Deno.env.get('PUBLISH_KEY');
    if (!publishKey) {
      return new Response(
        JSON.stringify({ error: 'PUBLISH_KEY não configurado no servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    if (!body || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
      return new Response(
        JSON.stringify({ error: 'Payload inválido: columns e rows são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const upstream = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Publish-Key': publishKey,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: (payload as { error?: string; message?: string })?.error ?? (payload as { message?: string })?.message ?? `Falha ao publicar (HTTP ${upstream.status})` }),
        { status: upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, upstream: payload }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
