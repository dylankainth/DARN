import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import ServerMap from './components/ServerMap'
import PaginatedIpList from './components/PaginatedIpList'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const API_VERIFICATIONS = `${API_BASE.replace(/\/+$/, '')}/verifications`
const API_REFRESH = `${API_BASE.replace(/\/+$/, '')}/refresh`

type VerificationRow = {
  ip: string
  ok: boolean
  models: string[]
  latency_ms: number | null
  error: string | null
  checked_at: string
  lat?: number
  lon?: number
}

type VerificationPayload = {
  count: number
  items: VerificationRow[]
}

const formatLatency = (latency: number | null) =>
  typeof latency === 'number' && latency >= 0 ? `${latency} ms` : 'n/a'

const formatTime = (iso: string) => {
  if (!iso) return '—'
  const date = new Date(iso)
  return date.toLocaleString()
}

function App() {
  const [data, setData] = useState<VerificationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalRow, setModalRow] = useState<VerificationRow | null>(null)
  const [mapItems, setMapItems] = useState<Array<VerificationRow & { lat: number; lon: number }>>([])

  const fetchData = async (forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      if (forceRefresh) {
        const refreshResp = await fetch(API_REFRESH, { method: 'POST' })
        if (!refreshResp.ok) {
          const text = await refreshResp.text()
          throw new Error(text || `Refresh failed with status ${refreshResp.status}`)
        }
      }

      const resp = await fetch(API_VERIFICATIONS)
      if (!resp.ok) throw new Error(`Request failed with status ${resp.status}`)
      const json = (await resp.json()) as VerificationPayload
      setData(json)

      // Filter items that have lat/lon from backend
      const items = json.items ?? []
      const itemsWithLocation = items.filter(
        (item) => typeof item.lat === 'number' && typeof item.lon === 'number'
      ) as Array<VerificationRow & { lat: number; lon: number }>

      setMapItems(itemsWithLocation)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const metrics = useMemo(() => {
    const items = data?.items ?? []
    const total = items.length
    const healthy = items.filter((r) => r.ok).length
    const unhealthy = total - healthy
    const successRate = total ? Math.round((healthy / total) * 100) : 0

    const latencies = items
      .filter((r) => typeof r.latency_ms === 'number')
      .map((r) => r.latency_ms as number)
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null

    const fastest = items
      .filter((r) => typeof r.latency_ms === 'number')
      .sort((a, b) => (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity))[0]

    const modelFrequency = new Map<string, number>()
    items.forEach((row) => {
      row.models.forEach((m) => {
        modelFrequency.set(m, (modelFrequency.get(m) ?? 0) + 1)
      })
    })
    const allModels = Array.from(modelFrequency.entries())
      .sort((a, b) => b[1] - a[1])

    const recent = items.slice(0, 6)
    const failing = items.filter((r) => !r.ok)
    const successful = items.filter((r) => r.ok)

    return { total, healthy, unhealthy, successRate, avgLatency, fastest, allModels, recent, failing, successful }
  }, [data])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-300">
              Distributed AI Ranked Network
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-[#3a3d44] bg-[linear-gradient(135deg,#1b1d23,#14161c)] px-4 py-2 text-sm font-semibold text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition duration-200 ease-out hover:-translate-y-[1px] hover:border-[#3a3d44] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => fetchData(true)}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh now'}
            </button>
            {data?.count !== undefined && (
              <span className="rounded-full border border-[#262930] bg-[#15171d] px-3 py-2 text-sm font-semibold text-slate-100">
                {data.count} records
              </span>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-[#332222] bg-[#1b1a1a] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <section className="space-y-4 columns-1 md:columns-2 xl:columns-3">
          <article
            className="mt-6 mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
            style={{ columnSpan: 'all' }}
          >
            <div className="mb-3 text-sm font-semibold tracking-wide">Network rollup</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                <span className="block text-xs text-zinc-300">Total</span>
                <span className="text-2xl font-bold">{metrics.total}</span>
              </div>
              <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                <span className="block text-xs text-zinc-300">Healthy</span>
                <span className="text-2xl font-bold text-emerald-200">{metrics.healthy}</span>
              </div>
              <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                <span className="block text-xs text-zinc-300">Unhealthy</span>
                <span className="text-2xl font-bold text-amber-200">{metrics.unhealthy}</span>
              </div>
              <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                <span className="block text-xs text-zinc-300">Success rate</span>
                <span className="text-2xl font-bold">{metrics.successRate}%</span>
              </div>
            </div>
          </article>

          <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <div className="mb-3 text-sm font-semibold tracking-wide">Latency</div>
            <p className="text-sm text-zinc-300">Average across responsive nodes.</p>
            <div className="my-2 rounded-lg border border-[#20232a] bg-[#121317] p-3">
              <span className="block text-xs text-zinc-300">Average</span>
              <span className="text-2xl font-bold">{formatLatency(metrics.avgLatency)}</span>
            </div>
            {metrics.fastest && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <span>Fastest</span>
                  <Link to={`/ip/${metrics.fastest.ip}`} className="text-sm text-zinc-300 hover:text-zinc-100 transition">
                    {metrics.fastest.ip}
                  </Link>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <span>Latency</span>
                  <span>{formatLatency(metrics.fastest.latency_ms)}</span>
                </div>
              </div>
            )}
          </article>

          <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Models in the wild</div>
              <div className="text-xs text-zinc-400">{metrics.allModels.length} models</div>
            </div>
            {metrics.allModels.length > 0 ? (
              <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {metrics.allModels.map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2"
                  >
                    <span className="text-sm truncate mr-2">{name}</span>
                    <span className="text-xs font-semibold text-zinc-400 flex-shrink-0">×{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">No models reported yet.</p>
            )}
          </article>

          <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)] min-h-[260px]">
            <div className="mb-3 text-sm font-semibold tracking-wide">Recent checks</div>
            <div className="flex flex-col gap-2">
              {metrics.recent.map((row) => (
                <div
                  key={row.ip + row.checked_at}
                  className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2"
                >
                  <div>
                    <Link to={`/ip/${row.ip}`} className="font-mono text-sm hover:text-zinc-300 transition">
                      {row.ip}
                    </Link>
                    <div className="text-sm text-zinc-300">{formatTime(row.checked_at)}</div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${row.ok ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : 'border-rose-400/70 bg-rose-500/15 text-rose-100'}`}
                    >
                      {row.ok ? 'OK' : 'FAIL'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-[#272a31] bg-[#1a1c22] px-2 py-1 text-xs font-semibold">
                      {formatLatency(row.latency_ms)}
                    </span>
                  </div>
                </div>
              ))}
              {metrics.recent.length === 0 && <div className="text-sm text-zinc-300">No data yet.</div>}
            </div>
          </article>

          <PaginatedIpList
            title="Failures"
            items={metrics.failing}
            itemsPerPage={5}
            showDetailsButton={true}
            onViewDetails={setModalRow}
          />

          <PaginatedIpList
            title="Successes"
            items={metrics.successful}
            itemsPerPage={5}
          />

          <article
            className="mt-4 mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
            style={{ columnSpan: 'all' }}
          >
            <div className="mb-3 text-sm font-semibold tracking-wide">Geographic view</div>
            {mapItems.length === 0 ? (
              <p className="text-sm text-zinc-300">
                No coordinates available for mapping (geo lookup may have failed or been rate limited).
              </p>
            ) : (
              <div className="h-[360px] w-full overflow-hidden rounded-lg border border-[#1f2128] bg-[#0f1014]">
                <ServerMap
                  items={mapItems.map((i) => ({
                    ip: i.ip,
                    ok: i.ok,
                    error: i.error || undefined,
                    lat: i.lat!,
                    lon: i.lon!,
                  }))}
                />
              </div>
            )}
          </article>

          <article
            className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
            style={{ columnSpan: 'all' }}
          >
            <div className="mb-3 text-sm font-semibold tracking-wide">Inventory snapshot</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data?.items?.slice(0, 8).map((row) => (
                <Link
                  key={row.ip}
                  to={`/ip/${row.ip}`}
                  className="rounded-lg border border-[#20232a] bg-[#121317] p-3 transition hover:border-[#2a2d35] hover:bg-[#16181d]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${row.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="font-mono text-sm">{row.ip}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-200">
                    <span className="truncate text-zinc-200">{row.models.join(', ') || 'no models'}</span>
                    <span className="text-xs text-zinc-300">{formatLatency(row.latency_ms)}</span>
                  </div>
                </Link>
              ))}
              {!data?.items?.length && <p className="text-sm text-zinc-300">No endpoints discovered yet.</p>}
            </div>
          </article >
        </section >
      </main >

      {
        modalRow && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setModalRow(null)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-[#22242b] bg-[#0f1014] p-6 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Endpoint</div>
                  <div className="font-mono text-lg">{modalRow.ip}</div>
                </div>
                <button
                  className="rounded-full border border-[#3a3d44] bg-[#16171d] px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:border-zinc-400"
                  onClick={() => setModalRow(null)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <span className="text-zinc-300">Status</span>
                  <span className={`font-semibold ${modalRow.ok ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {modalRow.ok ? 'OK' : 'FAIL'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <span className="text-zinc-300">Latency</span>
                  <span className="font-semibold">{formatLatency(modalRow.latency_ms)}</span>
                </div>
                <div className="rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <div className="text-zinc-300">Error</div>
                  <div className="text-sm text-zinc-100">{modalRow.error || 'Unknown error'}</div>
                </div>
                <div className="rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <div className="text-zinc-300">Checked at</div>
                  <div className="text-sm text-zinc-100">{formatTime(modalRow.checked_at)}</div>
                </div>
                <div className="rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <div className="text-zinc-300">Models</div>
                  <div className="text-sm text-zinc-100">{modalRow.models.join(', ') || 'No models reported'}</div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

export default App
