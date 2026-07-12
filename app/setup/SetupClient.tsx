'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HealthStatus {
  ready: boolean
  tables: Record<string, string | number>
  nextStep?: string
}

export default function SetupClient() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const hasOnlyDemo =
    health?.ready &&
    Number(health?.tables?.conversas) <= 5 &&
    Number(health?.tables?.artigos_vinted) <= 5

  async function checkHealth() {
    const res = await fetch('/api/dev/seed')
    setHealth(await res.json())
  }

  useEffect(() => {
    checkHealth()
  }, [])

  async function clearDemo() {
    setClearing(true)
    setMessage(null)
    const res = await fetch('/api/dev/clear-demo', { method: 'POST' })
    const data = await res.json()
    setMessage(res.ok ? data.message : data.error)
    await checkHealth()
    setClearing(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Setup — Vinted Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Segue estes passos para começar a usar o dashboard
        </p>
      </div>

      <div className="space-y-4">
        <Step number={1} title="Executar SQL no Supabase" done={health?.ready}>
          <p className="text-sm text-slate-600">
            Supabase → SQL Editor → cola o ficheiro{' '}
            <code className="rounded bg-slate-100 px-1">supabase/setup-completo.sql</code> → Run
          </p>
          <a
            href="https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-sky-600 hover:text-sky-800"
          >
            Abrir SQL Editor do teu projeto ↗
          </a>
        </Step>

        <Step number={2} title="Sincronizar dados reais da Vinted">
          <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
            <li>Instala a extensão Chrome (passo 3 abaixo)</li>
            <li>Abre <strong>vinted.pt</strong> e faz login</li>
            <li>Clica no botão <strong>⟳ Sync Hub</strong> (canto inferior direito)</li>
            <li>Ou usa o popup da extensão → &quot;Sincronizar dados reais&quot;</li>
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

        <Step
          number={3}
          title="Instalar extensão Chrome"
          done={health?.ready && Number(health?.tables?.conversas) > 0 && !hasOnlyDemo}
        >
          <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
            <li>
              Chrome → <code className="rounded bg-slate-100 px-1">chrome://extensions</code>
            </li>
            <li>Ativa &quot;Modo programador&quot;</li>
            <li>
              &quot;Carregar sem compactação&quot; → pasta{' '}
              <code className="rounded bg-slate-100 px-1">extension/</code>
            </li>
            <li>
              Sync Secret:{' '}
              <code className="rounded bg-slate-100 px-1">revenda-sync-2026-secreto</code>
            </li>
          </ol>
        </Step>
      </div>

      {message && (
        <p className={`text-sm ${message.includes('removidos') || message.includes('OK') ? 'text-emerald-700' : 'text-red-600'}`}>
          {message}
        </p>
      )}

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
