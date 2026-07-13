import type { Compra } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isHoje } from '@/lib/vendas-queries'

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

// Peças já marcadas como vendidas (movidas de "Investimento" → "Vendidos").
// É isto que alimenta a aba de Vendas.
export async function loadVendidos(supabase: Client): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('investimento')
    .select('*')
    .eq('removida', false)
    .eq('estado', 'vendido')
    .order('data_venda', { ascending: false })

  if (error) throw error
  return (data ?? []) as Compra[]
}

// Início de ontem (00:00). Serve para o filtro "comprado desde ontem".
export function inicioDeOntem(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

export function somarVendaPreco(compras: Compra[]): number {
  return compras.reduce((s, c) => s + Number(c.preco_venda ?? 0), 0)
}

export function somarLucro(compras: Compra[]): number {
  return compras.reduce(
    (s, c) => s + (Number(c.preco_venda ?? 0) - Number(c.preco_compra)),
    0
  )
}

export function vendidosHoje(compras: Compra[]): number {
  return somarVendaPreco(compras.filter((c) => c.data_venda && isHoje(c.data_venda)))
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
