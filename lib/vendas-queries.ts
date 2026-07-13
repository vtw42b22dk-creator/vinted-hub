import type { Venda } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient

export async function loadVendas(supabase: Client): Promise<Venda[]> {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .order('data_venda', { ascending: false })

  if (error) throw error
  return (data ?? []) as Venda[]
}

export function isHoje(dateString: string): boolean {
  const d = new Date(dateString)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function somarVendas(vendas: Venda[]): number {
  return vendas.reduce((sum, v) => sum + Number(v.preco), 0)
}

export function totalHoje(vendas: Venda[]): number {
  return somarVendas(vendas.filter((v) => isHoje(v.data_venda)))
}
