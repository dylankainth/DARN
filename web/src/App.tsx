import { useEffect, useMemo, useState } from 'react'
import Navbar from './Navbar'
import ServerMap from './components/ServerMap'
import LatencyChart from './components/LatencyChart'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const API_VERIFICATIONS = `${API_BASE.replace(/\/+$/, '')}/verifications`
const API_RUN_PROBES = `${API_BASE.replace(/\/+$/, '')}/run-probes`

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

const originalFetch = window.fetch.bind(window);

const PROXIES: Record<string, string> = {
  "https://ipwho.is/": "http://localhost:8000/ipwho/",
  "https://ipapi.co/": "http://localhost:8000/ipapi/",
};

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();

  for (const [target, proxy] of Object.entries(PROXIES)) {
    if (url.startsWith(target)) {
      const proxiedUrl = url.replace(target, proxy);
      return originalFetch(proxiedUrl, init);
    }
  }

  return originalFetch(input, init);
};

function App() {
  const [data, setData] = useState<VerificationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [probing, setProbing] = useState(false)
  const [autoProbe, setAutoProbe] = useState(true)
  const [modalRow, setModalRow] = useState<VerificationRow | null>(null)
  const [mapItems, setMapItems] = useState<Array<VerificationRow & { lat: number; lon: number }>>([])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const resp = await fetch(API_VERIFICATIONS)
      if (!resp.ok) throw new Error(`Request failed with status ${resp.status}`)
      const json = (await resp.json()) as VerificationPayload
      setData(json)

      const items = json.items ?? []
      const geocodeIp = async (ip: string) => {
        const tryProviders = [
          async () => {
            const r = await fetch(`https://ipapi.co/${ip}/json/`)
            if (!r.ok) return null
            const g = await r.json()
            const lat = typeof g.lat === 'number' ? g.lat : Number(g.latitude)
            const lon = typeof g.lon === 'number' ? g.lon : Number(g.longitude)
            return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
          },
          async () => {
            const r = await fetch(`https://ipwho.is/${ip}`)
            if (!r.ok) return null
            const g = await r.json()
            const lat = Number(g.latitude)
            const lon = Number(g.longitude)
            return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
          },
        ]
        for (const fn of tryProviders) {
          try {
            const res = await fn()
            if (res) return res
          } catch (_) {
            // ignore and try next
          }
        }
        return null
      }

      const enriched = await Promise.all(
        items.map(async (item) => {
          if (typeof item.lat === 'number' && typeof item.lon === 'number') {
            return item as VerificationRow & { lat: number; lon: number }
          }
          const geo = await geocodeIp(item.ip)
          if (geo) return { ...(item as VerificationRow), ...geo }
          return null
        })
      )

      setMapItems(enriched.filter(Boolean) as Array<VerificationRow & { lat: number; lon: number }>)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const runProbes = async () => {
    setProbing(true)
    try {
      const resp = await fetch(API_RUN_PROBES, { method: 'POST' })
      if (!resp.ok) throw new Error(`Probe request failed with status ${resp.status}`)
      const result = await resp.json()
      console.log('Probe result:', result)
      // Optionally refresh data after probing
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Probe failed: ${message}`)
    } finally {
      setProbing(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    if (!autoProbe) return
    
    // Auto-run probes every 30 seconds
    const probeInterval = setInterval(() => {
      runProbes()
    }, 30000)
    
    return () => clearInterval(probeInterval)
  }, [autoProbe])

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
    const topModels = Array.from(modelFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => `${name} ×${count}`)

    const recent = items.slice(0, 6)
    const failing = items.filter((r) => !r.ok).slice(0, 4)

    return { total, healthy, unhealthy, successRate, avgLatency, fastest, topModels, recent, failing }
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
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                autoProbe
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                  : 'border-zinc-600 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setAutoProbe(!autoProbe)}
            >
              Auto-probe: {autoProbe ? 'ON' : 'OFF'} (30s)
            </button>
            <button
              className="rounded-xl border border-[#3a3d44] bg-[linear-gradient(135deg,#1b1d23,#14161c)] px-4 py-2 text-sm font-semibold text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition duration-200 ease-out hover:-translate-y-[1px] hover:border-[#3a3d44] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={runProbes}
              disabled={probing}
            >
              {probing ? 'Probing…' : 'Run Probes'}
            </button>
            <button
              className="rounded-xl border border-[#3a3d44] bg-[linear-gradient(135deg,#1b1d23,#14161c)] px-4 py-2 text-sm font-semibold text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition duration-200 ease-out hover:-translate-y-[1px] hover:border-[#3a3d44] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={fetchData}
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
                  <span className="text-sm text-zinc-300">{metrics.fastest.ip}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2">
                  <span>Latency</span>
                  <span>{formatLatency(metrics.fastest.latency_ms)}</span>
                </div>
              </div>
            )}
          </article>

          <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <div className="mb-3 text-sm font-semibold tracking-wide">Models in the wild</div>
            <ul className="mb-2 flex flex-wrap gap-2">
              {metrics.topModels.length > 0 ? (
                metrics.topModels.map((m) => (
                  <li
                    key={m}
                    className="rounded-full border border-[#262930] bg-[#15171d] px-3 py-1 text-sm font-semibold"
                  >
                    {m}
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-300">No models reported yet.</li>
              )}
            </ul>
            <p className="text-sm text-zinc-300">Top variants by frequency across verified hosts.</p>
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
                    <div className="font-mono text-sm">{row.ip}</div>
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

          <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)] min-h-[260px]">
            <div className="mb-3 text-sm font-semibold tracking-wide">Failures</div>
            {metrics.failing.length === 0 && <p className="text-sm text-zinc-300">No failing endpoints.</p>}
            {metrics.failing.map((row) => (
              <div
                key={row.ip + row.checked_at}
                className="mb-2 flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2 last:mb-0"
              >
                <div className="font-mono text-sm">{row.ip}</div>
                <button
                  className="rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:border-rose-300 hover:bg-rose-500/20"
                  onClick={() => setModalRow(row)}
                >
                  View details
                </button>
              </div>
            ))}
          </article>

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
                <div key={row.ip} className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${row.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="font-mono text-sm">{row.ip}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-200">
                    <span className="truncate text-zinc-200">{row.models.join(', ') || 'no models'}</span>
                    <span className="text-xs text-zinc-300">{formatLatency(row.latency_ms)}</span>
                  </div>
                </div>
              ))}
              {!data?.items?.length && <p className="text-sm text-zinc-300">No endpoints discovered yet.</p>}
            </div>
          </article>

          <article
            className="mt-4 mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
            style={{ columnSpan: 'all' }}
          >
            <div className="mb-3 text-sm font-semibold tracking-wide">Latency trends</div>
            <div className="h-[400px]">
              <LatencyChart />
            </div>
          </article>
        </section>
      </main>

      {modalRow && (
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
      )}
    </div>
  )
}

export default App