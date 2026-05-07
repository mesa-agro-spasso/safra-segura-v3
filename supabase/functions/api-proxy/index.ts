const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_POST_ENDPOINTS = [
  '/pricing/table',
  '/orders/build',
  '/orders/validate',
  '/mtm/run',
]

const ALLOWED_GET_ENDPOINTS = [
  '/market/quotes',
  '/market/b3-corn-quotes',
]

const API_BASE = 'https://safra-segura-api.onrender.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, body, method: reqMethod, query } = await req.json()
    const method = (reqMethod || 'POST').toUpperCase()

    const isAllowed =
      (method === 'POST' && ALLOWED_POST_ENDPOINTS.includes(endpoint)) ||
      (method === 'GET' && ALLOWED_GET_ENDPOINTS.some(e => endpoint.startsWith(e)))

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: `Endpoint não permitido: ${method} ${endpoint}` }),
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
    const timeout = setTimeout(() => controller.abort(), 120000)

    let url = `${API_BASE}${endpoint}`
    if (method === 'GET' && query) {
      const params = new URLSearchParams(query)
      url += `?${params.toString()}`
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    }

    if (method === 'POST' && body) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

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
