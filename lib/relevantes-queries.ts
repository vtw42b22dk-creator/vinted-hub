import type { Relevante } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

export async function loadRelevantes(supabase: Client): Promise<Relevante[]> {
  const { data, error } = await supabase
    .from('relevantes')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) throw error
  return (data ?? []) as Relevante[]
}

export async function eliminarRelevante(supabase: Client, id: string) {
  const { error } = await supabase.from('relevantes').delete().eq('id', id)
  if (error) throw error
}

export function somarRelevantes(relevantes: Relevante[]): number {
  return relevantes.reduce((s, r) => s + Number(r.preco ?? 0), 0)
}
