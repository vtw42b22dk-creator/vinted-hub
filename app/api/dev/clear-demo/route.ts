import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  const { error: convError } = await supabase
    .from('conversas')
    .delete()
    .like('id_vinted', 'conv-%')

  const { error: artError } = await supabase
    .from('artigos_vinted')
    .delete()
    .like('id_artigo', '10000%')

  if (convError || artError) {
    return NextResponse.json({
      ok: false,
      error: convError?.message || artError?.message,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Dados demo removidos. Pronto para sync real.' })
}
