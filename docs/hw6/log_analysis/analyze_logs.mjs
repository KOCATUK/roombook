// Анализ экспорта логов Supabase (Dashboard -> Logs -> Export, JSON).
// Запуск: node analyze_logs.mjs supabase_logs_sanitized.json
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Укажите путь к JSON-файлу экспорта логов')
  process.exit(1)
}

const rows = JSON.parse(readFileSync(file, 'utf8'))
const edge = rows.filter((r) => r.log_type === 'edge')
const pg = rows.filter((r) => r.log_type === 'postgres')

const count = (items, keyFn) => {
  const m = new Map()
  for (const it of items) m.set(keyFn(it), (m.get(keyFn(it)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const print = (title, entries) => {
  console.log(`\n== ${title}`)
  for (const [k, v] of entries) console.log(`${String(v).padStart(4)}  ${k}`)
}
const dates = rows.map((r) => r.date).sort()
const isMobile = (r) => /Android|Mobile/.test(r.event_message)
const urlOf = (r) => (r.event_message.match(/\| (https?:\/\/\S+) \|/) ?? [])[1] ?? ''

console.log(`Записей: ${rows.length} (edge: ${edge.length}, postgres: ${pg.length})`)
console.log(`Период (UTC): ${dates[0]} .. ${dates.at(-1)}`)

print('log_type / level / status', count(rows, (r) => `${r.log_type} ${r.level} ${r.status}`))
print('edge: метод / путь / статус', count(edge, (r) => `${r.method} ${r.pathname} ${r.status}`))
print('edge: устройство по User-Agent', count(edge, (r) => (isMobile(r) ? 'Android (эмуляция)' : 'Windows')))

const gets = edge.filter((r) => r.method === 'GET' && r.pathname.startsWith('/rest/v1'))
print(
  'GET REST: форма запроса',
  count(gets, (r) => {
    const u = new URL(urlOf(r))
    return `${u.pathname}?${decodeURIComponent(u.search.slice(1))}`
  }),
)

const perMinute = count(edge, (r) => r.date.slice(0, 16))
console.log(`\nМаксимум запросов в минуту: ${Math.max(...perMinute.map(([, v]) => v))}`)

console.log('\n== Хронология входов, выходов и изменений (UTC)')
for (const r of [...edge].sort((a, b) => a.date.localeCompare(b.date))) {
  const key = ['/auth/v1/authorize', '/auth/v1/callback', '/auth/v1/logout'].includes(r.pathname)
  const mutation = r.method === 'POST' || r.method === 'DELETE'
  const token = r.pathname === '/auth/v1/token' && r.method === 'POST'
  if (key || mutation || token) {
    console.log(
      `${r.date}  ${r.method.padEnd(6)} ${r.pathname.padEnd(20)} ${r.status}  ` +
        `${isMobile(r) ? 'mobile ' : 'desktop'} ${r.auth_user ? 'с пользователем' : ''}`,
    )
  }
}

console.log('\n== Предупреждения и ошибки edge (статус >= 400)')
for (const r of edge.filter((x) => Number(x.status) >= 400)) {
  console.log(`${r.date}  ${r.method} ${r.pathname} ${r.status}`)
}
console.log(`5xx: ${edge.filter((x) => Number(x.status) >= 500).length}`)

console.log('\n== postgres')
for (const r of pg) console.log(`${r.date}  ${r.level}  ${r.event_message.slice(0, 60)}`)
console.log(`Ошибок уровня error/fatal/panic: ${pg.filter((r) => ['error', 'fatal', 'panic'].includes(r.level)).length}`)
