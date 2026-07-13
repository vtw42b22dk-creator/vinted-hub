import type { Conversa, InboxCounts, StatusInbox } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

export async function loadConversasPorFiltro(
  supabase: Client,
  filtro: StatusInbox
): Promise<Conversa[]> {
  let query = supabase.from('conversas').select('*').eq('suprimida', false)

  if (filtro === 'por_responder') {
    query = query.eq('precisa_responder', true).eq('oculta_por_responder', false)
  } else if (filtro === 'proposta_recebida') {
    query = query.eq('iniciada_por', 'comprador').eq('eh_proposta', true)
  } else if (filtro === 'proposta_enviada') {
    query = query.eq('iniciada_por', 'vendedor')
  }

  const { data, error } = await query.order('data_atualizacao', { ascending: false })
  if (error) throw error
  return (data ?? []) as Conversa[]
}

export async function getInboxCounts(supabase: Client): Promise<InboxCounts> {
  const [porResponder, recebidas, enviadas] = await Promise.all([
    supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('suprimida', false)
      .eq('precisa_responder', true)
      .eq('oculta_por_responder', false),
    supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('suprimida', false)
      .eq('iniciada_por', 'comprador')
      .eq('eh_proposta', true),
    supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('suprimida', false)
      .eq('iniciada_por', 'vendedor'),
  ])

  return {
    por_responder: porResponder.count ?? 0,
    proposta_recebida: recebidas.count ?? 0,
    proposta_enviada: enviadas.count ?? 0,
  }
}

export async function marcarComoVista(supabase: Client, ids: string[]) {
  if (!ids.length) return
  const now = new Date().toISOString()
  await supabase
    .from('conversas')
    .update({
      vista_em: now,
      aberta_em: now,
      oculta_por_responder: true,
      precisa_responder: false,
      vinted_unread: false,
    })
    .in('id', ids)
}

export async function arquivarConversas(supabase: Client, ids: string[]) {
  if (!ids.length) return
  await supabase
    .from('conversas')
    .update({
      suprimida: true,
      oculta_por_responder: true,
      precisa_responder: false,
      status_inbox: 'arquivada',
      fixada_em: null,
    })
    .in('id', ids)
}
