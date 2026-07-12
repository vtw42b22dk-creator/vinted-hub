import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { arquivarConversasDeArtigosFechados } from '@/lib/conversa-sync'
import { verifySyncSecret } from '@/lib/sync-auth'
export async function POST(request: Request) {
  if (!verifySyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const artigos = Array.isArray(body) ? body : body.artigos

    if (!Array.isArray(artigos) || artigos.length === 0) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const supabase = await createClient()

    const rows = artigos.map((a: Record<string, unknown>) => ({
      id_artigo: String(a.id_artigo),
      nome: String(a.nome ?? 'Sem nome'),
      marca: a.marca ? String(a.marca) : null,
      tamanho: a.tamanho ? String(a.tamanho) : null,
      preco_venda: Number(a.preco_venda ?? 0),
      status_artigo: a.status_artigo ?? 'ativo',
      foto_url: a.foto_url ? String(a.foto_url) : null,
      url_vinted: a.url_vinted ? String(a.url_vinted) : null,
      sincronizado_em: new Date().toISOString(),
    }))

    const { error } = await supabase.from('artigos_vinted').upsert(rows, {
      onConflict: 'id_artigo',
      ignoreDuplicates: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const fechados = rows
      .filter((r) => r.status_artigo === 'vendido' || r.status_artigo === 'oculto')
      .map((r) => r.id_artigo)

    await arquivarConversasDeArtigosFechados(supabase, fechados)

    return NextResponse.json({ ok: true, synced: rows.length })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar pedido' }, { status: 500 })
  }
}
