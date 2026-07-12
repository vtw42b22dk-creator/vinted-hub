'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-400">
        <p className="font-mono text-sm">A carregar…</p>
      </div>
    )
  }

  if (auth.user) return <>{children}</>

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res =
        mode === 'login'
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password)
      if (res.error) setError(res.error.message)
      else if (mode === 'signup') {
        setError('Conta criada. Se o Supabase pedir confirmação, confirma o email antes de entrar.')
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Erro ao autenticar.')
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur"
      >
        <p className="font-mono text-xs tracking-widest text-sky-400">VINTED HUB</p>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Dashboard privado — sincroniza entre PC, iPad e telemóvel.
        </p>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          required
          className="mt-6 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-sky-500"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password (mín. 6 caracteres)"
          required
          minLength={6}
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-sky-500"
        />

        {error && (
          <p
            className={`mt-3 text-sm ${error.includes('Conta criada') ? 'text-sky-400' : 'text-rose-400'}`}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-xl border border-sky-500/40 bg-sky-500/10 py-3 font-mono text-sm text-sky-400 disabled:opacity-50"
        >
          {busy ? 'Aguarda…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
          }}
          className="mt-4 w-full text-xs text-slate-500 hover:text-slate-300"
        >
          {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>

        {!auth.configured && (
          <p className="mt-4 text-xs text-amber-400">
            Supabase não configurado — verifica NEXT_PUBLIC_SUPABASE_URL no .env
          </p>
        )}
      </form>
    </div>
  )
}
