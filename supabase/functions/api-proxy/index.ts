const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ENDPOINTS = [
  '/pricing/table',
  '/orders/build',
  '/orders/validate',
  '/mtm/run',
  '/market/fetch',
]

const API_BASE = 'https://safra-segura-api.onrender.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, body } = await req.json()

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Endpoint não permitido: ${endpoint}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('SAFRA_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key não configurada no servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 2min timeout

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const data = await response.text()

    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    const isAbort = message.includes('abort')
    return new Response(
      JSON.stringify({ error: isAbort ? 'Timeout: API não respondeu a tempo' : message }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
