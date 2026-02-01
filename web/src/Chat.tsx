import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './Navbar'

const cannedReplies = [
    "Sure, let's dig into that.",
    "Here's what I think...",
    "Interesting—can you clarify a bit more?",
    "Got it. I'll summarize next.",
]

function Chat() {
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
        { role: 'assistant', content: 'Hi! I am your DARN chat helper. Ask me anything.' },
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const listRef = useRef<HTMLDivElement | null>(null)

    const sendMessage = async (e?: FormEvent) => {
        e?.preventDefault()
        if (!input.trim()) return
        const userText = input.trim()
        setInput('')
        setMessages((m) => [...m, { role: 'user', content: userText }])
        setLoading(true)

        // Simulated assistant response
        const reply = cannedReplies[Math.floor(Math.random() * cannedReplies.length)]
        setTimeout(() => {
            setMessages((m) => [...m, { role: 'assistant', content: reply }])
            setLoading(false)
        }, 400)
    }

    const scrollToBottom = () => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const placeholder = useMemo(
        () => "Message DARN...",
        [],
    )

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_40%),#0f0f12] text-zinc-100">
            <Navbar />
            <main className="mx-auto flex max-w-5xl flex-col gap-4 px-6 pb-12 pt-8">
                <header className="flex items-baseline justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-300">Chat</p>
                        <h1 className="text-2xl font-semibold">DARN Chat</h1>
                    </div>
                </header>

                <div className="flex-1 rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                    <div
                        ref={listRef}
                        className="h-[60vh] overflow-y-auto px-4 py-4 space-y-3"
                    >
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${m.role === 'assistant'
                                            ? 'bg-[#15171d] text-zinc-100 border border-[#1f2128]'
                                            : 'bg-emerald-500/90 text-white border border-emerald-300/60'
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
                                disabled={loading || !input.trim()}
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
