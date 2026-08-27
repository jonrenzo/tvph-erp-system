'use client'

import { useRef, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { AuditLogDrawer } from './audit-log-drawer'

export function DashboardShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  userRole,
}: {
  children: React.ReactNode
  userEmail: string
  userName?: string
  avatarUrl?: string
  userRole: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  return (
    <div className="flex h-full bg-slate-50 dark:bg-[#071F15] overflow-auto overscroll-y-contain text-slate-600 dark:text-slate-300">
        {/* Sidebar */}
        <Sidebar
          userEmail={userEmail}
          userRole={userRole}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
          scrollTargetRef={mainRef}
        />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            isCollapsed={isCollapsed}
            onCollapseToggle={() => setIsCollapsed(!isCollapsed)}
            onAuditOpen={() => setAuditOpen(true)}
          />
          <main ref={mainRef} className="flex-1 overflow-auto overscroll-y-contain bg-white dark:bg-[#0a0a0a]">
            {children}
          </main>
        </div>

        <AuditLogDrawer isOpen={auditOpen} onClose={() => setAuditOpen(false)} />
      </div>
  )
}
