// Дымовой тест REST API Supabase (PostgREST) и политик RLS.
// Запуск: node --env-file=.env.local scripts/api-smoke.mjs
// Переменные: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — обязательны;
// ACCESS_TOKEN — JWT вошедшего пользователя (без него проверки со входом SKIP);
// FOREIGN_BOOKING_ID — id брони другого пользователя.
// Ключи и токены скрипт не печатает ни при каких условиях.

const BASE_URL = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? ''
const FOREIGN_BOOKING_ID = process.env.FOREIGN_BOOKING_ID ?? ''

const ALLOWED_ORIGIN = 'http://127.0.0.1:5173'
const FOREIGN_ORIGIN = 'http://evil.example'
const SMOKE_ROOM_ID = 'volga'
const SMOKE_TITLE = `[smoke] ${new Date().toISOString()}`
const EXPECTED_ROOM_IDS = ['baikal', 'elbrus', 'volga']
const AUTH_CHECK_NAMES = [
  '6. POST rooms',
  '7. POST bookings volga 10:00–11:00 UTC',
  '8. POST bookings тот же интервал',
  '9. POST bookings встык 11:00–12:00 UTC',
  '10. POST bookings ends_at = starts_at',
  '11. POST bookings с чужим user_id',
  '12. PATCH title своей брони',
  '13. PATCH user_id своей брони',
  '14. GET bookings с profiles(display_name)',
  '15. DELETE своих тестовых броней',
]

const totals = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 }
// Все брони, которые вернул сервер на наши POST, включая неожиданно
// успешные: finally должен убрать и их, иначе тест оставит мусор.
const createdIds = new Set()

async function request(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      // Без входа шлём только apikey: publishable-ключ не JWT,
      // и в Authorization его передавать нельзя.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: res.status, data, requestId: res.headers.get('sb-request-id') ?? '—' }
}

function errorCode(res) {
  return res.data && typeof res.data === 'object' && !Array.isArray(res.data) && 'code' in res.data
    ? String(res.data.code)
    : null
}

function errorMessage(res) {
  return res.data && typeof res.data === 'object' && !Array.isArray(res.data) && 'message' in res.data
    ? String(res.data.message)
    : null
}

function rows(res) {
  return Array.isArray(res.data) ? res.data : []
}

function print(result, name, lines) {
  totals[result] += 1
  console.log(`[${result}] ${name}`)
  for (const line of lines) console.log(`       ${line}`)
}

// Ожидаем ошибку: решает код PostgreSQL/PostgREST, а несовпадение
// HTTP-статуса с таблицей из документации PostgREST — только WARN.
function expectError(name, res, expectedCode, expectedStatus) {
  const code = errorCode(res)
  let result = 'PASS'
  if (code !== expectedCode) result = 'FAIL'
  else if (res.status !== expectedStatus) result = 'WARN'
  const lines = [
    `ожидалось: ${expectedCode} / HTTP ${expectedStatus}`,
    `получено:  ${code ?? '—'} / HTTP ${res.status}`,
  ]
  const message = errorMessage(res)
  if (message) lines.push(`сообщение: ${message}`)
  lines.push(`sb-request-id: ${res.requestId}`)
  print(result, name, lines)
}

// Ожидаем успех: решают отсутствие ошибки и проверка данных (check),
// другой 2xx-статус — WARN.
function expectSuccess(name, res, expectedStatus, check) {
  const code = errorCode(res)
  const verdict = check ? check(res) : { ok: true, note: '' }
  let result = 'PASS'
  if (code !== null || res.status < 200 || res.status >= 300 || !verdict.ok) result = 'FAIL'
  else if (res.status !== expectedStatus) result = 'WARN'
  const lines = [
    `ожидалось: — / HTTP ${expectedStatus}`,
    `получено:  ${code ?? '—'} / HTTP ${res.status}`,
  ]
  const message = errorMessage(res)
  if (message) lines.push(`сообщение: ${message}`)
  if (verdict.note) lines.push(verdict.note)
  lines.push(`sb-request-id: ${res.requestId}`)
  print(result, name, lines)
}

function skip(name, reason) {
  print('SKIP', name, [reason])
}

function trackCreated(res) {
  for (const row of rows(res)) {
    if (row && typeof row.id === 'string') createdIds.add(row.id)
  }
}

function readJwtClaims(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function insertBooking(token, startsAt, endsAt, extra = {}) {
  return request('POST', 'bookings', {
    token,
    body: { room_id: SMOKE_ROOM_ID, title: SMOKE_TITLE, starts_at: startsAt, ends_at: endsAt, ...extra },
    headers: { Prefer: 'return=representation' },
  })
}

async function runAnonChecks() {
  console.log('\n— Без входа (anon) —')

  const roomsRes = await request('GET', 'rooms?select=id&order=id')
  expectSuccess('1. GET rooms', roomsRes, 200, (res) => {
    const ids = rows(res).map((room) => room.id).join(',')
    return { ok: ids === EXPECTED_ROOM_IDS.join(','), note: `комнаты: ${ids || '—'}` }
  })

  const bookingsRes = await request('GET', 'bookings?select=id&limit=5')
  expectSuccess('2. GET bookings', bookingsRes, 200, (res) => ({
    ok: Array.isArray(res.data),
    note: `строк (limit 5): ${rows(res).length}`,
  }))

  // 42501 без входа PostgREST отдаёт как 401, со входом — как 403
  expectError('3. GET profiles без входа', await request('GET', 'profiles?select=id&limit=1'), '42501', 401)

  const anonInsert = await request('POST', 'bookings', {
    body: { room_id: SMOKE_ROOM_ID, title: SMOKE_TITLE, starts_at: '2031-01-01T08:00:00Z', ends_at: '2031-01-01T09:00:00Z' },
    headers: { Prefer: 'return=representation' },
  })
  trackCreated(anonInsert)
  expectError('4. POST bookings без входа', anonInsert, '42501', 401)

  // CORS проверяем как браузер: preflight без apikey. Ничего не утверждаем,
  // только показываем, что ответил шлюз, поэтому результат не входит в итог.
  for (const origin of [ALLOWED_ORIGIN, FOREIGN_ORIGIN]) {
    const res = await fetch(`${BASE_URL}/rest/v1/bookings`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'apikey,authorization,content-type,prefer',
      },
    })
    console.log(`[INFO] 5. CORS preflight, Origin ${origin}`)
    console.log(`       HTTP ${res.status}`)
    let found = false
    for (const [header, value] of res.headers) {
      if (header.startsWith('access-control-allow-')) {
        console.log(`       ${header}: ${value}`)
        found = true
      }
    }
    if (!found) console.log('       заголовков access-control-allow-* нет')
    console.log(`       sb-request-id: ${res.headers.get('sb-request-id') ?? '—'}`)
  }
}

async function runAuthChecks(token) {
  console.log('\n— Со входом (ACCESS_TOKEN) —')

  const roomInsert = await request('POST', 'rooms', {
    token,
    body: { id: 'smoke-room', name: '[smoke] комната', floor: 1, capacity: 1 },
  })
  expectError('6. POST rooms', roomInsert, '42501', 403)

  const first = await insertBooking(token, '2031-01-01T10:00:00Z', '2031-01-01T11:00:00Z')
  trackCreated(first)
  const firstId = rows(first)[0]?.id ?? null
  expectSuccess('7. POST bookings volga 10:00–11:00 UTC', first, 201, () => ({
    ok: typeof firstId === 'string',
    note: `id: ${firstId ?? '—'}`,
  }))

  const overlap = await insertBooking(token, '2031-01-01T10:00:00Z', '2031-01-01T11:00:00Z')
  trackCreated(overlap)
  expectError('8. POST bookings тот же интервал', overlap, '23P01', 409)

  const adjacent = await insertBooking(token, '2031-01-01T11:00:00Z', '2031-01-01T12:00:00Z')
  trackCreated(adjacent)
  expectSuccess('9. POST bookings встык 11:00–12:00 UTC', adjacent, 201, (res) => ({
    ok: rows(res).length === 1,
    note: `id: ${rows(res)[0]?.id ?? '—'}`,
  }))

  const emptyInterval = await insertBooking(token, '2031-01-01T13:00:00Z', '2031-01-01T13:00:00Z')
  trackCreated(emptyInterval)
  expectError('10. POST bookings ends_at = starts_at', emptyInterval, '23514', 400)

  const foreignOwner = await insertBooking(token, '2031-01-01T14:00:00Z', '2031-01-01T15:00:00Z', {
    user_id: crypto.randomUUID(),
  })
  trackCreated(foreignOwner)
  expectError('11. POST bookings с чужим user_id', foreignOwner, '42501', 403)

  if (firstId) {
    const newTitle = `${SMOKE_TITLE} (изменено)`
    const patched = await request('PATCH', `bookings?id=eq.${firstId}`, {
      token,
      body: { title: newTitle },
      headers: { Prefer: 'return=representation' },
    })
    expectSuccess('12. PATCH title своей брони', patched, 200, (res) => ({
      ok: rows(res).length === 1 && rows(res)[0].title === newTitle,
      note: `строк изменено: ${rows(res).length}, title применён: ${rows(res)[0]?.title === newTitle ? 'да' : 'нет'}`,
    }))

    const ownerChange = await request('PATCH', `bookings?id=eq.${firstId}`, {
      token,
      body: { user_id: crypto.randomUUID() },
      headers: { Prefer: 'return=representation' },
    })
    expectError('13. PATCH user_id своей брони', ownerChange, '42501', 403)
  } else {
    skip('12. PATCH title своей брони', 'нет id брони из проверки 7')
    skip('13. PATCH user_id своей брони', 'нет id брони из проверки 7')
  }

  const ids = [...createdIds]
  if (ids.length > 0) {
    const embedded = await request('GET', `bookings?select=id,title,profiles(display_name)&id=in.(${ids.join(',')})`, { token })
    expectSuccess('14. GET bookings с profiles(display_name)', embedded, 200, (res) => {
      const list = rows(res)
      const withName = list.filter((row) => typeof row.profiles?.display_name === 'string')
      return { ok: list.length > 0 && withName.length === list.length, note: `строк: ${list.length}, с display_name: ${withName.length}` }
    })

    const deleted = await request('DELETE', `bookings?id=in.(${ids.join(',')})`, {
      token,
      headers: { Prefer: 'return=representation' },
    })
    for (const row of rows(deleted)) createdIds.delete(row.id)
    expectSuccess('15. DELETE своих тестовых броней', deleted, 200, (res) => ({
      ok: rows(res).length === ids.length,
      note: `удалено строк: ${rows(res).length} из ${ids.length}`,
    }))
  } else {
    skip('14. GET bookings с profiles(display_name)', 'скрипт не создал ни одной брони')
    skip('15. DELETE своих тестовых броней', 'скрипт не создал ни одной брони')
  }
}

async function runForeignChecks(token, ownUserId) {
  console.log('\n— Чужая бронь (FOREIGN_BOOKING_ID) —')
  const names = ['16. PATCH чужой брони', '17. DELETE чужой брони', '18. GET чужой брони после попыток']
  const path = `bookings?id=eq.${encodeURIComponent(FOREIGN_BOOKING_ID)}`

  const before = await request('GET', `${path}&select=id,title,user_id`, { token })
  const target = rows(before)[0]
  // Защита от ошибки в переменной: если бронь своя, PATCH и DELETE
  // её действительно изменят и удалят.
  if (!target) {
    for (const name of names) skip(name, `бронь не найдена (HTTP ${before.status}, sb-request-id: ${before.requestId})`)
    return
  }
  if (ownUserId && target.user_id === ownUserId) {
    for (const name of names) skip(name, 'бронь принадлежит пользователю из ACCESS_TOKEN, это не чужая бронь')
    return
  }

  // Пишем тот же title: даже если RLS пропустит запрос, данные не изменятся
  const patched = await request('PATCH', path, {
    token,
    body: { title: target.title },
    headers: { Prefer: 'return=representation' },
  })
  expectSuccess(names[0], patched, 200, (res) => ({
    ok: Array.isArray(res.data) && res.data.length === 0,
    note: `строк изменено: ${rows(res).length} (ожидалось 0)`,
  }))

  const deleted = await request('DELETE', path, { token, headers: { Prefer: 'return=representation' } })
  expectSuccess(names[1], deleted, 200, (res) => ({
    ok: Array.isArray(res.data) && res.data.length === 0,
    note: `строк удалено: ${rows(res).length} (ожидалось 0)`,
  }))

  const after = await request('GET', `${path}&select=id`, { token })
  expectSuccess(names[2], after, 200, (res) => ({
    ok: rows(res).length === 1,
    note: `бронь на месте: ${rows(res).length === 1 ? 'да' : 'нет'}`,
  }))
}

async function cleanup(token) {
  const ids = [...createdIds]
  if (ids.length === 0) return
  console.log('\n— Очистка —')
  if (!token) {
    console.log(`       не удалено без токена: ${ids.join(', ')}`)
    return
  }
  try {
    const res = await request('DELETE', `bookings?id=in.(${ids.join(',')})`, {
      token,
      headers: { Prefer: 'return=representation' },
    })
    for (const row of rows(res)) createdIds.delete(row.id)
    console.log(`       удалено строк: ${rows(res).length} из ${ids.length}, sb-request-id: ${res.requestId}`)
    if (createdIds.size > 0) console.log(`       остались: ${[...createdIds].join(', ')}`)
  } catch (error) {
    console.log(`       очистка не удалась: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  if (!BASE_URL || !ANON_KEY) {
    console.error('Не заданы VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY. Запуск: node --env-file=.env.local scripts/api-smoke.mjs')
    process.exitCode = 1
    return
  }
  console.log(`Supabase: ${BASE_URL}`)

  const claims = ACCESS_TOKEN ? readJwtClaims(ACCESS_TOKEN) : null
  const ownUserId = typeof claims?.sub === 'string' ? claims.sub : null
  if (ACCESS_TOKEN && typeof claims?.exp === 'number' && claims.exp * 1000 < Date.now()) {
    console.log('Внимание: срок действия ACCESS_TOKEN истёк, проверки со входом, скорее всего, упадут')
  }

  try {
    await runAnonChecks()

    if (ACCESS_TOKEN) {
      await runAuthChecks(ACCESS_TOKEN)
    } else {
      console.log('\n— Со входом (ACCESS_TOKEN) —')
      for (const name of AUTH_CHECK_NAMES) skip(name, 'ACCESS_TOKEN не задан')
    }

    if (FOREIGN_BOOKING_ID && ACCESS_TOKEN) {
      await runForeignChecks(ACCESS_TOKEN, ownUserId)
    } else if (FOREIGN_BOOKING_ID) {
      console.log('\n— Чужая бронь (FOREIGN_BOOKING_ID) —')
      skip('16–18. чужая бронь', 'ACCESS_TOKEN не задан')
    }
  } catch (error) {
    print('FAIL', 'непредвиденная ошибка', [error instanceof Error ? error.message : String(error)])
  } finally {
    await cleanup(ACCESS_TOKEN)
  }

  console.log(`\nPASS ${totals.PASS} / FAIL ${totals.FAIL} / WARN ${totals.WARN} / SKIP ${totals.SKIP}`)
  if (totals.FAIL > 0) process.exitCode = 1
}

await main()
