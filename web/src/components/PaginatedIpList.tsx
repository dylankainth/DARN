import { useState } from 'react'
import { Link } from 'react-router-dom'

type IpItem = {
    ip: string
    ok: boolean
    latency_ms: number | null
    checked_at: string
    models: string[]
    error: string | null
}

type Props = {
    title: string
    items: IpItem[]
    itemsPerPage?: number
    showDetailsButton?: boolean
    onViewDetails?: (item: IpItem) => void
}

const formatLatency = (latency: number | null) =>
    typeof latency === 'number' && latency >= 0 ? `${latency} ms` : 'n/a'

export default function PaginatedIpList({
    title,
    items,
    itemsPerPage = 5,
    showDetailsButton = false,
    onViewDetails
}: Props) {
    const [currentPage, setCurrentPage] = useState(1)
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState('')

    const totalPages = Math.ceil(items.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentItems = items.slice(startIndex, endIndex)

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    }

    const handleDoubleClick = () => {
        setIsEditing(true)
        setEditValue(currentPage.toString())
    }

    const handleEditSubmit = () => {
        const pageNum = parseInt(editValue, 10)
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            goToPage(pageNum)
        }
        setIsEditing(false)
        setEditValue('')
    }

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditSubmit()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
            setEditValue('')
        }
    }

    if (items.length === 0) {
        return (
            <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)] min-h-[260px]">
                <div className="mb-3 text-sm font-semibold tracking-wide">{title}</div>
                <p className="text-sm text-zinc-300">No items to display.</p>
            </article>
        )
    }

    return (
        <article className="mb-4 break-inside-avoid rounded-xl border border-[#22242b] bg-[linear-gradient(160deg,#131419_0%,#0f1014_100%)] p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)] min-h-[260px]">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide">{title}</div>
                <div className="text-xs text-zinc-400">
                    {items.length} total
                </div>
            </div>

            <div className="space-y-2">
                {currentItems.map((row) => (
                    <div
                        key={row.ip + row.checked_at}
                        className="flex items-center justify-between rounded-lg border border-[#1f2128] bg-[#0f1014] px-3 py-2"
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Link to={`/ip/${row.ip}`} className="font-mono text-sm hover:text-zinc-300 transition">
                                {row.ip}
                            </Link>
                            <span className="text-xs text-zinc-400 truncate">
                                {formatLatency(row.latency_ms)}
                            </span>
                        </div>

                        {showDetailsButton && onViewDetails && (
                            <button
                                className="rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:border-rose-300 hover:bg-rose-500/20 flex-shrink-0"
                                onClick={() => onViewDetails(row)}
                            >
                                View details
                            </button>
                        )}

                        {!showDetailsButton && (
                            <span
                                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold flex-shrink-0 ${row.ok
                                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                                    : 'border-rose-400/70 bg-rose-500/15 text-rose-100'
                                    }`}
                            >
                                {row.ok ? 'OK' : 'FAIL'}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-[#1f2128] pt-3">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="rounded-lg border border-[#2a2d35] bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-[#3a3d44] hover:bg-[#1a1c22] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>

                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <input
                                type="number"
                                min="1"
                                max={totalPages}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleEditSubmit}
                                onKeyDown={handleEditKeyDown}
                                autoFocus
                                className="w-16 rounded border border-[#3a3d44] bg-[#1a1c22] px-2 py-1 text-center text-sm font-semibold text-zinc-100 focus:border-[#4a4d54] focus:outline-none"
                            />
                        ) : (
                            <div
                                onDoubleClick={handleDoubleClick}
                                className="cursor-pointer rounded border border-[#2a2d35] bg-[#16181d] px-3 py-1.5 text-sm font-semibold text-zinc-100 transition hover:border-[#3a3d44] hover:bg-[#1a1c22]"
                                title="Double-click to edit page number"
                            >
                                {currentPage} / {totalPages}
                            </div>
                        )}
                        <span className="text-xs text-zinc-400">
                            ({items.length} total)
                        </span>
                    </div>

                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="rounded-lg border border-[#2a2d35] bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-[#3a3d44] hover:bg-[#1a1c22] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
        </article>
    )
}
