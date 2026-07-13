import type { Compra } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

export async function loadInvestimento(supabase: Client): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('investimento')
    .select('*')
    .eq('removida', false)
    .order('data_compra', { ascending: false })

  if (error) throw error
  return (data ?? []) as Compra[]
}

export async function eliminarCompra(supabase: Client, id: string) {
  const { error } = await supabase.from('investimento').update({ removida: true }).eq('id', id)
  if (error) throw error
}

export async function moverParaVendido(
  supabase: Client,
  id: string,
  precoVenda: number,
  dataVenda?: string
) {
  const { error } = await supabase
    .from('investimento')
    .update({
      estado: 'vendido',
      preco_venda: precoVenda,
      data_venda: dataVenda ?? new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function reverterParaComprado(supabase: Client, id: string) {
  const { error } = await supabase
    .from('investimento')
    .update({ estado: 'comprado', preco_venda: null, data_venda: null })
    .eq('id', id)
  if (error) throw error
}

export async function guardarNotasCompra(supabase: Client, id: string, notas: string) {
  const { error } = await supabase
    .from('investimento')
    .update({ notas: notas.trim() || null })
    .eq('id', id)
  if (error) throw error
}
