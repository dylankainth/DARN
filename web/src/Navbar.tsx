import React from 'react'

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-[#1f2633] bg-[rgba(12,14,18,0.8)] px-6 py-3 text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="text-[30px] font-black tracking-[0.3em] text-zinc-100 transition-colors duration-200 hover:text-emerald-200"
          style={{ fontFamily: '"Press Start 2P", cursive' }}
        >
          DARN
        </a>
      </div>
    </nav>
  )
}

export default Navbar