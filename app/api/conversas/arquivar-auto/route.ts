import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { arquivarConversasDeArtigosFechados } from '@/lib/conversa-sync'

export async function POST() {
  const supabase = await createClient()

  const { data: fechados } = await supabase
    .from('artigos_vinted')
    .select('id_artigo')
    .in('status_artigo', ['vendido', 'oculto'])

  const ids = (fechados ?? []).map((a) => a.id_artigo)

  if (ids.length > 0) {
    await arquivarConversasDeArtigosFechados(supabase, ids)
  }

  const { count } = await supabase
    .from('conversas')
    .select('*', { count: 'exact', head: true })
    .eq('status_inbox', 'arquivada')

  return NextResponse.json({ ok: true, totalArquivadas: count ?? 0 })
}
