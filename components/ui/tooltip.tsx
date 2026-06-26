"use client"

import { useState, useRef, ReactNode } from "react"
import { createPortal } from "react-dom"

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.top - 8, left: r.left + r.width / 2 })
    }
    setVisible(true)
  }

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && typeof document !== "undefined" && createPortal(
        <div
          className="fixed pointer-events-none z-[var(--z-dropdown)] px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs whitespace-nowrap shadow-lg"
          style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  )
}
