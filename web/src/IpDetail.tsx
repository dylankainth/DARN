import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from './Navbar'
import ServerMap from './components/ServerMap'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

type VerificationData = {
    ip: string
    ok: boolean
    models: string[]
    latency_ms: number | null
    error: string | null
    checked_at: string
}

type ProbeData = {
    ip: string
    model: string
    success: boolean
    latency_ms: number | null
    status_code: number | null
    error: string | null
    body: string | null
    ts: number
}

type LocationData = {
    lat: number
    lon: number
    city?: string
    region?: string
    country?: string
}

function IpDetail() {
    const { ip } = useParams<{ ip: string }>()
    const [verification, setVerification] = useState<VerificationData | null>(null)
    const [probes, setProbes] = useState<ProbeData[]>([])
    const [location, setLocation] = useState<LocationData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            if (!ip) return
            setLoading(true)
            setError(null)

            try {
                // Fetch verification data
                const verifyResp = await fetch(`${API_BASE}/ip/${encodeURIComponent(ip)}`)
                if (!verifyResp.ok) throw new Error(`Failed to fetch IP data: ${verifyResp.status}`)
                const verifyData = await verifyResp.json()
                setVerification(verifyData.verification)
                setProbes(verifyData.probes || [])

                // Set location from backend data if available
                const v = verifyData.verification
                if (v.lat != null && v.lon != null) {
                    setLocation({
                        lat: v.lat,
                        lon: v.lon,
                        city: v.city,
                        region: v.region,
                        country: v.country,
                    })
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [ip])

    if (loading) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
                <Navbar />
                <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
                    <div className="text-center text-zinc-300">Loading...</div>
                </main>
            </div>
        )
    }

    if (error || !verification) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
                <Navbar />
                <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
                    <div className="text-center text-rose-200">{error || 'IP not found'}</div>
                    <div className="mt-4 text-center">
                        <Link
                            to="/"
                            className="text-sm text-emerald-200 hover:text-emerald-100 transition"
                        >
                            ← Back to Dashboard
                        </Link>
                    </div>
                </main>
            </div>
        )
    }

    const avgLatency =
        probes.length > 0
            ? probes
                .filter((p) => typeof p.latency_ms === 'number')
                .reduce((sum, p) => sum + (p.latency_ms || 0), 0) / probes.filter((p) => typeof p.latency_ms === 'number').length
            : null

    const probesByModel = probes.reduce((acc, probe) => {
        if (!probe.model) return acc
        if (!acc[probe.model]) acc[probe.model] = []
        acc[probe.model].push(probe)
        return acc
    }, {} as Record<string, ProbeData[]>)

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
            <Navbar />
            <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
                <div className="mb-6">
                    <Link
                        to="/"
                        className="text-sm text-emerald-200 hover:text-emerald-100 transition inline-flex items-center gap-1"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>

                <header className="mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span
                                    className={`h-3 w-3 rounded-full ${verification.ok ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                />
                                <h1 className="font-mono text-3xl font-bold">{ip}</h1>
                            </div>
                            <p className="mt-2 text-sm text-zinc-300">
                                {location
                                    ? `${location.city || 'Unknown'}, ${location.region || ''} ${location.country || ''}`
                                    : 'Location unknown'}
                            </p>
                        </div>
                        {verification.ok && verification.models.length > 0 && (
                            <Link
                                to={`/chat?ip=${encodeURIComponent(ip)}`}
                                className="rounded-xl border border-emerald-400/60 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/25"
                            >
                                Chat with this host →
                            </Link>
                        )}
                    </div>
                </header>

                <div className="space-y-4">
                    {/* Status Card */}
                    <article className="rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">Status</h2>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                                <span className="block text-xs text-zinc-300">Health</span>
                                <span
                                    className={`text-xl font-bold ${verification.ok ? 'text-emerald-200' : 'text-rose-200'}`}
                                >
                                    {verification.ok ? 'Healthy' : 'Failed'}
                                </span>
                            </div>
                            <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                                <span className="block text-xs text-zinc-300">Verification Latency</span>
                                <span className="text-xl font-bold">
                                    {typeof verification.latency_ms === 'number' ? `${verification.latency_ms} ms` : 'n/a'}
                                </span>
                            </div>
                            <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                                <span className="block text-xs text-zinc-300">Models</span>
                                <span className="text-xl font-bold">{verification.models.length}</span>
                            </div>
                            <div className="rounded-lg border border-[#20232a] bg-[#121317] p-3">
                                <span className="block text-xs text-zinc-300">Probes</span>
                                <span className="text-xl font-bold">{probes.length}</span>
                            </div>
                        </div>
                        {verification.error && (
                            <div className="mt-4 rounded-lg border border-[#332222] bg-[#1b1a1a] px-4 py-3 text-sm text-rose-100">
                                <span className="font-semibold">Error:</span> {verification.error}
                            </div>
                        )}
                    </article>

                    {/* Map */}
                    {location && (
                        <article className="rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">Location</h2>
                            <div className="h-[360px] w-full overflow-hidden rounded-lg border border-[#1f2128] bg-[#0f1014]">
                                <ServerMap
                                    items={[
                                        {
                                            ip: verification.ip,
                                            ok: verification.ok,
                                            error: verification.error || undefined,
                                            lat: location.lat,
                                            lon: location.lon,
                                        },
                                    ]}
                                />
                            </div>
                        </article>
                    )}

                    {/* Models */}
                    {verification.models.length > 0 && (
                        <article className="rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                                Supported Models
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {verification.models.map((model) => (
                                    <span
                                        key={model}
                                        className="rounded-full border border-[#262930] bg-[#15171d] px-3 py-1 text-sm font-semibold"
                                    >
                                        {model}
                                    </span>
                                ))}
                            </div>
                        </article>
                    )}

                    {/* Performance by Model */}
                    {Object.keys(probesByModel).length > 0 && (
                        <article className="rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                                Performance by Model
                            </h2>
                            <div className="space-y-3">
                                {Object.entries(probesByModel).map(([model, modelProbes]) => {
                                    const successfulProbes = modelProbes.filter((p) => p.success)
                                    const avgLatencyForModel =
                                        successfulProbes.length > 0
                                            ? successfulProbes.reduce((sum, p) => sum + (p.latency_ms || 0), 0) /
                                            successfulProbes.length
                                            : null
                                    const successRate =
                                        modelProbes.length > 0
                                            ? Math.round((successfulProbes.length / modelProbes.length) * 100)
                                            : 0

                                    return (
                                        <div
                                            key={model}
                                            className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-4 py-3"
                                        >
                                            <div>
                                                <div className="font-mono text-sm font-semibold">{model}</div>
                                                <div className="text-xs text-zinc-300">
                                                    {modelProbes.length} probe{modelProbes.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-right">
                                                <div>
                                                    <div className="text-xs text-zinc-300">Success Rate</div>
                                                    <div className="text-sm font-semibold">{successRate}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-zinc-300">Avg Latency</div>
                                                    <div className="text-sm font-semibold">
                                                        {avgLatencyForModel ? `${Math.round(avgLatencyForModel)} ms` : 'n/a'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </article>
                    )}

                    {/* Recent Probes */}
                    {probes.length > 0 && (
                        <article className="rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">Recent Probes</h2>
                            <div className="space-y-2">
                                {probes.slice(0, 10).map((probe, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-4 py-3"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${probe.success
                                                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                                                        : 'border-rose-400/70 bg-rose-500/15 text-rose-100'
                                                        }`}
                                                >
                                                    {probe.success ? 'OK' : 'FAIL'}
                                                </span>
                                                <span className="font-mono text-sm">{probe.model}</span>
                                            </div>
                                            {probe.error && <div className="mt-1 text-xs text-rose-200">{probe.error}</div>}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold">
                                                {typeof probe.latency_ms === 'number' ? `${probe.latency_ms} ms` : 'n/a'}
                                            </div>
                                            <div className="text-xs text-zinc-300">
                                                {probe.ts ? new Date(probe.ts * 1000).toLocaleString() : '—'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    )}
                </div>
            </main>
        </div>
    )
}

export default IpDetail
