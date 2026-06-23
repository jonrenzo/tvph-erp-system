'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
// Lazy load — AI chat is heavy (AI SDK, markdown renderer) and rarely used on first load
const AIChatBubble = dynamic(
  () => import('./ai/chat-bubble').then(mod => ({ default: mod.AIChatBubble })),
  { ssr: false }
)

const AuditLogCard = dynamic(
  () => import('./audit-log-card').then(mod => ({ default: mod.AuditLogCard })),
  { ssr: false }
)

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
  const pathname = usePathname()

  const isEditorRoute = pathname?.endsWith('/editor') || pathname?.includes('/editor/')

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#071F15] overflow-hidden text-slate-600 dark:text-slate-300">
        {/* Sidebar */}
        <Sidebar
          userEmail={userEmail}
          userRole={userRole}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
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
          />
          <main className="flex-1 overflow-auto bg-white dark:bg-[#0a0a0a]">
            <div className="min-h-full flex flex-col">
              <div className="flex-1 pb-24">
                {children}
              </div>
            </div>
          </main>
        </div>

        <AIChatBubble />

        {/* Contextual Audit Log Card */}
        {!isEditorRoute && (
          <div className="fixed bottom-6 right-6 z-[100]">
            <AuditLogCard />
          </div>
        )}
      </div>
  )
}
