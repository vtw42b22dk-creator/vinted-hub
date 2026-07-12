import {
  arquivarConversasDeArtigosFechados,
  classificarConversa,
  classificarNegocio,
  type ConversaSyncInput,
} from '../_shared/conversa-sync.ts'
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
    const conversas = Array.isArray(body) ? body : body.conversas

    if (!Array.isArray(conversas) || conversas.length === 0) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getAdminClient()

    const ids = conversas.map((c: ConversaSyncInput) => String(c.id_vinted))
    const { data: existingRows } = await supabase
      .from('conversas')
      .select('id_vinted, status_inbox, aberta_em, ultima_mensagem_de')
      .eq('user_id', userId)
      .in('id_vinted', ids)

    const existingMap = new Map((existingRows ?? []).map((r) => [r.id_vinted, r]))

    const artigoIds = conversas
      .map((c: ConversaSyncInput) => c.id_artigo_vinted)
      .filter(Boolean) as string[]

    const artigoStatusMap = new Map<string, string>()
    if (artigoIds.length > 0) {
      const { data: artigos } = await supabase
        .from('artigos_vinted')
        .select('id_artigo, status_artigo')
        .eq('user_id', userId)
        .in('id_artigo', artigoIds)

      for (const a of artigos ?? []) {
        artigoStatusMap.set(a.id_artigo, a.status_artigo)
      }
    }

    const rows = conversas.map((c: ConversaSyncInput) => {
      const existing = existingMap.get(String(c.id_vinted))
      const artigoStatus = c.id_artigo_vinted
        ? artigoStatusMap.get(String(c.id_artigo_vinted))
        : null

      const status_inbox = classificarConversa(c, existing, artigoStatus)
      const ultimo_texto = c.ultimo_texto ? String(c.ultimo_texto) : null

      return {
        user_id: userId,
        id_vinted: String(c.id_vinted),
        user_comprador: String(c.user_comprador ?? 'desconhecido'),
        avatar_comprador: c.avatar_comprador ? String(c.avatar_comprador) : null,
        ultimo_texto,
        ultima_mensagem_de: c.ultima_mensagem_de === 'vendedor' ? 'vendedor' : 'comprador',
        status_inbox,
        status_negocio: classificarNegocio(ultimo_texto || '', status_inbox),
        valor_proposta: c.valor_proposta != null ? Number(c.valor_proposta) : null,
        id_artigo_vinted: c.id_artigo_vinted ? String(c.id_artigo_vinted) : null,
        url_conversa: c.url_conversa ? String(c.url_conversa) : null,
        item_fechado: status_inbox === 'arquivada',
        data_atualizacao: new Date().toISOString(),
      }
    })

    const { error } = await supabase.from('conversas').upsert(rows, {
      onConflict: 'user_id,id_vinted',
      ignoreDuplicates: false,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fechados = [...artigoStatusMap.entries()]
      .filter(([, s]) => s === 'vendido' || s === 'oculto')
      .map(([id]) => id)

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
