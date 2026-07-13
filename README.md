# Vinted Hub — Dashboard de Revenda

Dashboard privado para gerir a tua conta Vinted: mensagens, negociações e inventário com auto-sync.

## Stack

- **Next.js 15** (App Router) + React + Tailwind CSS
- **Supabase** (PostgreSQL + Storage)
- **Extensão Chrome** (fase 2) → sync via API

## Rotas

| Rota | Função |
|------|--------|
| `/` | Visão geral |
| `/inbox` | Mensagens & negociações (filtros) |
| `/relevantes` | Anúncios a comprar (marcados na Vinted com ⭐) |
| `/investimento` | Compras desde ontem (mover p/ vendidos) |
| `/vendas` | Vendas (movidas do investimento) + eliminar |
| `/analytics` | Lucro, ROI, ritmo de compras/vendas |

## Setup Supabase

1. Executa `supabase/schema.sql` (tabela manual `artigos`)
2. Executa `supabase/schema-vinted.sql` (tabelas `conversas` + `artigos_vinted`)
3. Cria bucket **artigos-fotos** (público) em Storage
4. Preenche `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SYNC_SECRET=um-segredo-forte
```

## Arrancar

```powershell
cd C:\Users\marti\Projects\revenda-dashboard
npm install
npm run dev
```

## API Sync (extensão Chrome)

### POST `/api/sync/artigos`

```json
{
  "artigos": [{
    "id_artigo": "6123456789",
    "nome": "Camisola Nike M",
    "preco_venda": 25.00,
    "status_artigo": "ativo",
    "foto_url": "https://...",
    "url_vinted": "https://vinted.pt/items/..."
  }]
}
```

### POST `/api/sync/conversas`

```json
{
  "conversas": [{
    "id_vinted": "conv-123",
    "user_comprador": "maria_s",
    "ultimo_texto": "Aceitas 12€?",
    "ultima_mensagem_de": "comprador",
    "status_inbox": "proposta_recebida",
    "valor_proposta": 12.00,
    "url_conversa": "https://vinted.pt/inbox/..."
  }]
}
```

Header opcional: `x-sync-secret: teu-sync-secret`
