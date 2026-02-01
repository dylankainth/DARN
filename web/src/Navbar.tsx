import React from 'react'
import { Link, NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${isActive ? 'bg-[#161c27] text-zinc-50' : 'text-zinc-300 hover:text-zinc-100'}`

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-[#1f2633] bg-[rgba(12,14,18,0.8)] px-6 py-3 text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-[20px] font-black tracking-[0.3em] text-zinc-100 transition-colors duration-200 hover:text-emerald-200"
          style={{ fontFamily: '"Press Start 2P", cursive' }}
        >
          DARN
        </Link>
        <div className="flex items-center gap-2">
          <NavLink to="/" className={navLinkClass} end>
            Dashboard
          </NavLink>
          <NavLink to="/chat" className={navLinkClass}>
            Chat
          </NavLink>
        </div>
      </div>
    </nav>
  )
}

export default Navbar