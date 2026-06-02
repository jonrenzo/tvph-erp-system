'use client'

import { useState, useEffect } from 'react'

export function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  if (!time) return null

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
      <span>{dateStr}</span>
      <span className="text-slate-300 dark:text-slate-600">•</span>
      <span>{timeStr}</span>
    </div>
  )
}
