'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { getFunctionsUrl, getSiteUrl } from '@/lib/config'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/AuthContext'

interface HealthStatus {
  ready: boolean
  tables: Record<string, string | number>
}

export default function SetupClient() {
  const auth = useAuth()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [syncSecret, setSyncSecret] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const hasOnlyDemo =
    health?.ready &&
    Number(health?.tables?.conversas) <= 5 &&
    Number(health?.tables?.artigos_vinted) <= 5

  const checkHealth = useCallback(async () => {
    const supabase = createClient()
    const [artigos, conversas, vinted, profile] = await Promise.all([
      supabase.from('artigos').select('id', { count: 'exact', head: true }),
      supabase.from('conversas').select('id', { count: 'exact', head: true }),
      supabase.from('artigos_vinted').select('id', { count: 'exact', head: true }),
      auth.user
        ? supabase.from('profiles').select('sync_secret').eq('id', auth.user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const ready = !artigos.error && !conversas.error && !vinted.error
    setHealth({
      ready,
      tables: {
        artigos: artigos.error ? artigos.error.message : (artigos.count ?? 0),
        artigos_vinted: vinted.error ? vinted.error.message : (vinted.count ?? 0),
        conversas: conversas.error ? conversas.error.message : (conversas.count ?? 0),
      },
    })
    if (profile.data?.sync_secret) setSyncSecret(profile.data.sync_secret)
  }, [auth.user])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  async function clearDemo() {
    setClearing(true)
    setMessage(null)
    const supabase = createClient()

    const demoIds = ['100001', '100002', '100003', '100004', '100005']
    const demoConvIds = ['conv-001', 'conv-002', 'conv-003', 'conv-004', 'conv-005']

    await supabase.from('conversas').delete().in('id_vinted', demoConvIds)
    await supabase.from('artigos_vinted').delete().in('id_artigo', demoIds)
    await supabase.from('artigos').delete().eq('nome', 'Blusa vintage manual')

    setMessage('Dados demo removidos.')
    await checkHealth()
    setClearing(false)
  }

  const functionsUrl = getFunctionsUrl()
  const siteUrl = getSiteUrl()

  return (
    <AppShell onRefresh={checkHealth}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Setup — Vinted Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Site online:{' '}
            <a href={siteUrl} className="text-sky-600 hover:underline" target="_blank" rel="noreferrer">
              {siteUrl || 'GitHub Pages'}
            </a>
          </p>
        </div>

        <div className="space-y-4">
          <Step number={1} title="Executar SQL no Supabase" done={health?.ready}>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
              <li>
                <code className="rounded bg-slate-100 px-1">supabase/setup-completo.sql</code>
              </li>
              <li>
                Depois: <code className="rounded bg-slate-100 px-1">supabase/auth-rls.sql</code>
              </li>
            </ol>
            <a
              href="https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-sky-600 hover:text-sky-800"
            >
              Abrir SQL Editor ↗
            </a>
          </Step>

          <Step number={2} title="Deploy Edge Functions (sync extensão)" done={Boolean(functionsUrl)}>
            <p className="text-sm text-slate-600">
              A extensão Chrome envia dados para Supabase Edge Functions (não localhost).
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {`npx supabase login
npx supabase link --project-ref varmqpsxxmwtuxwltppn
npx supabase functions deploy sync-artigos
npx supabase functions deploy sync-conversas`}
            </pre>
          </Step>

          <Step number={3} title="Instalar extensão Chrome">
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
              <li>
                Chrome → <code className="rounded bg-slate-100 px-1">chrome://extensions</code>
              </li>
              <li>Modo programador → Carregar pasta <code className="rounded bg-slate-100 px-1">extension/</code></li>
              <li>
                URL Functions:{' '}
                <code className="rounded bg-slate-100 px-1 break-all">{functionsUrl || '…'}</code>
              </li>
              <li>
                Sync Secret:{' '}
                <code className="rounded bg-slate-100 px-1 break-all">
                  {syncSecret || 'Executa auth-rls.sql e recarrega'}
                </code>
              </li>
            </ol>
            <button
              type="button"
              onClick={clearDemo}
              disabled={clearing}
              className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {clearing ? 'A apagar…' : 'Apagar dados demo'}
            </button>
          </Step>
        </div>

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        {health && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium text-slate-900">Estado das tabelas</p>
            <ul className="mt-2 space-y-1 text-slate-600">
              {Object.entries(health.tables).map(([table, val]) => (
                <li key={table}>
                  {table}: {typeof val === 'number' ? `${val} registos` : `❌ ${val}`}
                </li>
              ))}
            </ul>
            {hasOnlyDemo && (
              <p className="mt-2 text-xs text-amber-600">Apenas dados demo — sincroniza a Vinted.</p>
            )}
          </div>
        )}

        {health?.ready && (
          <div className="flex gap-3">
            <Link
              href="/inbox"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Ver Inbox →
            </Link>
            <Link
              href="/inventario"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver Inventário →
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number
  title: string
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {done ? '✓' : number}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-3 pl-11">{children}</div>
    </div>
  )
}
