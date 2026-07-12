import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEMO_ARTIGOS = [
  { id_artigo: '100001', nome: 'Camisola Nike Dri-FIT', marca: 'Nike', tamanho: 'M', preco_venda: 22, preco_custo: 5, status_artigo: 'ativo', url_vinted: 'https://www.vinted.pt/items/100001' },
  { id_artigo: '100002', nome: 'Casaco Zara Wool', marca: 'Zara', tamanho: 'L', preco_venda: 35, preco_custo: 8, status_artigo: 'ativo', url_vinted: 'https://www.vinted.pt/items/100002' },
  { id_artigo: '100003', nome: "Calças Levi's 501", marca: "Levi's", tamanho: '32', preco_venda: 28, preco_custo: 7, status_artigo: 'reservado', url_vinted: 'https://www.vinted.pt/items/100003' },
  { id_artigo: '100004', nome: 'Vestido Mango', marca: 'Mango', tamanho: 'S', preco_venda: 18, preco_custo: 4, status_artigo: 'vendido', url_vinted: 'https://www.vinted.pt/items/100004' },
  { id_artigo: '100005', nome: 'Sweater H&M', marca: 'H&M', tamanho: 'M', preco_venda: 12, preco_custo: 3, status_artigo: 'ativo', url_vinted: 'https://www.vinted.pt/items/100005' },
]

const DEMO_CONVERSAS = [
  { id_vinted: 'conv-001', user_comprador: 'maria_pt', ultimo_texto: 'Olá! Aceitas 18€ pela camisola Nike?', ultima_mensagem_de: 'comprador', status_inbox: 'proposta_recebida', status_negocio: 'proposta_pendente', valor_proposta: 18, id_artigo_vinted: '100001', url_conversa: 'https://www.vinted.pt/inbox/conv-001' },
  { id_vinted: 'conv-002', user_comprador: 'joao_vintage', ultimo_texto: 'Ainda está disponível?', ultima_mensagem_de: 'comprador', status_inbox: 'por_responder', status_negocio: 'sem_proposta', valor_proposta: null, id_artigo_vinted: '100002', url_conversa: 'https://www.vinted.pt/inbox/conv-002' },
  { id_vinted: 'conv-003', user_comprador: 'ana_style', ultimo_texto: 'Enviei proposta de 25€', ultima_mensagem_de: 'vendedor', status_inbox: 'proposta_enviada', status_negocio: 'proposta_pendente', valor_proposta: 25, id_artigo_vinted: '100003', url_conversa: 'https://www.vinted.pt/inbox/conv-003' },
  { id_vinted: 'conv-004', user_comprador: 'pedro_deals', ultimo_texto: 'Posso pagar 30€ se enviar hoje?', ultima_mensagem_de: 'comprador', status_inbox: 'em_negociacao', status_negocio: 'proposta_pendente', valor_proposta: 30, id_artigo_vinted: '100002', url_conversa: 'https://www.vinted.pt/inbox/conv-004' },
  { id_vinted: 'conv-005', user_comprador: 'sofia_shop', ultimo_texto: 'Obrigada! Quando envias?', ultima_mensagem_de: 'comprador', status_inbox: 'por_responder', status_negocio: 'aceite', valor_proposta: null, id_artigo_vinted: '100004', url_conversa: 'https://www.vinted.pt/inbox/conv-005' },
]

export async function POST() {
  const supabase = await createClient()

  const { error: artigosError } = await supabase
    .from('artigos_vinted')
    .upsert(DEMO_ARTIGOS, { onConflict: 'id_artigo' })

  if (artigosError) {
    return NextResponse.json({
      ok: false,
      error: artigosError.message,
      hint: 'Executa supabase/setup-completo.sql no Supabase SQL Editor primeiro.',
    }, { status: 500 })
  }

  const { error: conversasError } = await supabase
    .from('conversas')
    .upsert(DEMO_CONVERSAS, { onConflict: 'id_vinted' })

  if (conversasError) {
    return NextResponse.json({ ok: false, error: conversasError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Dados demo carregados!',
    artigos: DEMO_ARTIGOS.length,
    conversas: DEMO_CONVERSAS.length,
  })
}

export async function GET() {
  const supabase = await createClient()

  const [artigos, conversas, vinted] = await Promise.all([
    supabase.from('artigos').select('id', { count: 'exact', head: true }),
    supabase.from('conversas').select('id', { count: 'exact', head: true }),
    supabase.from('artigos_vinted').select('id', { count: 'exact', head: true }),
  ])

  const ready = !artigos.error && !conversas.error && !vinted.error

  return NextResponse.json({
    ready,
    tables: {
      artigos: artigos.error ? artigos.error.message : artigos.count ?? 0,
      artigos_vinted: vinted.error ? vinted.error.message : vinted.count ?? 0,
      conversas: conversas.error ? conversas.error.message : conversas.count ?? 0,
    },
    nextStep: ready
      ? 'Tudo OK! Abre /inbox e /inventario'
      : 'Executa supabase/setup-completo.sql no Supabase SQL Editor',
  })
}
