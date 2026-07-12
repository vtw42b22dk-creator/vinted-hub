'use client'

import Image from 'next/image'
import type { Artigo } from '@/lib/types'
import { formatEuro } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'

interface ArtigosListProps {
  artigos: Artigo[]
}

function ArtigoThumbnail({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  if (fotoUrl) {
    return (
      <Image
        src={fotoUrl}
        alt={nome}
        width={48}
        height={48}
        className="h-12 w-12 rounded-lg object-cover"
        unoptimized
      />
    )
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
      Sem foto
    </div>
  )
}

export default function ArtigosList({ artigos }: ArtigosListProps) {
  if (artigos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Ainda não há artigos no inventário.</p>
        <p className="mt-1 text-sm text-slate-500">
          Clica em &quot;Adicionar Novo Artigo&quot; para começar.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Artigo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tamanho
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preço previsto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {artigos.map((artigo) => (
              <tr key={artigo.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ArtigoThumbnail fotoUrl={artigo.foto_url} nome={artigo.nome} />
                    <div>
                      <p className="font-medium text-slate-900">{artigo.nome}</p>
                      {artigo.marca && (
                        <p className="text-xs text-slate-500">{artigo.marca}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {artigo.tamanho ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {formatEuro(Number(artigo.preco_venda_previsto))}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={artigo.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {artigos.map((artigo) => (
          <article
            key={artigo.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex gap-3">
              <ArtigoThumbnail fotoUrl={artigo.foto_url} nome={artigo.nome} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{artigo.nome}</p>
                    {artigo.marca && (
                      <p className="truncate text-xs text-slate-500">{artigo.marca}</p>
                    )}
                  </div>
                  <StatusBadge status={artigo.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Tam. {artigo.tamanho ?? '—'}</span>
                  <span className="font-semibold text-slate-900">
                    {formatEuro(Number(artigo.preco_venda_previsto))}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
