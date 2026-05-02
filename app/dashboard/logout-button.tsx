'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '@/app/login/actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() => startTransition(async () => {
        await logout()
        router.push('/login')
      })}
      disabled={isPending}
      className="rounded-full bg-red-600/90 px-6 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
    >
      {isPending ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}
