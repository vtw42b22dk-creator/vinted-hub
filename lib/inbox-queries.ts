import type { Conversa, InboxCounts } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

// Só aparecem conversas adicionadas manualmente pelo botão na Vinted.
export async function loadConversas(supabase: Client): Promise<Conversa[]> {
  const { data, error } = await supabase
    .from('conversas')
    .select('*')
    .eq('adicionada_manual', true)
    .eq('suprimida', false)
    .order('data_atualizacao', { ascending: false })

  if (error) throw error
  return (data ?? []) as Conversa[]
}

export async function getInboxCounts(supabase: Client): Promise<InboxCounts> {
  const { count, error } = await supabase
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('adicionada_manual', true)
    .eq('suprimida', false)

  if (error) return { total: 0 }
  return { total: count ?? 0 }
}

export async function guardarNotas(supabase: Client, id: string, notas: string) {
  const { error } = await supabase
    .from('conversas')
    .update({ notas: notas.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export async function removerConversas(supabase: Client, ids: string[]) {
  if (!ids.length) return
  await supabase
    .from('conversas')
    .update({ suprimida: true, adicionada_manual: false, fixada_em: null })
    .in('id', ids)
}
