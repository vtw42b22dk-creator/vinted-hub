import { arquivarConversasDeArtigosFechados } from '../_shared/conversa-sync.ts'
import { corsHeaders, getAdminClient, resolveUserId } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userId = await resolveUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const artigos = Array.isArray(body) ? body : body.artigos

    if (!Array.isArray(artigos) || artigos.length === 0) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()

    const rows = artigos.map((a: Record<string, unknown>) => ({
      user_id: userId,
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
      onConflict: 'user_id,id_artigo',
      ignoreDuplicates: false,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fechados = rows
      .filter((r) => r.status_artigo === 'vendido' || r.status_artigo === 'oculto')
      .map((r) => r.id_artigo)

    await arquivarConversasDeArtigosFechados(supabase, fechados)

    return new Response(JSON.stringify({ ok: true, synced: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro ao processar pedido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
