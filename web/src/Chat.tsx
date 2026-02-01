import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from './Navbar'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const API_CHAT_CHOICES = `${API_BASE.replace(/\/+$/, '')}/chat/choices`
const API_CHAT_RELAY = `${API_BASE.replace(/\/+$/, '')}/chat/relay`

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Choice = { ip: string; models: string[]; score?: number; latency_ms?: number }

function Chat() {
    const [searchParams] = useSearchParams()
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Hi! I am your DARN chat helper. Pick a host/model, then ask away.' },
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [choices, setChoices] = useState<Choice[]>([])
    const [selectedIp, setSelectedIp] = useState('')
    const [selectedModel, setSelectedModel] = useState('')
    const [fetchError, setFetchError] = useState<string | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)

    const placeholder = useMemo(() => 'Message DARN...', [])

    useEffect(() => {
        const loadChoices = async () => {
            setFetchError(null)
            try {
                const resp = await fetch(API_CHAT_CHOICES)
                if (!resp.ok) throw new Error(`Failed to load hosts (status ${resp.status})`)
                const json = await resp.json()
                const items: Choice[] = json.items || []
                setChoices(items)

                // Check if IP is provided in URL params
                const ipParam = searchParams.get('ip')
                if (ipParam && items.length) {
                    const matchedChoice = items.find(c => c.ip === ipParam)
                    if (matchedChoice) {
                        setSelectedIp(matchedChoice.ip)
                        setSelectedModel(matchedChoice.models?.[0] ?? '')
                    } else if (items.length) {
                        setSelectedIp(items[0].ip)
                        setSelectedModel(items[0].models?.[0] ?? '')
                    }
                } else if (items.length) {
                    setSelectedIp(items[0].ip)
                    setSelectedModel(items[0].models?.[0] ?? '')
                }
            } catch (err) {
                setFetchError(err instanceof Error ? err.message : 'Unknown error')
            }
        }
        loadChoices()
    }, [searchParams])

    const scrollToBottom = () => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async (e?: FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || !selectedIp || !selectedModel) return
        const userText = input.trim()
        setInput('')
        setMessages((m) => [...m, { role: 'user', content: userText }])
        setLoading(true)

        try {
            const url = `${API_CHAT_RELAY}?ip=${encodeURIComponent(selectedIp)}&model=${encodeURIComponent(
                selectedModel,
            )}&prompt=${encodeURIComponent(userText)}`
            const resp = await fetch(url, { method: 'POST' })
            if (!resp.ok) {
                const text = await resp.text()
                throw new Error(text || `Upstream status ${resp.status}`)
            }
            const data = await resp.json()
            const payload = data?.data || data
            const reply =
                payload?.response ||
                payload?.text ||
                payload?.message ||
                JSON.stringify(payload, null, 2)

            setMessages((m) => [...m, { role: 'assistant', content: reply }])
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Request failed'
            setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }])
        } finally {
            setLoading(false)
        }
    }

    const selectedChoice = choices.find((c) => c.ip === selectedIp)
    const modelsForIp = selectedChoice?.models ?? []

    useEffect(() => {
        if (!modelsForIp.length) {
            setSelectedModel('')
        } else if (!modelsForIp.includes(selectedModel)) {
            setSelectedModel(modelsForIp[0])
        }
    }, [selectedIp, modelsForIp, selectedModel])

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
            <Navbar />
            <main className="mx-auto flex max-w-5xl flex-col gap-4 px-6 pb-12 pt-8">
                <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-300">Chat</p>
                        <h1 className="text-2xl font-semibold">DARN Chat</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Host</label>
                            <select
                                className="rounded-lg border border-[#22242b] bg-[#121317] px-3 py-2 text-sm text-zinc-100"
                                value={selectedIp}
                                onChange={(e) => setSelectedIp(e.target.value)}
                            >
                                {choices.map((c) => (
                                    <option key={c.ip} value={c.ip}>
                                        {c.ip} {typeof c.score === 'number' ? `(score ${c.score.toFixed(1)})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Model</label>
                            <select
                                className="rounded-lg border border-[#22242b] bg-[#121317] px-3 py-2 text-sm text-zinc-100"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={!modelsForIp.length}
                            >
                                {modelsForIp.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {fetchError && <span className="text-sm text-rose-200">{fetchError}</span>}
                    </div>
                </header>

                <div className="flex-1 rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                    <div ref={listRef} className="h-[60vh] space-y-3 overflow-y-auto px-4 py-4">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                                <div
                                    className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-lg ${m.role === 'assistant'
                                        ? 'border-[#1f2128] bg-[#15171d] text-zinc-100'
                                        : 'border-emerald-300/60 bg-emerald-500/90 text-white'
                                        }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[70%] rounded-2xl border border-[#1f2128] bg-[#15171d] px-4 py-3 text-sm text-zinc-200">
                                    Thinking…
                                </div>
                            </div>
                        )}
                    </div>
                    <form onSubmit={sendMessage} className="border-t border-[#22242b] bg-[#0f1014]/60 px-4 py-3">
                        <div className="flex items-center gap-3 rounded-xl border border-[#22242b] bg-[#0f0f12]/80 px-3 py-2">
                            <textarea
                                className="min-h-[48px] flex-1 resize-none bg-transparent text-sm text-zinc-100 outline-none"
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={placeholder}
                            />
                            <button
                                type="submit"
                                className="rounded-lg border border-emerald-400/60 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
                                disabled={loading || !input.trim() || !selectedIp || !selectedModel}
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}

export default Chat
