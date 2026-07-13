export type StatusArtigo =
  | 'Em Stock'
  | 'Reservado'
  | 'Vendido'
  | 'Para Embalar'
  | 'Enviado'

export type EstadoArtigo = 'Novo' | 'Excelente' | 'Bom' | 'Satisfatório'

export type StatusInbox =
  | 'por_responder'
  | 'proposta_recebida'
  | 'proposta_enviada'
  | 'arquivada'

export type IniciadaPor = 'comprador' | 'vendedor'

export type StatusNegocio =
  | 'sem_proposta'
  | 'proposta_pendente'
  | 'aceite'
  | 'recusada'
  | 'expirada'

export type StatusArtigoVinted = 'ativo' | 'reservado' | 'vendido' | 'rascunho' | 'oculto'

export interface Conversa {
  id: string
  id_vinted: string
  user_comprador: string
  avatar_comprador: string | null
  ultimo_texto: string | null
  ultima_mensagem_de: 'comprador' | 'vendedor'
  status_inbox: StatusInbox
  status_negocio: StatusNegocio
  valor_proposta: number | null
  id_artigo_vinted: string | null
  url_conversa: string | null
  data_atualizacao: string
  criado_em: string
  aberta_em?: string | null
  vista_em?: string | null
  suprimida?: boolean
  oculta_por_responder?: boolean
  precisa_responder?: boolean
  vinted_unread?: boolean
  eh_proposta?: boolean
  iniciada_por?: IniciadaPor | null
  fixada_em?: string | null
  mensagens_json?: MensagemConversa[]
  notas?: string | null
  adicionada_manual?: boolean
  pasta_id?: string | null
}

export interface PastaConversas {
  id: string
  nome: string
  criado_em: string
}

export interface MensagemConversa {
  texto: string
  de: 'comprador' | 'vendedor' | 'sistema'
  data?: string | null
  tipo?: 'mensagem' | 'sistema' | 'oferta'
}

export interface ArtigoVinted {
  id: string
  id_artigo: string
  nome: string
  marca: string | null
  tamanho: string | null
  preco_venda: number
  preco_custo: number
  status_artigo: StatusArtigoVinted
  foto_url: string | null
  url_vinted: string | null
  sincronizado_em: string
  atualizado_em: string
  criado_em: string
  lucro_bruto?: number
  margem_percentual?: number
}

export interface InventarioMetrics {
  totalAtivos: number
  investimentoTotal: number
  valorPotencial: number
  lucroRealizado: number
}

export interface InboxCounts {
  total: number
}
