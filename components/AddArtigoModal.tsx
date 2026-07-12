'use client'

import { FormEvent, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EstadoArtigo, StatusArtigo } from '@/lib/types'

const ESTADOS: EstadoArtigo[] = ['Novo', 'Excelente', 'Bom', 'Satisfatório']
const STATUSES: StatusArtigo[] = [
  'Em Stock',
  'Reservado',
  'Vendido',
  'Para Embalar',
  'Enviado',
]

interface AddArtigoModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function AddArtigoModal({ open, onClose, onSaved }: AddArtigoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const supabase = createClient()

    let fotoUrl: string | null = null
    const file = fileInputRef.current?.files?.[0]

    try {
      if (file) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('artigos-fotos')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: publicUrl } = supabase.storage
          .from('artigos-fotos')
          .getPublicUrl(path)

        fotoUrl = publicUrl.publicUrl
      }

      const precoVendaRealRaw = formData.get('preco_venda_real') as string

      const { error: insertError } = await supabase.from('artigos').insert({
        nome: formData.get('nome') as string,
        marca: (formData.get('marca') as string) || null,
        tamanho: (formData.get('tamanho') as string) || null,
        estado_artigo: formData.get('estado_artigo') as EstadoArtigo,
        preco_custo: Number(formData.get('preco_custo')),
        preco_venda_previsto: Number(formData.get('preco_venda_previsto')),
        preco_venda_real: precoVendaRealRaw ? Number(precoVendaRealRaw) : null,
        foto_url: fotoUrl,
        status: formData.get('status') as StatusArtigo,
      })

      if (insertError) throw insertError

      form.reset()
      onClose()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar o artigo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Adicionar Novo Artigo</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nome">
              Nome *
            </label>
            <input
              id="nome"
              name="nome"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Ex: Camisola Nike"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="marca">
                Marca
              </label>
              <input
                id="marca"
                name="marca"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Nike"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tamanho">
                Tamanho
              </label>
              <input
                id="tamanho"
                name="tamanho"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="M"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="estado_artigo"
              >
                Estado
              </label>
              <select
                id="estado_artigo"
                name="estado_artigo"
                defaultValue="Bom"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="Em Stock"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="preco_custo"
              >
                Preço de custo (€) *
              </label>
              <input
                id="preco_custo"
                name="preco_custo"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="5.00"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="preco_venda_previsto"
              >
                Preço previsto (€) *
              </label>
              <input
                id="preco_venda_previsto"
                name="preco_venda_previsto"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="15.00"
              />
            </div>
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="preco_venda_real"
            >
              Preço de venda real (€)
            </label>
            <input
              id="preco_venda_real"
              name="preco_venda_real"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Opcional — preencher quando vendido"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="foto">
              Foto
            </label>
            <input
              id="foto"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'A guardar…' : 'Guardar Artigo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
