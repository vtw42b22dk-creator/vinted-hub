import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  arquivarConversasDeArtigosFechados,
  classificarConversa,
  classificarNegocio,
  type ConversaSyncInput,
} from '@/lib/conversa-sync'
import { verifySyncSecret } from '@/lib/sync-auth'

export async function POST(request: Request) {
  if (!verifySyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const conversas = Array.isArray(body) ? body : body.conversas

    if (!Array.isArray(conversas) || conversas.length === 0) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const supabase = await createClient()

    const ids = conversas.map((c: ConversaSyncInput) => String(c.id_vinted))
    const { data: existingRows } = await supabase
      .from('conversas')
      .select('id_vinted, status_inbox, aberta_em, ultima_mensagem_de')
      .in('id_vinted', ids)

    const existingMap = new Map(
      (existingRows ?? []).map((r) => [r.id_vinted, r])
    )

    const artigoIds = conversas
      .map((c: ConversaSyncInput) => c.id_artigo_vinted)
      .filter(Boolean) as string[]

    const artigoStatusMap = new Map<string, string>()
    if (artigoIds.length > 0) {
      const { data: artigos } = await supabase
        .from('artigos_vinted')
        .select('id_artigo, status_artigo')
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
      onConflict: 'id_vinted',
      ignoreDuplicates: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const fechados = [...artigoStatusMap.entries()]
      .filter(([, s]) => s === 'vendido' || s === 'oculto')
      .map(([id]) => id)

    await arquivarConversasDeArtigosFechados(supabase, fechados)

    return NextResponse.json({ ok: true, synced: rows.length })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar pedido' }, { status: 500 })
  }
}
