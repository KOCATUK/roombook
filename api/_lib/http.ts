// Ответы функций не кэшируются: health check должен отражать текущее состояние
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...NO_STORE_HEADERS, ...headers } })
}
