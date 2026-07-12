import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()

  const { data: conversa, error: fetchError } = await supabase
    .from('conversas')
    .select('*')
    .eq('id_vinted', id)
    .single()

  if (fetchError || !conversa) {
    return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  let novoStatus = conversa.status_inbox

  if (conversa.status_inbox === 'por_responder' || conversa.status_inbox === 'proposta_recebida') {
    novoStatus = 'em_negociacao'
  }

  const { error } = await supabase
    .from('conversas')
    .update({
      aberta_em: new Date().toISOString(),
      status_inbox: novoStatus,
    })
    .eq('id_vinted', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status_inbox: novoStatus })
}
