import type { Conversa, InboxCounts, StatusInbox } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

// Regras dos separadores:
// - Por responder: precisa_responder e ainda não marcada como vista
// - Propostas recebidas: conversa iniciada pelo comprador (inclui as por responder)
// - Propostas enviadas: conversa iniciada por ti
export async function loadConversasPorFiltro(
  supabase: Client,
  filtro: StatusInbox
): Promise<Conversa[]> {
  let query = supabase.from('conversas').select('*').eq('suprimida', false)

  if (filtro === 'por_responder') {
    query = query.eq('precisa_responder', true).eq('oculta_por_responder', false)
  } else if (filtro === 'proposta_recebida') {
    query = query
      .neq('status_inbox', 'arquivada')
      .or('iniciada_por.eq.comprador,iniciada_por.is.null')
  } else if (filtro === 'proposta_enviada') {
    query = query.neq('status_inbox', 'arquivada').eq('iniciada_por', 'vendedor')
  }

  const { data, error } = await query.order('data_atualizacao', { ascending: false })
  if (error) return loadConversasFallback(supabase, filtro)
  return (data ?? []) as Conversa[]
}

// Fallback para bases de dados sem as colunas novas (SQL ainda não corrido)
async function loadConversasFallback(supabase: Client, filtro: StatusInbox): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from('conversas')
    .select('*')
    .eq('status_inbox', filtro)
    .order('data_atualizacao', { ascending: false })
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
      .neq('status_inbox', 'arquivada')
      .or('iniciada_por.eq.comprador,iniciada_por.is.null'),
    supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('suprimida', false)
      .neq('status_inbox', 'arquivada')
      .eq('iniciada_por', 'vendedor'),
  ])

  if (porResponder.error) return getInboxCountsFallback(supabase)

  return {
    por_responder: porResponder.count ?? 0,
    proposta_recebida: recebidas.count ?? 0,
    proposta_enviada: enviadas.count ?? 0,
  }
}

async function getInboxCountsFallback(supabase: Client): Promise<InboxCounts> {
  const { data } = await supabase
    .from('conversas')
    .select('status_inbox')
    .neq('status_inbox', 'arquivada')

  const counts: InboxCounts = {
    por_responder: 0,
    proposta_recebida: 0,
    proposta_enviada: 0,
  }
  for (const row of data ?? []) {
    const key = row.status_inbox as keyof InboxCounts
    if (key in counts) counts[key]++
  }
  return counts
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
